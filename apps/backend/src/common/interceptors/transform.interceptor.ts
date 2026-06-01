import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Wraps every successful response in:
// { success: true, data: <payload>, meta: <pagination | null> }
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: PaginationMeta | null;
  error: null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Services can return { data, meta } to include pagination,
// or just the raw data for non-paginated responses.
export interface PaginatedPayload<T> {
  data: T;
  meta: PaginationMeta;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        // If the service returned { data, meta }, unwrap it
        if (payload && typeof payload === 'object' && 'meta' in payload && 'data' in payload) {
          return {
            success: true,
            data: payload.data,
            meta: payload.meta,
            error: null,
          };
        }

        // Otherwise wrap raw payload
        return {
          success: true,
          data: payload,
          meta: null,
          error: null,
        };
      }),
    );
  }
}
