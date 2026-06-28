import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BizException } from './biz-exception';

/** 仅依赖底层 HTTP 响应对象的最小结构（避免引入 @types/express）。 */
interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): unknown;
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** HTTP 状态 → 业务 code 段（约定：1xxx 鉴权 / 2xxx 参数 / 5xxx 系统）。 */
function mapCode(status: number): number {
  if (status === HttpStatus.UNAUTHORIZED) return 1001;
  if (status === HttpStatus.FORBIDDEN) return 1003;
  if (status === HttpStatus.BAD_REQUEST) return 2000;
  if (status === HttpStatus.NOT_FOUND) return 2004;
  if (status >= 500) return 5000;
  return status;
}

/** 全局异常 → 非零 code 的统一失败信封 {code,bizCode,message,data:null,requestId}。 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<HttpResponse>();

    // 业务规则拒绝：HTTP 200 + 自定义 code/bizCode
    if (exception instanceof BizException) {
      res.status(HttpStatus.OK).json({
        code: exception.code,
        bizCode: exception.bizCode,
        message: exception.message,
        data: null,
        requestId: rid(),
      });
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '服务器内部错误';
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as { message: unknown }).message;
        message = Array.isArray(m) ? m.join('; ') : String(m);
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    res.status(status).json({
      code: mapCode(status),
      bizCode: 'ERROR',
      message,
      data: null,
      requestId: rid(),
    });
  }
}
