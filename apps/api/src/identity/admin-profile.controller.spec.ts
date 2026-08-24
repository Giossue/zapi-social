import { randomUUID } from 'node:crypto';
import type { PlatformAdminAuthSession } from '@workspace/contracts';
import type { FastifyRequest } from 'fastify';
import { AdminProfileController } from './admin-profile.controller';
import { PortalProfileService } from './portal-profile.service';
import { SessionAccessService } from './session-access.service';

describe('AdminProfileController', () => {
  const session: PlatformAdminAuthSession = {
    area: 'admin',
    user: {
      id: randomUUID(),
      displayName: 'Admin User',
      email: 'admin@example.test',
      locale: 'es',
    },
  };
  const request = {} as FastifyRequest;

  it('uses the platform admin guard for every profile operation', async () => {
    const requirePlatformAdmin = jest.fn().mockResolvedValue(session);
    const getProfile = jest.fn().mockResolvedValue({ id: session.user.id });
    const updateProfile = jest.fn().mockResolvedValue({ id: session.user.id });
    const changePassword = jest.fn().mockResolvedValue(undefined);
    const access = {
      requirePlatformAdmin,
    } as unknown as SessionAccessService;
    const profiles = {
      getProfile,
      updateProfile,
      changePassword,
    } as unknown as PortalProfileService;
    const controller = new AdminProfileController(profiles, access);
    const update = {
      displayName: 'Admin User',
      locale: 'es',
      timezone: 'America/Guayaquil',
    };
    const password = {
      currentPassword: 'Current-password-1!',
      newPassword: 'Updated-password-2!',
      passwordConfirmation: 'Updated-password-2!',
    };

    await controller.getProfile(request);
    await controller.updateProfile(request, update);
    await controller.changePassword(request, password);

    expect(requirePlatformAdmin).toHaveBeenCalledTimes(3);
    expect(getProfile).toHaveBeenCalledWith(session);
    expect(updateProfile).toHaveBeenCalledWith(session, update);
    expect(changePassword).toHaveBeenCalledWith(session, password);
  });
});
