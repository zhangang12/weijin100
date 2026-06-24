import { levelApi } from '../../../api/index';
import type { LevelInfo, FeeRow } from '../../../types/biz';

/** 费率表行（带「是否当前级别」标记，供 WXML 高亮，避免在模板内做比较运算） */
interface FeeRowVM extends FeeRow {
  current: boolean;
}

interface LevelViewData {
  loading: boolean;
  currentLevel: string;
  completedTrades: number;
  tradesToNext: number;
  progressPercent: number;
  feeWaived: boolean;
  feeRows: FeeRowVM[];
}

Page<LevelViewData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    currentLevel: 'L1',
    completedTrades: 0,
    tradesToNext: 0,
    progressPercent: 0,
    feeWaived: false,
    feeRows: [],
  },

  onLoad() {
    this.load();
  },

  async load() {
    try {
      const info: LevelInfo = await levelApi.getLevel();
      const feeRows: FeeRowVM[] = info.feeTable.map((row) => ({
        ...row,
        current: row.level === info.currentLevel,
      }));
      this.setData({
        loading: false,
        currentLevel: info.currentLevel,
        completedTrades: info.completedTrades,
        tradesToNext: info.tradesToNext,
        progressPercent: info.progressPercent,
        feeWaived: info.feeWaived,
        feeRows,
      });
    } catch {
      // 错误提示已在 request 层处理；停留在 loading 态让用户可重试
      this.setData({ loading: false });
    }
  },
});
