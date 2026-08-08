import { Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  auditReleases,
  users,
  webAuditLogs,
  workerAuditLogs,
  workspaces,
} from '@workspace/database';
import type { PortalAuthSession, WebAuditEvent } from '@workspace/contracts';
import type { FastifyRequest } from 'fastify';
import { DatabaseService } from '../database/database.service';
import { IdentityService } from '../identity/identity.service';
import { desc, eq } from '@workspace/database/query';

const sessionCookieName = 'zapi_session';

@Injectable()
export class AuditService {
  constructor(
    private readonly database: DatabaseService,
    private readonly identity: IdentityService,
  ) {}

  async logApiResponse(request: FastifyRequest, status: number) {
    const method = request.method.toUpperCase();
    if (
      method === 'GET' ||
      method === 'HEAD' ||
      method === 'OPTIONS' ||
      request.url.startsWith('/v1/portal/audit/')
    ) {
      return;
    }

    const session = await this.identity.getSession(
      request.cookies[sessionCookieName],
    );
    const path = request.routeOptions.url ?? request.url.split('?')[0];
    const severity =
      status >= 500 ? 'error' : status >= 400 ? 'warning' : 'success';

    await this.database.db.insert(apiAuditLogs).values({
      workspaceId: session?.area === 'portal' ? session.workspace.id : null,
      actorUserId: session?.user.id ?? null,
      event: 'http.request.completed',
      severity,
      outcome: status >= 400 ? 'failed' : 'succeeded',
      requestId: request.id,
      httpMethod: method,
      httpPath: path,
      httpStatus: status,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']?.slice(0, 512),
      errorCode: status >= 400 ? `HTTP_${status}` : null,
      summary: `${method} ${path} → ${status}`,
      metadata: {},
    });
  }

  async logWebEvent(session: PortalAuthSession, input: WebAuditEvent) {
    await this.database.db.insert(webAuditLogs).values({
      workspaceId: session.workspace.id,
      actorUserId: session.user.id,
      event: input.event,
      severity: input.severity,
      outcome: input.outcome,
      pagePath: input.pagePath ?? null,
      requestId: input.requestId ?? null,
      errorCode: input.errorCode ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async listAdminEvents() {
    const [apiEvents, webEvents, workerEvents] = await Promise.all([
      this.database.db
        .select({
          id: apiAuditLogs.id,
          event: apiAuditLogs.event,
          severity: apiAuditLogs.severity,
          outcome: apiAuditLogs.outcome,
          summary: apiAuditLogs.summary,
          errorCode: apiAuditLogs.errorCode,
          actorName: users.displayName,
          actorEmail: users.email,
          workspaceName: workspaces.name,
          service: auditReleases.service,
          commitSha: auditReleases.commitSha,
          createdAt: apiAuditLogs.createdAt,
        })
        .from(apiAuditLogs)
        .leftJoin(users, eq(apiAuditLogs.actorUserId, users.id))
        .leftJoin(workspaces, eq(apiAuditLogs.workspaceId, workspaces.id))
        .leftJoin(auditReleases, eq(apiAuditLogs.releaseId, auditReleases.id))
        .orderBy(desc(apiAuditLogs.createdAt))
        .limit(100),
      this.database.db
        .select({
          id: webAuditLogs.id,
          event: webAuditLogs.event,
          severity: webAuditLogs.severity,
          outcome: webAuditLogs.outcome,
          summary: webAuditLogs.summary,
          errorCode: webAuditLogs.errorCode,
          actorName: users.displayName,
          actorEmail: users.email,
          workspaceName: workspaces.name,
          service: auditReleases.service,
          commitSha: auditReleases.commitSha,
          createdAt: webAuditLogs.createdAt,
        })
        .from(webAuditLogs)
        .leftJoin(users, eq(webAuditLogs.actorUserId, users.id))
        .leftJoin(workspaces, eq(webAuditLogs.workspaceId, workspaces.id))
        .leftJoin(auditReleases, eq(webAuditLogs.releaseId, auditReleases.id))
        .orderBy(desc(webAuditLogs.createdAt))
        .limit(100),
      this.database.db
        .select({
          id: workerAuditLogs.id,
          event: workerAuditLogs.event,
          severity: workerAuditLogs.severity,
          outcome: workerAuditLogs.outcome,
          summary: workerAuditLogs.summary,
          errorCode: workerAuditLogs.errorCode,
          actorName: users.displayName,
          actorEmail: users.email,
          workspaceName: workspaces.name,
          service: auditReleases.service,
          commitSha: auditReleases.commitSha,
          createdAt: workerAuditLogs.createdAt,
        })
        .from(workerAuditLogs)
        .leftJoin(users, eq(workerAuditLogs.actorUserId, users.id))
        .leftJoin(workspaces, eq(workerAuditLogs.workspaceId, workspaces.id))
        .leftJoin(
          auditReleases,
          eq(workerAuditLogs.releaseId, auditReleases.id),
        )
        .orderBy(desc(workerAuditLogs.createdAt))
        .limit(100),
    ]);

    return {
      events: [
        ...apiEvents.map((event) => ({ ...event, source: 'api' as const })),
        ...webEvents.map((event) => ({ ...event, source: 'web' as const })),
        ...workerEvents.map((event) => ({
          ...event,
          source: 'worker' as const,
        })),
      ]
        .sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .slice(0, 100)
        .map((event) => ({
          ...event,
          createdAt: event.createdAt.toISOString(),
        })),
    };
  }
}
