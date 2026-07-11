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
  recordStatus: 'active' | 'repaired' | 'appealing' | 'appealed' | 'revoked';
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
  deliveryMethod: 'face_to_face' | 'relay';
  myConfirmed: boolean;
  peerConfirmed: boolean;
}

export interface RelayStep { title: string; desc: string; state: 'done' | 'cur' | 'todo' }
export interface RelayProgress {
  relayStatus: string;
  feePaid: boolean;
  initiatorRole?: string | null; // 发起方（买家/卖家）
  peerAgreed?: boolean;          // 对方是否已同意
  steps: RelayStep[];
}

export interface Address {
  id: string;
  type: 'receive' | 'pickup'; // 收货 / 取货
  contact: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

export interface PriceAlert {
  id: string;
  metal: 'gold' | 'silver' | 'platinum';
  condition: 'above' | 'below'; // 涨到 / 跌到
  targetPrice: string;
  channels: Array<'push' | 'sms'>;
}
