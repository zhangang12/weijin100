import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/biz-exception';
import { maskIdCard, maskName, maskPhone } from '../../common/mask';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { kyc: true } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    return {
      userId: u.id,
      weijinNo: u.weijinNo,
      nickname: u.nickname,
      avatar: u.avatar,
      level: 'L' + u.level,
      completedTrades: u.completedTrades,
      kycStatus: u.kycStatus,
      realNameMasked: maskName(u.kyc?.realName),
      phone: maskPhone(u.phone),
      wechat: u.wechat,
      functionStatus: u.functionStatus,
    };
  }

  async updateProfile(userId: string, dto: { nickname?: string; wechat?: string; avatar?: string; phone?: string }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname ?? undefined,
        wechat: dto.wechat ?? undefined,
        avatar: dto.avatar ?? undefined,
        phone: dto.phone ?? undefined,
      },
    });
    return this.profile(userId);
  }

  async kyc(userId: string) {
    const k = await this.prisma.kycInfo.findUnique({ where: { userId } });
    if (!k) return { status: 'none' };
    return { status: k.status, realName: maskName(k.realName), idCardNo: maskIdCard(k.idCardNo) };
  }

  /** 提交实名（dev：直接置为 verified；正式接 OCR+人脸核身后再置位）。 */
  async submitKyc(userId: string, dto: { realName: string; idCardNo: string; frontImg?: string; backImg?: string }) {
    if (!dto?.realName || !dto?.idCardNo) throw new BizException('请填写姓名和身份证号', 'KYC_PARAM', 2000);
    if (!/^\d{17}[\dXx]$/.test(dto.idCardNo.trim())) throw new BizException('身份证号格式不正确', 'KYC_IDCARD', 2000);
    // H2：通过后锁定，不可再次覆盖。
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (u?.kycStatus === 'verified') throw new BizException('已实名认证，不可修改', 'KYC_LOCKED', 3018);
    await this.prisma.kycInfo.upsert({
      where: { userId },
      update: { realName: dto.realName, idCardNo: dto.idCardNo, frontImg: dto.frontImg, backImg: dto.backImg, status: 'verified', verifiedAt: new Date() },
      create: { userId, realName: dto.realName, idCardNo: dto.idCardNo, frontImg: dto.frontImg, backImg: dto.backImg, status: 'verified', verifiedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { kycStatus: 'verified' } });
    return { ok: true, status: 'verified' };
  }

  async eligibility(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { margin: true } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    return {
      realName: u.kycStatus === 'verified',
      contact: !!u.phone || !!u.wechat,
      marginOk: (u.margin?.available ?? 0n) > 0n,
      functionStatus: u.functionStatus,
      maxQty: 5000,
    };
  }
}
