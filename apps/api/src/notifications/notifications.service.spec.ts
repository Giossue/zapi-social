import type {
  PortalAuthSession,
  PortalNotificationsResponse,
} from '@workspace/contracts';
import { NotificationsService } from './notifications.service';

const notificationId = '00000000-0000-4000-8000-000000000010';
const userId = '00000000-0000-4000-8000-000000000020';
const workspaceId = '00000000-0000-4000-8000-000000000030';

const session = {
  area: 'portal',
  user: {
    id: userId,
    email: 'member@example.test',
    displayName: 'Workspace member',
    locale: 'es',
  },
  workspace: {
    id: workspaceId,
    name: 'Test workspace',
    slug: 'test-workspace',
    role: 'member',
  },
  workspaces: [],
} satisfies PortalAuthSession;

const emptyResponse: PortalNotificationsResponse = {
  notifications: [],
  unread: 0,
  page: 1,
  limit: 10,
  total: 0,
};

function selectQuery(result: unknown[]) {
  const query = {
    from: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn().mockResolvedValue(result),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  query.from.mockReturnValue(query);
  query.leftJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  return query;
}

describe('NotificationsService', () => {
  it('rejects unsupported feed filters before querying data', async () => {
    const select = jest.fn();
    const service = new NotificationsService({ db: { select } } as never);

    await expect(
      service.feed(session, { filter: 'deleted' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(select).not.toHaveBeenCalled();
  });

  it('rejects malformed notification ids before querying data', async () => {
    const select = jest.fn();
    const service = new NotificationsService({ db: { select } } as never);

    await expect(service.archive(session, 'not-a-uuid')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(select).not.toHaveBeenCalled();
  });

  it('returns paginated metadata and a global unread count', async () => {
    const select = jest
      .fn()
      .mockReturnValueOnce(selectQuery([]))
      .mockReturnValueOnce(selectQuery([]))
      .mockReturnValueOnce(selectQuery([{ total: 2 }]))
      .mockReturnValueOnce(selectQuery([{ total: 3 }]))
      .mockReturnValueOnce(selectQuery([{ total: 4 }]))
      .mockReturnValueOnce(selectQuery([{ total: 5 }]));
    const service = new NotificationsService({ db: { select } } as never);

    await expect(
      service.feed(session, { filter: 'all', limit: 10, page: 1 }),
    ).resolves.toEqual({
      notifications: [],
      unread: 9,
      page: 1,
      limit: 10,
      total: 5,
    });
  });

  it('archives one owned workspace notification idempotently', async () => {
    const select = jest
      .fn()
      .mockReturnValueOnce(selectQuery([]))
      .mockReturnValueOnce(
        selectQuery([{ id: notificationId, archivedAt: null }]),
      );
    const updateQuery = {
      set: jest.fn(),
      where: jest.fn().mockResolvedValue(undefined),
    };
    updateQuery.set.mockReturnValue(updateQuery);
    const update = jest.fn().mockReturnValue(updateQuery);
    const service = new NotificationsService({
      db: { select, update },
    } as never);
    jest.spyOn(service, 'feed').mockResolvedValue(emptyResponse);

    await expect(service.archive(session, notificationId)).resolves.toEqual(
      emptyResponse,
    );
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not archive a notification outside the active session scope', async () => {
    const select = jest
      .fn()
      .mockReturnValueOnce(selectQuery([]))
      .mockReturnValueOnce(selectQuery([]));
    const update = jest.fn();
    const service = new NotificationsService({
      db: { select, update },
    } as never);

    await expect(
      service.archive(session, notificationId),
    ).rejects.toMatchObject({ code: 'ANNOUNCEMENT_NOT_FOUND' });
    expect(update).not.toHaveBeenCalled();
  });
});
