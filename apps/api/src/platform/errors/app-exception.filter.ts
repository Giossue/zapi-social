import {
  Catch,
  type ArgumentsHost,
  HttpException,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppException, type AppErrorCode } from './app-exception';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const response = context.getResponse<FastifyReply>();
    const { status, code } = this.resolveException(exception);
    const requestId = request.id;

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      request.log.error({ err: exception, code, requestId }, 'request failed');
    } else {
      request.log.warn({ code, requestId }, 'request rejected');
    }

    response.status(status).send({ code, requestId });
  }

  private resolveException(exception: unknown): {
    status: number;
    code: AppErrorCode;
  } {
    if (exception instanceof AppException) {
      return { status: exception.getStatus(), code: exception.code };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code:
          status === Number(HttpStatus.BAD_REQUEST)
            ? 'VALIDATION_FAILED'
            : 'REQUEST_FAILED',
      };
    }

    return {
      status: Number(HttpStatus.INTERNAL_SERVER_ERROR),
      code: 'INTERNAL_SERVER_ERROR',
    };
  }
}
