import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 买家 demo（dev 登录：code='mock:demo_buyer'）
  const buyer = await prisma.user.upsert({
    where: { openid: 'demo_buyer' },
    update: {},
    create: {
      openid: 'demo_buyer',
      weijinNo: '100886699',
      nickname: '金诚足金',
      level: 2,
      completedTrades: 13,
      kycStatus: 'verified',
      phone: '13800009999',
      wechat: 'chengjin_gold88',
    },
  });
  await prisma.kycInfo.upsert({
    where: { userId: buyer.id },
    update: {},
    create: { userId: buyer.id, realName: '陈某某', idCardNo: '44010019900101XXXX', status: 'verified', verifiedAt: new Date() },
  });
  await prisma.marginAccount.upsert({
    where: { userId: buyer.id },
    update: { totalBalance: 30000000n, available: 30000000n, frozen: 0n }, // ¥300,000
    create: { userId: buyer.id, totalBalance: 30000000n, available: 30000000n },
  });
  await prisma.priceAlert.deleteMany({ where: { userId: buyer.id } });
  await prisma.priceAlert.createMany({
    data: [
      { userId: buyer.id, metal: 'gold', condition: 'above', targetPrice: '900.00', channels: ['push'] },
      { userId: buyer.id, metal: 'gold', condition: 'below', targetPrice: '880.00', channels: ['push', 'sms'] },
    ],
  });
  await prisma.address.deleteMany({ where: { userId: buyer.id } });
  await prisma.address.create({
    data: { userId: buyer.id, type: 'receive', contact: '陈先生', phone: '13800009999', region: '广东 深圳 罗湖', detail: '水贝珠宝交易中心 A 座 1588 室', isDefault: true },
  });

  // 联调默认账号（前端 DEV_OPENID='devuser001'，code='mock:devuser001'）：已实名+有保证金的买家，开箱即可锁价/发布
  const dev = await prisma.user.upsert({
    where: { openid: 'devuser001' },
    update: { kycStatus: 'verified', phone: '13800001111', wechat: 'devuser001' },
    create: { openid: 'devuser001', weijinNo: '100800001', nickname: '联调账号', level: 3, completedTrades: 25, kycStatus: 'verified', phone: '13800001111', wechat: 'devuser001' },
  });
  await prisma.kycInfo.upsert({
    where: { userId: dev.id },
    update: {},
    create: { userId: dev.id, realName: '开发某', idCardNo: '44010019900101YYYY', status: 'verified', verifiedAt: new Date() },
  });
  await prisma.marginAccount.upsert({
    where: { userId: dev.id },
    update: { totalBalance: 30000000n, available: 30000000n, frozen: 0n },
    create: { userId: dev.id, totalBalance: 30000000n, available: 30000000n },
  });
  await prisma.address.deleteMany({ where: { userId: dev.id } });
  await prisma.address.create({
    data: { userId: dev.id, type: 'receive', contact: '开发', phone: '13800001111', region: '广东 深圳 福田', detail: '联调测试地址 1 号', isDefault: true },
  });

  // 卖家 demo（dev 登录：code='mock:demo_seller'）
  const seller = await prisma.user.upsert({
    where: { openid: 'demo_seller' },
    update: {},
    create: { openid: 'demo_seller', weijinNo: '100886700', nickname: '融通足金', level: 9, completedTrades: 120, kycStatus: 'verified', phone: '13800008888', wechat: 'jiang_jewel88' },
  });
  await prisma.marginAccount.upsert({
    where: { userId: seller.id },
    update: {},
    create: { userId: seller.id, totalBalance: 50000000n, available: 50000000n },
  });

  // 挂单 demo
  const listings = [
    { id: 'L_88001', metal: 'gold' as const, category: '板料', goodsName: '融通足金价', tags: ['板料', '整出'], images: [], totalWeight: '1000', remainingWeight: '1000', shipMode: 'whole_all' as const, refPriceCash: '891.00', refPriceTransfer: '892.00', supportTransfer: true },
    { id: 'L_88002', metal: 'gold' as const, category: '板料', goodsName: '融通足金价', tags: ['板料', '散出', '现货'], images: [], totalWeight: '987', remainingWeight: '987', shipMode: 'bulk' as const, minBatch: '1', refPriceCash: '890.50', refPriceTransfer: '891.50', supportTransfer: true },
    { id: 'L_88003', metal: 'gold' as const, category: '板料', goodsName: '融通足金价', tags: ['板料', '整出', '现货'], images: [], totalWeight: '1500', remainingWeight: '1500', shipMode: 'whole_fixed' as const, lotSize: '500', refPriceCash: '891.00', refPriceTransfer: '892.00', supportTransfer: true },
  ];
  for (const l of listings) {
    await prisma.listing.upsert({ where: { id: l.id }, update: {}, create: { ...l, sellerId: seller.id } });
  }

  // 违约记录 demo（买家，可申诉）
  await prisma.appeal.deleteMany({ where: { userId: buyer.id } });
  await prisma.defaultRecord.deleteMany({ where: { userId: buyer.id } });
  await prisma.defaultRecord.create({
    data: { userId: buyer.id, type: '超时未交割', role: '买家', weight: '500', deductAmount: 500000n, penalty: '限制3天 + 降1级', recordStatus: 'active', appealDeadline: new Date(Date.now() + 24 * 3600 * 1000) },
  });

  console.log('✅ seed done: buyer=%s seller=%s listings=%d', buyer.weijinNo, seller.weijinNo, listings.length);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
