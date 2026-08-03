import { Injectable } from '@nestjs/common';
import { workspaceMemberships } from '@workspace/database';
import type { PortalAuthSession, PortalDashboard } from '@workspace/contracts';
import { and, count, eq } from '@workspace/database/query';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async getDashboard(session: PortalAuthSession): Promise<PortalDashboard> {
    const [membershipTotal] = await this.database.db
      .select({ value: count() })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, session.workspace.id),
          eq(workspaceMemberships.status, 'active'),
        ),
      );

    return {
      welcome: { name: session.user.displayName },
      primaryAction: {
        label: 'Nueva publicación',
        href: '/portal/publishing/calendar',
      },
      workspace: [
        {
          label: 'Miembros activos',
          value: String(membershipTotal?.value ?? 0),
          icon: 'channels',
        },
        { label: 'Canales conectados', value: '0', icon: 'channels' },
        { label: 'Publicaciones', value: '0', icon: 'calendar' },
        { label: 'Créditos AI usados', value: '0', icon: 'ai' },
      ],
      tools: [],
      publishing: [
        { label: 'Programadas', value: '0', icon: 'calendar' },
        { label: 'Pendientes', value: '0', icon: 'calendar' },
        { label: 'Publicadas', value: '0', icon: 'calendar' },
      ],
      library: [
        { label: 'Archivos', value: '0', icon: 'files' },
        { label: 'Imágenes', value: '0', icon: 'files' },
        { label: 'Plantillas', value: '0', icon: 'templates' },
      ],
      attention: [],
    };
  }
}
