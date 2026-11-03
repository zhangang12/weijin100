import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../../config/config.service';
import { BizException } from '../../common/biz-exception';
import { maskIdCard, maskName, maskPhone } from '../../common/mask';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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
    return { status: k.status, realName: maskName(k.realName), idCardNo: maskIdCard(k.idCardNo), rejectReason: k.rejectReason ?? undefined };
  }

  /**
   * 提交实名。KYC_AUTO_APPROVE（开发默认）直接通过；生产进「审核中」，运营凭证件照人工审核（/admin/kyc）。
   * 审核中可补交覆盖，通过后锁定（H2）。
   */
  async submitKyc(userId: string, dto: { realName: string; idCardNo: string; frontImg?: string; backImg?: string }) {
    if (!dto?.realName || !dto?.idCardNo) throw new BizException('请填写姓名和身份证号', 'KYC_PARAM', 2000);
    if (!/^\d{17}[\dXx]$/.test(dto.idCardNo.trim())) throw new BizException('身份证号格式不正确', 'KYC_IDCARD', 2000);
    // H2：通过后锁定，不可再次覆盖。
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (u?.kycStatus === 'verified') throw new BizException('已实名认证，不可修改', 'KYC_LOCKED', 3018);
    const auto = this.config.kycAutoApprove;
    if (!auto && (!dto.frontImg || !dto.backImg)) throw new BizException('请上传身份证正反面照片', 'KYC_PARAM', 2000);
    // 证件照只认本人上传到 kyc 目录的文件
    for (const img of [dto.frontImg, dto.backImg]) {
      if (!auto && img && !img.startsWith(`kyc/${userId}/`)) throw new BizException('证件照无效，请重新上传', 'KYC_PARAM', 2000);
    }
    const status = auto ? 'verified' : 'pending';
    const data = {
      realName: dto.realName.trim(), idCardNo: dto.idCardNo.trim().toUpperCase(), frontImg: dto.frontImg, backImg: dto.backImg,
      status, verifiedAt: auto ? new Date() : null, rejectReason: null,
    } as const;
    await this.prisma.kycInfo.upsert({ where: { userId }, update: data, create: { userId, ...data } });
    await this.prisma.user.update({ where: { id: userId }, data: { kycStatus: status } });
    return { ok: true, status };
  }

  /** 运营端：待审核实名列表（含完整姓名/证件号/证件照 fileId，证件照经 /admin/file/* 查看）。 */
  async adminKycList(status: 'pending' | 'verified' | 'rejected' = 'pending') {
    const list = await this.prisma.kycInfo.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { user: { select: { weijinNo: true, nickname: true, phone: true } } },
    });
    return list.map((k) => ({
      userId: k.userId, weijinNo: k.user.weijinNo, nickname: k.user.nickname, phone: k.user.phone,
      realName: k.realName, idCardNo: k.idCardNo, frontImg: k.frontImg, backImg: k.backImg,
      status: k.status, rejectReason: k.rejectReason, submittedAt: k.createdAt,
    }));
  }

  /** 运营端：审核实名。approve=true 通过并锁定；false 驳回（用户可重新提交）。 */
  async adminReviewKyc(userId: string, approve: boolean, reason?: string) {
    const k = await this.prisma.kycInfo.findUnique({ where: { userId } });
    if (!k) throw new BizException('该用户未提交实名', 'KYC_NOT_FOUND', 2004);
    if (k.status !== 'pending') throw new BizException('该实名不在审核中', 'KYC_STATE', 3018);
    const status = approve ? 'verified' : 'rejected';
    await this.prisma.kycInfo.update({
      where: { userId },
      data: { status, verifiedAt: approve ? new Date() : null, rejectReason: approve ? null : reason || '资料不符' },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { kycStatus: status } });
    return { ok: true, status };
  }

  async eligibility(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { margin: true } });
    if (!u) throw new BizException('用户不存在', 'USER_NOT_FOUND', 2004);
    return {
      realName: u.kycStatus === 'verified',
      contact: !!u.phone || !!u.wechat,
      marginOk: !this.config.marginEnabled || (u.margin?.available ?? 0n) > 0n,
      functionStatus: u.functionStatus,
      maxQty: 5000,
    };
  }
}
