/**
 * 接口数据类型（对齐《接口文档方案 v0.1》第二部分）。
 * 字段以后端定稿为准，此处为草案；金额建议以「分」整数传输。
 */

export type Metal = 'gold' | 'silver' | 'platinum';
export type ShipMode = 'whole_all' | 'whole_fixed' | 'bulk'; // 整出全量 / 整出固量 / 散出
export type PayMethod = 'cash' | 'transfer';
export type Trend = 'up' | 'down' | 'flat';
export type Level = `L${number}`;

/** 行情报价快照 */
export interface PriceSnapshot {
  metal: Metal;
  unit: string;            // 元/克
  marketPrice: string;     // 大盘金价
  change: string;          // 涨跌额
  changePercent: string;   // 涨跌幅
  trend: Trend;            // 红涨绿跌
  premium: string;         // 溢价
  dayHigh: string;
  dayLow: string;
  salePrice: string;       // 销售价
  buybackPrice: string;    // 回购价
  sparkline?: number[];
  quoteTime: string;       // ISO8601
  snapshotVersion: string; // 锁价时效校验
}

/** 挂单卖家（脱敏） */
export interface ListingSeller {
  userMasked: string;
  level: Level;
  shopName?: string;
}

/** 挂单（货品）列表项 */
export interface Listing {
  listingId: string;
  seller: ListingSeller;
  metal: Metal;
  category: string;         // 板料/金条/旧料…
  goodsName: string;
  tags: string[];           // 整出/散出/现货…
  totalWeight: number;      // g
  remainingWeight: number;  // 剩余可锁价 g
  shipMode: ShipMode;
  lotSize?: number;         // 整出固量每份 g
  minBatch?: number;        // 散出起批量 g
  priceMode?: string;       // spot=大盘价+溢价 / fixed=一口固定价
  premiumCash?: string;     // 现金溢价（spot）
  premiumTransfer?: string; // 转账溢价（spot）
  floorPrice?: string;      // 最低防守价
  refPriceCash: string;     // 现金参考价
  refPriceTransfer?: string;// 转账参考价（不支持则空）
  supportTransfer: boolean;
}

/** 可购买上限（锁价软约束卡）*/
export interface BuyerLimit {
  buyerLevel: string;       // Lx
  deposit: number;          // 可用保证金（分）
  unitFen: number;          // 保证金单价（分/克）
  maxBuyableQty: number;    // 可购买总数量（g）
  overLimit: boolean;
}

/** 操作资质（静默校验依据） */
export interface Eligibility {
  realName: boolean;
  contact: boolean;
  marginOk: boolean;
  functionStatus: 'normal' | 'limited';
  maxQty?: number;
}

/** 分页响应 */
export interface Paged<T> {
  list: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
