import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务规则拒绝异常。HTTP 200，但信封 code 非零（3xxx 段）+ bizCode。
 * 例：new BizException('保证金不足', 'MARGIN_NOT_ENOUGH', 3001)
 */
export class BizException extends HttpException {
  constructor(
    message: string,
    public readonly bizCode = 'BIZ_REJECTED',
    public readonly code = 3000,
  ) {
    super(message, HttpStatus.OK);
  }
}
