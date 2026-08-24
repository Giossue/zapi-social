import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  publishingPostMedia,
  publishingPosts,
  socialAccounts,
  users,
} from '@workspace/database';
import { and, asc, count, eq, inArray } from '@workspace/database/query';
import {
  type ContentBoardCard,
  type ContentBoardResponse,
  type PortalAuthSession,
  moveContentBoardCardSchema,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';
import { TeamAccountAccessService } from '../teams/team-account-access.service';

/**
 * Transiciones que el tablero de contenido admite. Las demás las decide el
 * worker: una publicación no pasa a `published` porque alguien arrastre una
 * tarjeta.
 */
const allowedTransitions: Record<string, readonly string[]> = {
  draft: ['scheduled'],
  scheduled: ['draft'],
};

const boardLimit = 200;

@Injectable()
export class ContentBoardService {
  constructor(
    private readonly database: DatabaseService,
    private readonly accountAccess: TeamAccountAccessService,
  ) {}

  async board(session: PortalAuthSession): Promise<ContentBoardResponse> {
    const scope = await this.accountAccess.resolve(session);
    const rows = await this.database.db
      .select({
        post: publishingPosts,
        accountName: socialAccounts.displayName,
        authorName: users.displayName,
      })
      .from(publishingPosts)
      .leftJoin(
        socialAccounts,
        eq(publishingPosts.socialAccountId, socialAccounts.id),
      )
      .leftJoin(users, eq(publishingPosts.authorUserId, users.id))
      .where(eq(publishingPosts.workspaceId, session.workspace.id))
      .orderBy(asc(publishingPosts.scheduledAt))
      .limit(boardLimit);

    // Un miembro con acceso restringido solo ve las publicaciones de las
    // cuentas que tiene concedidas. Una publicación sin cuenta es un borrador
    // suelto y la ve su autor.
    const visible = rows.filter(({ post }) =>
      post.socialAccountId
        ? this.accountAccess.allows(scope, post.socialAccountId)
        : scope.unrestricted || post.authorUserId === session.user.id,
    );

    const mediaCounts = await this.mediaCountsFor(
      visible.map(({ post }) => post.id),
    );

    const cards: ContentBoardCard[] = visible.map(
      ({ post, accountName, authorName }) => ({
        id: post.id,
        status: post.status,
        content: post.content,
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        failureCode: post.failureCode,
        accountId: post.socialAccountId,
        accountName: accountName ?? null,
        authorName: authorName ?? null,
        mediaCount: mediaCounts.get(post.id) ?? 0,
      }),
    );

    return { cards, canManage: true };
  }

  async move(session: PortalAuthSession, postId: string, input: unknown) {
    const parsed = moveContentBoardCardSchema.safeParse(input);
    if (!parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const scope = await this.accountAccess.resolve(session);
    await this.database.db.transaction(async (tx) => {
      const [post] = await tx
        .select()
        .from(publishingPosts)
        .where(
          and(
            eq(publishingPosts.id, postId),
            eq(publishingPosts.workspaceId, session.workspace.id),
          ),
        )
        .for('update')
        .limit(1);
      if (!post)
        throw new AppException('BOARD_POST_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (
        post.socialAccountId &&
        !this.accountAccess.allows(scope, post.socialAccountId)
      ) {
        throw new AppException('TEAM_ACCESS_DENIED', HttpStatus.FORBIDDEN);
      }

      // La comprobación va aquí y no solo en la interfaz: bloquear el arrastre
      // en pantalla no autoriza nada.
      const allowed = allowedTransitions[post.status] ?? [];
      if (!allowed.includes(parsed.data.status)) {
        throw new AppException(
          'BOARD_TRANSITION_NOT_ALLOWED',
          HttpStatus.CONFLICT,
        );
      }
      // Programar sin fecha ni cuenta dejaría al worker sin qué publicar.
      if (
        parsed.data.status === 'scheduled' &&
        (!post.scheduledAt || !post.socialAccountId)
      ) {
        throw new AppException(
          'BOARD_POST_NOT_SCHEDULABLE',
          HttpStatus.CONFLICT,
        );
      }

      await tx
        .update(publishingPosts)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(publishingPosts.id, postId));
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'board.content_status_changed',
        subjectType: 'publishing_post',
        subjectId: postId,
        summary: 'Content board status changed',
        metadata: { from: post.status, to: parsed.data.status },
      });
    });

    return this.board(session);
  }

  private async mediaCountsFor(postIds: string[]) {
    const map = new Map<string, number>();
    if (!postIds.length) return map;
    const rows = await this.database.db
      .select({
        postId: publishingPostMedia.publishingPostId,
        total: count(),
      })
      .from(publishingPostMedia)
      .where(inArray(publishingPostMedia.publishingPostId, postIds))
      .groupBy(publishingPostMedia.publishingPostId);
    for (const row of rows) map.set(row.postId, Number(row.total));
    return map;
  }
}
