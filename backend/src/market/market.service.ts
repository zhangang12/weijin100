import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { PulseService, type PulseQuote } from './pulse.service';

/** 对齐《接口文档 v0.1》PriceSnapshot */
export interface PriceSnapshot {
  metal: string;
  unit: string;
  marketPrice: string;
  change: string;
  changePercent: string;
  trend: 'up' | 'down' | 'flat';
  premium: string;
  dayHigh: string;
  dayLow: string;
  salePrice: string;
  buybackPrice: string;
  quoteTime: string;
  snapshotVersion: string;
  source: string; // 脉动代码，调试用
}

const METALS = ['gold', 'silver', 'platinum'] as const;
const DEC: Record<string, number> = { gold: 2, silver: 2, platinum: 2 };

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
function toISO(t: string): string {
  return t && t.includes(' ') ? t.replace(' ', 'T') + '+08:00' : t;
}

/** 行情服务：onModuleInit 启动轮询，缓存最近一次快照，失败保留上次缓存。 */
@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  private readonly cache: Record<string, PriceSnapshot> = {};
  private lastOk = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly logger = new Logger(MarketService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly pulse: PulseService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.startPoller();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 脉动原始 → 我们的 PriceSnapshot（含平台派生 销售价/回购价/溢价） */
  private mapSnapshot(metal: string, q: PulseQuote): PriceSnapshot {
    const cfg = this.config.priceCfg[metal] || { premium: 0, buybackSpread: 0 };
    const d = DEC[metal] ?? 2;
    const price = q.Price;
    const sale = price; // 销售价（平台高卖；可叠加溢价，业务 G1 定）
    const buyback = price - cfg.buybackSpread; // 回购价（平台低收；G2 销售>回购）
    return {
      metal,
      unit: '元/克',
      marketPrice: fmt(price, d),
      change: (q.Diff >= 0 ? '+' : '') + fmt(q.Diff, d),
      changePercent: (q.DiffRate >= 0 ? '+' : '') + q.DiffRate + '%',
      trend: q.DiffRate > 0 ? 'up' : q.DiffRate < 0 ? 'down' : 'flat',
      premium: (cfg.premium >= 0 ? '+' : '') + cfg.premium,
      dayHigh: fmt(q.High, d),
      dayLow: fmt(q.Low, d),
      salePrice: fmt(sale, d),
      buybackPrice: fmt(buyback, d),
      quoteTime: toISO(q.Time),
      snapshotVersion: 'v-' + q.LastTime,
      source: q.StockCode,
    };
  }

  /** 拉一次并更新缓存（失败保留上次） */
  async pollOnce(): Promise<void> {
    const codes = METALS.map((m) => this.config.metalCodes[m]).filter(Boolean);
    try {
      const raw = await this.pulse.fetchQuotes(codes);
      let hit = 0;
      for (const m of METALS) {
        const q = raw[this.config.metalCodes[m]];
        if (q) {
          this.cache[m] = this.mapSnapshot(m, q);
          hit++;
          void this.checkAlerts(m, q.Price);
        }
      }
      if (hit) this.lastOk = Date.now();
    } catch {
      // 未授权 / 限时 / 网络：保留上次缓存，由 /market/quote 兜底
    }
  }

  /** 检查并触发价格提醒。触发后禁用提醒（防重复），推送由后续 Sprint 接入。 */
  private async checkAlerts(metal: string, currentPrice: number): Promise<void> {
    try {
      const alerts = await this.prisma.priceAlert.findMany({
        where: { metal: metal as 'gold' | 'silver' | 'platinum', enabled: true },
      });
      const triggered = alerts.filter((a) => {
        const target = Number(a.targetPrice);
        return a.condition === 'above' ? currentPrice >= target : currentPrice <= target;
      });
      if (!triggered.length) return;
      await this.prisma.priceAlert.updateMany({
        where: { id: { in: triggered.map((a) => a.id) } },
        data: { enabled: false },
      });
      this.logger.log(`price alerts triggered: ${triggered.map((a) => a.id).join(', ')} (${metal}=${currentPrice})`);
      // TODO Sprint6: 推送微信订阅消息至 triggered[].userId
    } catch {
      // 告警检查失败不阻断行情轮询
    }
  }

  getQuote(metal = 'gold'): PriceSnapshot | null {
    return this.cache[metal] || null;
  }

  allQuotes(): Record<string, PriceSnapshot> {
    return this.cache;
  }

  quoteHealth() {
    return {
      metals: Object.keys(this.cache),
      lastOkAt: this.lastOk ? new Date(this.lastOk).toISOString() : null,
    };
  }

  /** 启动轮询 */
  private startPoller(): void {
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), this.config.pollMs);
  }
}
