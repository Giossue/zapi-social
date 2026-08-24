import {
  portalModuleForHref,
  portalModuleForPath,
  restrictivePlanLimits,
  splitAiCreditCharge,
} from '@workspace/contracts';

describe('plan limits contract', () => {
  it('splits a charge between the monthly allowance and purchased balance', () => {
    expect(
      splitAiCreditCharge({
        accountUnlimited: false,
        costUnits: 4,
        creditsPerMonth: 10,
        usedPlanUnits: 8,
      }),
    ).toEqual({ allowanceUnits: 2, balanceDebitedUnits: 2 });
  });

  it('does not debit purchased balance for unlimited allowances', () => {
    expect(
      splitAiCreditCharge({
        accountUnlimited: false,
        costUnits: 12,
        creditsPerMonth: -1,
        usedPlanUnits: 1_000,
      }),
    ).toEqual({ allowanceUnits: 12, balanceDebitedUnits: 0 });
  });

  it('uses the restrictive fallback without exposing modules', () => {
    expect(restrictivePlanLimits.creditsPerMonth).toBe(0);
    expect(restrictivePlanLimits.enabledModules).toEqual([]);
  });

  it('maps AI publishing separately from AI Studio', () => {
    expect(portalModuleForPath('/v1/portal/ai/publishing-schedules')).toBe(
      'ai-publishing',
    );
    expect(portalModuleForHref('/portal/ai-studio/automation')).toBe(
      'ai-publishing',
    );
    expect(portalModuleForHref('/portal/ai-studio/image')).toBe('ai-studio');
  });
});
