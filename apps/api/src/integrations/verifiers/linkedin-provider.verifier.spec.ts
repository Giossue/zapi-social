import { LinkedInProviderVerifier } from './linkedin-provider.verifier';

const valid = {
  clientId: 'abc',
  clientSecret: 'shh',
  apiVersion: '202607',
};

function respondWith(init: { ok: boolean; status: number }) {
  globalThis.fetch = () => Promise.resolve(init as unknown as Response);
}

describe('LinkedIn provider verifier', () => {
  const originalFetch = globalThis.fetch;
  const verifier = new LinkedInProviderVerifier();

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('accepts credentials that LinkedIn issues a token for', async () => {
    respondWith({ ok: true, status: 200 });
    await expect(verifier.verify(valid)).resolves.toBeNull();
  });

  it('reports invalid credentials on 400 and 401', async () => {
    respondWith({ ok: false, status: 400 });
    await expect(verifier.verify(valid)).resolves.toBe('invalid_credentials');
    respondWith({ ok: false, status: 401 });
    await expect(verifier.verify(valid)).resolves.toBe('invalid_credentials');
  });

  it('does not blame the credentials when LinkedIn itself fails', async () => {
    respondWith({ ok: false, status: 503 });
    await expect(verifier.verify(valid)).resolves.toBe('provider_unreachable');

    globalThis.fetch = () => Promise.reject(new Error('network'));
    await expect(verifier.verify(valid)).resolves.toBe('provider_unreachable');
  });

  it('demands the API version in YYYYMM before calling out', async () => {
    let called = false;
    globalThis.fetch = () => {
      called = true;
      return Promise.resolve({ ok: true, status: 200 } as unknown as Response);
    };

    await expect(verifier.verify({ ...valid, apiVersion: 'v2' })).resolves.toBe(
      'configuration_required',
    );
    await expect(verifier.verify({ ...valid, clientSecret: '' })).resolves.toBe(
      'configuration_required',
    );
    expect(called).toBe(false);
  });
});
