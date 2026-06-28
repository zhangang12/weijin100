import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** 统一成功信封（对齐《接口文档 v0.1》§1.3）。 */
export interface Envelope<T> {
  code: number;
  bizCode: string;
  message: string;
  data: T;
  requestId: string;
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 把 controller 返回值包成统一成功信封 {code:0,bizCode:'OK',message:'成功',data,requestId}。 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        bizCode: 'OK',
        message: '成功',
        data,
        requestId: rid(),
      })),
    );
  }
}
