import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Matches the error format defined in the architecture doc:
// { success: false, data: null, error: { code, message, details } }
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        // class-validator returns { message: string[] } on validation errors
        message = Array.isArray(resp.message)
          ? resp.message.join('; ')
          : (resp.message as string) ?? message;
        details = resp.details as Record<string, unknown> ?? {};
      }

      code = this.getErrorCode(status);
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception.stack,
      );
      message = 'An unexpected error occurred';
    }

    response.status(status).json({
      success: false,
      data: null,
      error: {
        code,
        message,
        details,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return codes[status] ?? 'UNKNOWN_ERROR';
  }
}
