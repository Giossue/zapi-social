import { apiAuditLogs, plans, users } from '@workspace/database';
import { DatabaseService } from '../database/database.service';
import { SetupService } from './setup.service';

function statusDatabase(total: number, platformAdmins: number) {
  return {
    db: {
      select: jest.fn(() => ({
        from: jest.fn().mockResolvedValue([{ total, platformAdmins }]),
      })),
    },
  } as unknown as DatabaseService;
}

function creationDatabase(total: number) {
  const outerSelect = jest.fn(() => ({
    from: jest
      .fn()
      .mockResolvedValue([{ total, platformAdmins: total > 0 ? 1 : 0 }]),
  }));
  const execute = jest.fn().mockResolvedValue(undefined);
  const select = jest.fn(() => ({
    from: jest.fn().mockResolvedValue([{ total }]),
  }));
  const insert = jest.fn((table: unknown) => {
    if (table === users) {
      return {
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([{ id: 'admin-id' }]),
        })),
      };
    }
    return { values: jest.fn().mockResolvedValue(undefined) };
  });
  const transaction = jest.fn(
    async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({ execute, select, insert }),
  );
  return {
    database: {
      db: { select: outerSelect, transaction },
    } as unknown as DatabaseService,
    execute,
    insert,
    transaction,
  };
}

const validInput = {
  displayName: 'Primary Admin',
  email: 'Admin@Example.test',
  password: 'Secure-password-42!',
  timezone: 'UTC',
};

describe('SetupService', () => {
  it.each([
    [0, 0, { needsSetup: true, state: 'required' }],
    [2, 1, { needsSetup: false, state: 'complete' }],
    [2, 0, { needsSetup: false, state: 'blocked' }],
  ] as const)(
    'returns the setup state for %s users and %s admins',
    async (total, platformAdmins, expected) => {
      const service = new SetupService(statusDatabase(total, platformAdmins));
      await expect(service.status()).resolves.toEqual(expected);
    },
  );

  it('creates the initial admin, plans and audit event atomically', async () => {
    const context = creationDatabase(0);
    const service = new SetupService(context.database);

    await expect(service.createAdmin(validInput)).resolves.toEqual({
      created: true,
    });
    expect(context.execute).toHaveBeenCalledTimes(1);
    expect(context.insert).toHaveBeenCalledWith(users);
    expect(context.insert).toHaveBeenCalledWith(plans);
    expect(context.insert).toHaveBeenCalledWith(apiAuditLogs);
  });

  it('rejects setup after any user exists', async () => {
    const context = creationDatabase(1);
    const service = new SetupService(context.database);

    await expect(service.createAdmin(validInput)).rejects.toMatchObject({
      code: 'SETUP_ALREADY_COMPLETED',
    });
    expect(context.insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid password before opening a transaction', async () => {
    const context = creationDatabase(0);
    const service = new SetupService(context.database);

    await expect(
      service.createAdmin({ ...validInput, password: 'weak' }),
    ).rejects.toMatchObject({ code: 'AUTH_PASSWORD_POLICY_NOT_MET' });
    expect(context.transaction).not.toHaveBeenCalled();
  });
});
