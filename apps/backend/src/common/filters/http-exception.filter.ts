import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

// Prisma error codes we handle explicitly.
// Full list: https://www.prisma.io/docs/reference/api-reference/error-reference
const PRISMA_UNIQUE_VIOLATION = 'P2002';
const PRISMA_NOT_FOUND        = 'P2025';
const PRISMA_FK_VIOLATION     = 'P2003';
const PRISMA_QUERY_TIMEOUT    = 'P2024';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let code = 'INTERNAL_ERROR';
    const details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      // ── NestJS / application HTTP exceptions ────────────────────────────────
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(resp.message)
          ? (resp.message as string[])[0] // stopAtFirstError returns array
          : (resp.message as string) ?? message;
      }

      code = this.httpStatusToCode(status);

    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // ── Prisma known errors — map to HTTP without leaking query details ─────
      // Never log the full Prisma error in production (it contains table/column
      // names and query fragments). Log the code and a safe reference only.
      const ref = exception.code;
      this.logger.warn(`Prisma error ${ref} on ${request.method} ${request.url}`);

      switch (exception.code) {
        case PRISMA_UNIQUE_VIOLATION:
          status = HttpStatus.CONFLICT;
          message = 'A record with these details already exists.';
          code = 'CONFLICT';
          break;
        case PRISMA_NOT_FOUND:
          status = HttpStatus.NOT_FOUND;
          message = 'The requested record was not found.';
          code = 'NOT_FOUND';
          break;
        case PRISMA_FK_VIOLATION:
          status = HttpStatus.BAD_REQUEST;
          message = 'Operation references a record that does not exist.';
          code = 'BAD_REQUEST';
          break;
        case PRISMA_QUERY_TIMEOUT:
          status = HttpStatus.SERVICE_UNAVAILABLE;
          message = 'The request timed out. Please try again.';
          code = 'SERVICE_UNAVAILABLE';
          break;
        default:
          // Unknown Prisma error — 500, no details
          break;
      }

    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // ── Prisma validation error (wrong types etc.) ───────────────────────────
      // These should be caught by class-validator before reaching Prisma.
      // If they reach here it's a programming error — log it.
      this.logger.error(
        `PrismaClientValidationError on ${request.method} ${request.url}`,
        process.env.NODE_ENV !== 'production' ? (exception as Error).message : undefined,
      );
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid request data.';
      code = 'BAD_REQUEST';

    } else if (exception instanceof Error) {
      // ── Unexpected errors — log full stack, return generic 500 ────────────
      // Never expose stack traces, error messages, or internal details to clients.
      this.logger.error(
        `Unhandled ${exception.constructor.name} on ${request.method} ${request.url}`,
        process.env.NODE_ENV !== 'production' ? exception.stack : exception.message,
      );
    }

    response.status(status).json({
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(Object.keys(details).length > 0 && { details }),
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private httpStatusToCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] ?? 'UNKNOWN_ERROR';
  }
}
