import type { PortalAuthSession } from '@workspace/contracts';
import { AppException } from '../platform/errors/app-exception';
import { PortalBillingService } from './portal-billing.service';

const planId = '00000000-0000-4000-8000-000000000010';
const workspaceId = '00000000-0000-4000-8000-000000000020';
const userId = '00000000-0000-4000-8000-000000000030';

type CheckoutInput = {
  products: string[];
  prices: Record<string, unknown>;
  metadata: Record<string, string>;
};

function session(role: PortalAuthSession['workspace']['role']) {
  return {
    area: 'portal',
    user: {
      id: userId,
      email: 'owner@example.test',
      displayName: 'Workspace owner',
      locale: 'es',
    },
    workspace: {
      id: workspaceId,
      name: 'Test workspace',
      slug: 'test-workspace',
      role,
    },
    workspaces: [],
  } satisfies PortalAuthSession;
}

function serviceForCheckout() {
  const plan = {
    id: planId,
    name: 'Pro',
    status: 'active',
    price: '29.00',
    isFree: false,
    billingType: 'monthly',
    trialDays: 7,
  };
  const query = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn().mockResolvedValue([plan]),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  let checkoutMetadata: unknown;
  const create = jest.fn((input: CheckoutInput) => {
    checkoutMetadata = input.metadata;
    return Promise.resolve({
      url: 'https://sandbox.polar.sh/checkout/test',
    });
  });
  const polar = {
    configuration: jest.fn().mockResolvedValue({
      recurring: true,
      monthlyProductId: 'product_monthly',
      yearlyProductId: 'product_yearly',
      discountCodes: true,
      billingAddress: false,
    }),
    client: jest.fn().mockResolvedValue({ checkouts: { create } }),
  };
  const service = new PortalBillingService(
    {
      getOrThrow: jest.fn().mockReturnValue('https://app.example.test'),
    } as never,
    { db: { select: jest.fn().mockReturnValue(query) } } as never,
    polar as never,
  );
  const internals = service as unknown as {
    currentPlan: () => Promise<{ planId: string; source: 'signup' }>;
    activeSubscription: () => Promise<null>;
  };
  jest.spyOn(internals, 'currentPlan').mockResolvedValue({
    planId: '00000000-0000-4000-8000-000000000099',
    source: 'signup',
  });
  jest.spyOn(internals, 'activeSubscription').mockResolvedValue(null);
  return { create, getCheckoutMetadata: () => checkoutMetadata, service };
}

describe('PortalBillingService', () => {
  it('creates a server-priced Polar checkout for the workspace owner', async () => {
    const { create, getCheckoutMetadata, service } = serviceForCheckout();

    await expect(
      service.checkout(session('owner'), { planId }),
    ).resolves.toEqual({
      checkoutUrl: 'https://sandbox.polar.sh/checkout/test',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        products: ['product_monthly'],
        prices: {
          product_monthly: [
            {
              amountType: 'fixed',
              priceAmount: 2900,
              priceCurrency: 'usd',
            },
          ],
        },
      }),
    );
    expect(getCheckoutMetadata()).toMatchObject({
      planId,
      productType: 'plan',
      userId,
      workspaceId,
    });
  });

  it('rejects billing changes from non-owners', async () => {
    const { service } = serviceForCheckout();

    await expect(
      service.checkout(session('admin'), { planId }),
    ).rejects.toMatchObject({
      code: 'BILLING_OWNER_REQUIRED',
    } satisfies Partial<AppException>);
  });

  it('does not create a second checkout while a subscription is active', async () => {
    const { create, service } = serviceForCheckout();
    const internals = service as unknown as {
      activeSubscription: () => Promise<{ id: string }>;
    };
    jest.spyOn(internals, 'activeSubscription').mockResolvedValue({
      id: 'subscription-id',
    });

    await expect(
      service.checkout(session('owner'), { planId }),
    ).rejects.toMatchObject({ code: 'BILLING_PLAN_CHANGE_UNAVAILABLE' });
    expect(create).not.toHaveBeenCalled();
  });
});
