import { ForbiddenException } from '@nestjs/common';
import { BillingWebhookService } from './billing-webhook.service';

describe('BillingWebhookService', () => {
  it('rejects an invalid Polar signature before persistence', async () => {
    const database = { db: {} };
    const polar = {
      configuration: () => Promise.resolve({ webhookSecret: 'test-secret' }),
    };
    const service = new BillingWebhookService(
      database as never,
      polar as never,
    );

    await expect(
      service.handle(Buffer.from('{}'), {
        'webhook-id': 'evt_invalid',
        'webhook-timestamp': '1',
        'webhook-signature': 'invalid',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
