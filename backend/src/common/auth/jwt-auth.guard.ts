import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './jwt-payload';

function extractToken(req: { headers?: Record<string, unknown> }): string | null {
  const h = (req.headers?.authorization as string) || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** 必须登录的守卫：校验 access token → 注入 req.user。 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers?: Record<string, unknown>; user?: unknown }>();
    const token = extractToken(req);
    if (!token) throw new UnauthorizedException('未登录');
    try {
      const p = this.jwt.verify<JwtPayload>(token);
      if (p.typ === 'refresh') throw new Error('refresh token 不可用于鉴权');
      req.user = { userId: p.sub, openid: p.openid };
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期或无效');
    }
  }
}
