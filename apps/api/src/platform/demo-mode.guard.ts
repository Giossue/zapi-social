import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { AppException } from './errors/app-exception';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const allowedMutationPaths = new Set([
  '/v1/auth/login',
  '/v1/auth/logout',
  '/v1/auth/refresh',
  '/v1/auth/workspaces/activate',
  '/v1/auth/impersonation/leave',
]);

@Injectable()
export class DemoModeGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    if (this.config.get<string>('DEMO_MODE') !== 'true') return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method.toUpperCase();
    const path = request.url.split('?')[0] ?? request.url;
    if (safeMethods.has(method) || allowedMutationPaths.has(path)) return true;
    throw new AppException('DEMO_MODE_READONLY', HttpStatus.FORBIDDEN);
  }
}
