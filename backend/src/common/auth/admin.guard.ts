import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

/**
 * 平台管理端守卫：校验请求头 x-admin-token == 配置 adminToken。
 * 供运营/客服后台的仲裁裁决等操作使用（无普通用户可达）。上线务必用强 token。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers?: Record<string, unknown> }>();
    const token = (req.headers?.['x-admin-token'] as string) || '';
    if (!token || token !== this.config.adminToken) throw new UnauthorizedException('管理端令牌无效');
    return true;
  }
}
