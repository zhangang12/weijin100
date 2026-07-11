/** 我的 / 订单 等模块的数据模型（对齐 v0.1，字段以后端定稿为准） */

export interface Profile {
  userId: string;
  weijinNo: string;        // 微金号，唯一不可改
  nickname: string;
  avatar?: string;
  level: string;           // L1~L9
  completedTrades: number;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  realNameMasked?: string;
  phone?: string;
  wechat?: string;
  functionStatus: 'normal' | 'limited';
}

export interface MarginAccount {
  totalBalance: number;    // 分
  available: number;
  frozen: number;
  refundable: number;
  quota: { gold: number; silver: number; platinum: number }; // g
}

export type OrderTab = 'selling' | 'locked_pending' | 'completed';
export type OrderStatus =
  | 'selling' | 'locked_pending' | 'completed'
  | 'relay_inspecting' | 'arbitrating' | 'cancelled';

export interface OrderItem {
  orderNo: string;
  side: 'buy' | 'sell';
  status: OrderStatus;
  metal: string;
  productName: string;
  weight: number;          // g
  remainingWeight?: number; // 剩余可锁（销售中 tab）
  shipMode?: string;       // 出货方式（销售中 tab）
  priceCash: string;       // 元/克
  priceTransfer?: string;
  supportsTransfer: boolean;
  totalCash: number;       // 分
  totalTransfer?: number;
  countdownRemaining?: number; // 秒（锁价待处理）
  counterpartyMasked?: string;
  counterpartyLevel?: string;
  createTime: string;      // ISO8601
  completeTime?: string;
}
