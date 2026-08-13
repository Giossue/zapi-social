import { ConfigService } from '@nestjs/config';
import { Aes256GcmService } from '../platform/crypto/aes-256-gcm.service';
import { CaptchaService } from './captcha.service';

const providerKey = 'cloudflare-turnstile';
const encryptionKey = Buffer.alloc(32, 7).toString('base64');

function configuredService() {
  const service = new CaptchaService(
    {
      getOrThrow: () => encryptionKey,
    } as unknown as ConfigService,
    { db: {} } as never,
  );
  const internals = service as unknown as {
    row: () => Promise<{
      enabled: boolean;
      configurationCiphertext: string;
    }>;
  };
  jest.spyOn(internals, 'row').mockResolvedValue({
    enabled: true,
    configurationCiphertext: new Aes256GcmService(encryptionKey).encrypt(
      JSON.stringify({ siteKey: 'site-key', secretKey: 'secret-key' }),
      providerKey,
    ),
  });
  return service;
}

describe('CaptchaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a missing token before calling Cloudflare', async () => {
    const service = configuredService();
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      service.verifyAuthenticationToken(undefined, '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'AUTH_CAPTCHA_INVALID' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid Siteverify response', async () => {
    const service = configuredService();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      );

    await expect(
      service.verifyAuthenticationToken('turnstile-token', '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'AUTH_CAPTCHA_INVALID' });
  });

  it('accepts a successful Siteverify response', async () => {
    const service = configuredService();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

    await expect(
      service.verifyAuthenticationToken('turnstile-token', '127.0.0.1'),
    ).resolves.toBeUndefined();
  });
});
