import {
  adminPermissionFor,
  adminPermissionMatches,
} from '@workspace/contracts';

describe('adminPermissionFor', () => {
  it('maps a GET to view and others to manage', () => {
    expect(adminPermissionFor('/v1/admin/languages', 'GET')).toBe(
      'languages.view',
    );
    expect(adminPermissionFor('/v1/admin/languages/fr', 'PATCH')).toBe(
      'languages.manage',
    );
  });

  it('maps operations to its inner module', () => {
    expect(adminPermissionFor('/v1/admin/operations/users?page=2', 'GET')).toBe(
      'users.view',
    );
    expect(
      adminPermissionFor('/v1/admin/operations/payments/all/x/actions', 'POST'),
    ).toBe('payments.manage');
  });

  it('ignores non-admin paths', () => {
    expect(adminPermissionFor('/v1/portal/files', 'GET')).toBeNull();
    expect(adminPermissionFor('/v1/i18n/languages', 'GET')).toBeNull();
  });
});

describe('adminPermissionMatches', () => {
  it('accepts exact keys, module wildcard and global wildcard', () => {
    expect(adminPermissionMatches(['languages.view'], 'languages.view')).toBe(
      true,
    );
    expect(adminPermissionMatches(['languages.*'], 'languages.manage')).toBe(
      true,
    );
    expect(adminPermissionMatches(['*'], 'users.manage')).toBe(true);
  });

  it('rejects a missing permission and view over manage', () => {
    expect(adminPermissionMatches(['languages.view'], 'languages.manage')).toBe(
      false,
    );
    expect(adminPermissionMatches([], 'users.view')).toBe(false);
  });
});
