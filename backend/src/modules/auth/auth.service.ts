import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { WeChatService } from '../../infra/wechat/wechat.service';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';
import type { JwtPayload } from '../../common/auth/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly wechat: WeChatService,
    private readonly config: ConfigService,
  ) {}

  /** 微信登录：code → openid → upsert 用户 → 发 token。 */
  async login(code: string) {
    if (!code) throw new BizException('缺少 code', 'NO_CODE', 2000);
    const { openid, unionid } = await this.wechat.code2Session(code);
    const user = await this.prisma.user.upsert({
      where: { openid },
      update: { unionid: unionid ?? undefined },
      create: {
        openid,
        unionid: unionid ?? undefined,
        weijinNo: await this.genWeijinNo(),
        nickname: '微金用户',
      },
    });
    // 确保有保证金账户
    await this.prisma.marginAccount.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
    return {
      ...this.issueTokens(user.id, openid),
      user: {
        userId: user.id,
        weijinNo: user.weijinNo,
        nickname: user.nickname,
        level: 'L' + user.level,
        kycStatus: user.kycStatus,
      },
    };
  }

  /** 刷新 access token。 */
  async refresh(refreshToken: string) {
    if (!refreshToken) throw new BizException('缺少 refreshToken', 'NO_TOKEN', 1001);
    let p: JwtPayload;
    try {
      p = this.jwt.verify<JwtPayload>(refreshToken);
    } catch {
      throw new BizException('refreshToken 无效或过期', 'TOKEN_INVALID', 1002);
    }
    if (p.typ !== 'refresh') throw new BizException('token 类型错误', 'TOKEN_INVALID', 1002);
    return this.issueTokens(p.sub, p.openid);
  }

  private issueTokens(userId: string, openid: string) {
    const accessToken = this.jwt.sign({ sub: userId, openid, typ: 'access' } as JwtPayload);
    const refreshToken = this.jwt.sign({ sub: userId, openid, typ: 'refresh' } as JwtPayload, {
      expiresIn: this.config.jwtRefreshTtl as unknown as number,
    });
    return { accessToken, refreshToken, expiresIn: 7200 };
  }

  private async genWeijinNo(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const no = '1' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
      const exists = await this.prisma.user.findUnique({ where: { weijinNo: no } });
      if (!exists) return no;
    }
    return '1' + Date.now().toString();
  }
}
