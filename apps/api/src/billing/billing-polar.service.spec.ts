import { BadRequestException } from '@nestjs/common';
import { BillingPolarService } from './billing-polar.service';

describe('BillingPolarService', () => {
  it('rejects an active draft that does not match the last Polar test', async () => {
    const service = new BillingPolarService({} as never, { db: {} } as never);
    const internals = service as unknown as {
      row: () => Promise<{
        configurationCiphertext: null;
        enabled: boolean;
        enabledCapabilityKeys: string[];
        lastTestedAt: null;
        testedConfigFingerprint: string;
      }>;
    };
    jest.spyOn(internals, 'row').mockResolvedValue({
      configurationCiphertext: null,
      enabled: false,
      enabledCapabilityKeys: [],
      lastTestedAt: null,
      testedConfigFingerprint: 'another-draft',
    });

    await expect(
      service.save(
        {
          enabled: true,
          environment: 'sandbox',
          recurring: true,
          monthlyProductId: 'product_monthly',
          yearlyProductId: 'product_yearly',
          oneTimeProductId: '',
          discountCodes: true,
          billingAddress: false,
          accessToken: 'polar_oat_test',
          webhookSecret: 'polar_whs_test',
        },
        {
          area: 'admin',
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'admin@example.test',
            displayName: 'Admin',
            locale: null,
          },
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
