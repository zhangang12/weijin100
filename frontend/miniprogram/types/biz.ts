/** 深页业务模型（实名/级别/违约/订单详情/代交接/发布），字段以后端定稿为准 */
import type { OrderItem } from './models';

export interface KycInfo {
  status: 'none' | 'pending' | 'verified' | 'rejected';
  realName?: string;
  idCardNo?: string;
}

export interface FeeRow { level: string; gold: string; silver: string; platinum: string }
export interface LevelInfo {
  currentLevel: string;
  completedTrades: number;
  tradesToNext: number;
  progressPercent: number;
  feeTable: FeeRow[];
  feeWaived: boolean; // 运营期免佣
}

export interface DefaultRecord {
  id: string;
  type: string;           // 超时未交割 / 单方取消 …
  role: '买家' | '卖家';
  weight: number;         // g
  deductAmount: number;   // 分
  penalty: string;        // 限制3天+降1级 …
  relatedOrderNo: string;
  recordStatus: 'active' | 'repaired' | 'appealed';
  appealDeadline?: string;
  createTime: string;
}
export interface DefaultSummary {
  defaultCount12m: number;
  functionStatus: 'normal' | 'limited';
  limitedDaysLeft?: number;
  tradesToRepair: number;
}

export interface Counterparty {
  role: '买家' | '卖家';
  userMasked: string;
  level: string;
  region?: string;
  phone: string;
  wechat: string;
  address: string;
}
export interface OrderDetail extends OrderItem {
  counterparty: Counterparty;
  deliveryMethod: 'face_to_face' | 'platform_relay';
  myConfirmed: boolean;
  peerConfirmed: boolean;
}

export interface RelayStep { title: string; desc: string; state: 'done' | 'cur' | 'todo' }
export interface RelayProgress {
  relayStatus: string;
  feePaid: boolean;
  steps: RelayStep[];
}
