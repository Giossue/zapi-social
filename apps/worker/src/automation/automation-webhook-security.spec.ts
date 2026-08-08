import {
  isPrivateAddress,
  resolvePublicWebhookAddress,
} from './automation-webhook.processor';

describe('automation webhook security', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '169.254.169.254',
    '192.168.1.1',
    '::1',
    'fd00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '64:ff9b::7f00:1',
  ])('rejects non-public address %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])(
    'accepts public address %s',
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );

  it('requires HTTPS in production before resolving DNS', async () => {
    await expect(
      resolvePublicWebhookAddress(new URL('http://example.com/hook'), true),
    ).rejects.toMatchObject({ code: 'AUTOMATION_WEBHOOK_HTTPS_REQUIRED' });
  });
});
