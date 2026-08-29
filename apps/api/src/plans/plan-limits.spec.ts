import {
  portalModuleForHref,
  portalModuleForPath,
  restrictivePlanLimits,
  sanitizeWorkspacePermissions,
  splitAiCreditCharge,
  workspacePermissionForPortalHref,
  workspacePermissionForPortalRequest,
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

  it('maps portal reads and mutations to workspace permissions', () => {
    expect(
      workspacePermissionForPortalRequest('/v1/portal/channels', 'GET'),
    ).toBe('channels.view');
    expect(
      workspacePermissionForPortalRequest(
        '/v1/portal/channels/account-id',
        'PATCH',
      ),
    ).toBeNull();
    expect(
      workspacePermissionForPortalRequest('/v1/portal/files', 'POST'),
    ).toBe('files.manage');
    expect(workspacePermissionForPortalHref('/portal/teams')).toBeNull();
  });

  it('normalizes granular permissions and discards unknown values', () => {
    expect(
      sanitizeWorkspacePermissions([
        'publishing.manage',
        'boards.manage_tasks',
        'unknown.manage',
      ]),
    ).toEqual([
      'publishing.view',
      'publishing.manage',
      'boards.view',
      'boards.manage_tasks',
    ]);
  });
});
