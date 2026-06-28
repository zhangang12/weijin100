import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketService, type PriceSnapshot } from './market.service';
import * as M from '../mock/mock.data';

/** 行情 / 首页相关接口（真实数据源 + listings + 健康检查）。
 *  控制器路径不带 /api/v1，全局前缀自动添加。 */
@Controller()
export class MarketController {
  constructor(private readonly market: MarketService) {}

  /** 取某金属快照，缺失则回退到 FALLBACK_QUOTE（再回退到 gold）。 */
  private q(metal: string): PriceSnapshot {
    return (
      this.market.getQuote(metal) ||
      M.FALLBACK_QUOTE[metal] ||
      M.FALLBACK_QUOTE.gold
    );
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
  health() {
    return { quote: this.market.quoteHealth(), quotes: this.market.allQuotes() };
  }
}
