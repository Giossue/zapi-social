import type { ExecutionContext } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from './errors/app-exception';
import { DemoModeGuard } from './demo-mode.guard';

function context(method: string, url: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, url }) }),
  } as unknown as ExecutionContext;
}

describe('DemoModeGuard', () => {
  it('allows every request when demo mode is disabled', () => {
    const guard = new DemoModeGuard(new ConfigService({ DEMO_MODE: 'false' }));
    expect(guard.canActivate(context('DELETE', '/v1/admin/plans/id'))).toBe(
      true,
    );
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('allows safe %s requests', (method) => {
    const guard = new DemoModeGuard(new ConfigService({ DEMO_MODE: 'true' }));
    expect(guard.canActivate(context(method, '/v1/admin/plans'))).toBe(true);
  });

  it.each([
    '/v1/auth/login',
    '/v1/auth/logout',
    '/v1/auth/refresh',
    '/v1/auth/workspaces/activate',
    '/v1/auth/impersonation/leave',
  ])('allows session mutation %s', (path) => {
    const guard = new DemoModeGuard(new ConfigService({ DEMO_MODE: 'true' }));
    expect(guard.canActivate(context('POST', path))).toBe(true);
  });

  it('blocks product mutations with a stable error code', () => {
    const guard = new DemoModeGuard(new ConfigService({ DEMO_MODE: 'true' }));
    const activate = () =>
      guard.canActivate(context('POST', '/v1/portal/publishing'));

    expect(activate).toThrow(
      new AppException('DEMO_MODE_READONLY', HttpStatus.FORBIDDEN),
    );
  });
});
