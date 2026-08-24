import { ChannelsService } from './channels.service';
import type { ChannelProviderIntegrationsService } from '../integrations/channel-provider-integrations.service';
import type { IntegrationsService } from '../integrations/integrations.service';
import type { PlanAccessService } from '../plans/plan-access.service';

type Capability = { key: string; enabled: boolean };

function integrationsStub(
  meta: { enabled: boolean; readiness: string; capabilities: Capability[] },
  whatsApp: { enabled: boolean; readiness: string; capabilities: Capability[] },
) {
  return {
    getMeta: () => Promise.resolve(meta),
    getWhatsAppStatus: () => Promise.resolve(whatsApp),
  } as unknown as IntegrationsService;
}

function serviceWith(
  integrations: IntegrationsService,
  generic: string[] = [],
  available: string[] | null = null,
) {
  const service = new ChannelsService(
    null as never,
    integrations,
    {
      readyCapabilityKeys: () => Promise.resolve(generic),
    } as unknown as ChannelProviderIntegrationsService,
    null as never,
    null as never,
    {
      availableChannelCapabilities: (_workspaceId: string, keys: string[]) =>
        Promise.resolve(new Set(available ?? keys)),
    } as unknown as PlanAccessService,
  );
  return service as unknown as {
    portalCapabilities(
      workspaceId?: string,
    ): Promise<{ key: string; availability: string }[]>;
  };
}

const offline = {
  enabled: false,
  readiness: 'not_configured',
  capabilities: [],
};

describe('portal channel availability', () => {
  it('marks every channel as coming soon while Admin has nothing configured', async () => {
    const service = serviceWith(integrationsStub(offline, offline));

    const capabilities = await service.portalCapabilities();

    expect(capabilities).not.toHaveLength(0);
    expect(
      capabilities.every(
        (capability) => capability.availability === 'coming_soon',
      ),
    ).toBe(true);
  });

  it('only opens the capabilities enabled on a ready integration', async () => {
    const service = serviceWith(
      integrationsStub(
        {
          enabled: true,
          readiness: 'ready',
          capabilities: [
            { key: 'facebook_page', enabled: true },
            { key: 'instagram_profile', enabled: false },
          ],
        },
        offline,
      ),
    );

    const capabilities = await service.portalCapabilities();
    const availability = new Map(
      capabilities.map((capability) => [
        capability.key,
        capability.availability,
      ]),
    );

    expect(availability.get('facebook_page')).toBe('ready');
    expect(availability.get('instagram_profile')).toBe('coming_soon');
    expect(availability.get('whatsapp_status')).toBe('coming_soon');
    expect(availability.get('linkedin_page')).toBe('coming_soon');
  });

  it('opens a channel configured through the generic provider screen', async () => {
    const service = serviceWith(integrationsStub(offline, offline), [
      'linkedin_page',
    ]);

    const capabilities = await service.portalCapabilities();
    const availability = new Map(
      capabilities.map((capability) => [
        capability.key,
        capability.availability,
      ]),
    );

    expect(availability.get('linkedin_page')).toBe('ready');
    expect(availability.get('linkedin_profile')).toBe('coming_soon');
  });

  it('keeps a channel closed when the integration is ready but switched off', async () => {
    const service = serviceWith(
      integrationsStub(
        {
          enabled: false,
          readiness: 'ready',
          capabilities: [{ key: 'facebook_page', enabled: true }],
        },
        offline,
      ),
    );

    const capabilities = await service.portalCapabilities();

    expect(
      capabilities.find((capability) => capability.key === 'facebook_page')
        ?.availability,
    ).toBe('coming_soon');
  });

  it('locks ready capabilities when the plan has no remaining slot', async () => {
    const service = serviceWith(
      integrationsStub(
        {
          enabled: true,
          readiness: 'ready',
          capabilities: [{ key: 'facebook_page', enabled: true }],
        },
        offline,
      ),
      [],
      [],
    );

    const capabilities = await service.portalCapabilities('workspace-id');

    expect(
      capabilities.find((capability) => capability.key === 'facebook_page')
        ?.availability,
    ).toBe('plan_locked');
  });
});
