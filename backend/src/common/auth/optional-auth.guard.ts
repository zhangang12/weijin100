import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './jwt-payload';

/** 游客可放行的守卫：有合法 token 则注入 req.user，无/非法则以游客继续（不抛错）。 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers?: Record<string, unknown>; user?: unknown }>();
    const h = (req.headers?.authorization as string) || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (token) {
      try {
        const p = this.jwt.verify<JwtPayload>(token);
        req.user = { userId: p.sub, openid: p.openid };
      } catch {
        /* 游客继续 */
      }
    }
    return true;
  }
}
