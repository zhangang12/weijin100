import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketService, type PriceSnapshot } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { BizException } from '../common/biz-exception';
import * as M from '../mock/mock.data';

/** 行情 / 首页相关接口（真实数据源 + listings + 健康检查）。
 *  控制器路径不带 /api/v1，全局前缀自动添加。 */
@Controller()
export class MarketController {
  constructor(
    private readonly market: MarketService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 取某金属快照。生产环境取不到实时行情直接报错（不能拿写死的价格误导用户）；
   * 开发环境回退到 FALLBACK_QUOTE（再回退到 gold），便于行情源限时不可用时联调。
   */
  private q(metal: string): PriceSnapshot {
    const snap = this.market.getQuote(metal);
    if (snap) return snap;
    if (this.config.isProd) throw new BizException('金价暂时无法获取，请稍后再试', 'QUOTE_UNAVAILABLE', 5004);
    return M.FALLBACK_QUOTE[metal] || M.FALLBACK_QUOTE.gold;
  }

  // ---- 行情 / 首页（真实数据源）----
  @Get('market/quote')
  marketQuote(@Query('metal') metal?: string) {
    return this.q(String(metal || 'gold'));
  }

  // 挂单列表/详情已迁真库 → ListingModule

  // ---- 买家锁价（实时报价走真实数据源）----
  @Get('lock/quote/:metal')
  lockQuote(@Param('metal') metal: string) {
    return this.q(metal);
  }

  // ---- 健康检查 ----
  @Get('health')
  async health() {
    let db: 'ok' | 'error' = 'error';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch {
      /* db down */
    }
    return { db, quote: this.market.quoteHealth(), quotes: this.market.allQuotes() };
  }
}
