import { LinkedInConnectionAdapter } from './linkedin-connection.adapter';

const adapter = new LinkedInConnectionAdapter();
const originalFetch = globalThis.fetch;

function respond(routes: Record<string, unknown>) {
  globalThis.fetch = (input: string | URL) => {
    const url = input.toString();
    const match = Object.keys(routes).find((key) => url.includes(key));
    if (!match) return Promise.resolve({ ok: false, status: 404 } as Response);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(routes[match]),
    } as unknown as Response);
  };
}

describe('LinkedIn connection adapter', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('asks for the organization scope only when connecting a page', () => {
    expect(adapter.scopesFor('linkedin_page')).toContain(
      'r_organization_admin',
    );
    expect(adapter.scopesFor('linkedin_profile')).not.toContain(
      'r_organization_admin',
    );
    // Publicar es lo que justifica la conexión: siempre está.
    expect(adapter.scopesFor('linkedin_profile')).toContain('w_member_social');
  });

  it('reads a profile from the OpenID `sub`', async () => {
    respond({
      '/v2/userinfo': {
        sub: 'person-1',
        name: 'Ada Lovelace',
        picture: 'https://example.test/a.jpg',
      },
    });

    await expect(
      adapter.fetchCandidates({
        accessToken: 't',
        capabilityKey: 'linkedin_profile',
        apiVersion: '202607',
      }),
    ).resolves.toEqual([
      {
        externalId: 'person-1',
        displayName: 'Ada Lovelace',
        description: 'linkedin_profile',
        publicMetadata: { kind: 'linkedin_profile' },
        context: { accessToken: 't', avatarUrl: 'https://example.test/a.jpg' },
      },
    ]);
  });

  it('accepts both shapes of the organizationAcls response', async () => {
    respond({
      '/organizationAcls': {
        elements: [
          { organizationTarget: 'urn:li:organization:111' },
          { organization: 'urn:li:organization:222' },
        ],
      },
      '/organizations/': { localizedName: 'Acme' },
    });

    const candidates = await adapter.fetchCandidates({
      accessToken: 't',
      capabilityKey: 'linkedin_page',
      apiVersion: '202607',
    });

    expect(candidates.map((candidate) => candidate.externalId)).toEqual([
      '111',
      '222',
    ]);
    expect(candidates[0].displayName).toBe('Acme');
  });

  it('falls back to the identifier when the name cannot be resolved', async () => {
    respond({
      '/organizationAcls': {
        elements: [{ organization: 'urn:li:organization:333' }],
      },
    });

    const [candidate] = await adapter.fetchCandidates({
      accessToken: 't',
      capabilityKey: 'linkedin_page',
      apiVersion: '202607',
    });

    expect(candidate.displayName).toBe('333');
  });

  it('rejects a token exchange that does not return a token', async () => {
    globalThis.fetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: 'invalid_request' }),
      } as unknown as Response);

    await expect(
      adapter.exchangeCode({
        clientId: 'a',
        clientSecret: 'b',
        code: 'c',
        redirectUri: 'https://example.test/cb',
      }),
    ).rejects.toThrow();
  });
});
