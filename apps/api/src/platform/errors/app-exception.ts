import { HttpException, type HttpStatus } from '@nestjs/common';

export type AppErrorCode =
  | 'AUTH_EMAIL_ALREADY_REGISTERED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_PASSWORD_POLICY_NOT_MET'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_WORKSPACE_UNAVAILABLE'
  | 'OAUTH_CALLBACK_INVALID'
  | 'OAUTH_PROVIDER_CONFIGURATION_INVALID'
  | 'OAUTH_PROVIDER_NOT_READY'
  | 'OAUTH_PROVIDER_UNSUPPORTED'
  | 'OAUTH_STATE_INVALID'
  | 'OAUTH_STATE_EXPIRED'
  | 'OAUTH_STATE_CONSUMED'
  | 'VALIDATION_FAILED'
  | 'INFRASTRUCTURE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR'
  | 'REQUEST_FAILED';

export class AppException extends HttpException {
  constructor(
    readonly code: AppErrorCode,
    status: HttpStatus,
  ) {
    super({ code }, status);
  }
}
