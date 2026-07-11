import { levelApi } from '../../../api/index';
import type { LevelInfo, FeeRow } from '../../../types/biz';

/** 由级别推导「累计笔数」区间：每 10 笔升 1 级，L9 封顶为「80+」 */
function levelRange(level: string): string {
  const n = parseInt(level.replace(/[^0-9]/g, ''), 10) || 1;
  const start = (n - 1) * 10;
  if (n >= 9) return `${start}+`;
  return `${start}–${start + 9}`;
}

/** 费率表行（带「累计笔数」与「是否当前级别」标记，供 WXML 展示/高亮） */
interface FeeRowVM extends FeeRow {
  countRange: string;
  current: boolean;
}

interface LevelViewData {
  loading: boolean;
  currentLevel: string;
  completedTrades: number;
  tradesToNext: number;
  progressPercent: number;
  feeWaived: boolean;
  levelHint: string;     // 本级 X–Y 笔 · 再完成 Z 笔升至 L(n+1)
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
    levelHint: '',
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
        countRange: levelRange(row.level),
        current: row.level === info.currentLevel,
      }));
      const n = parseInt(info.currentLevel.replace(/[^0-9]/g, ''), 10) || 1;
      const nextLevel = n >= 9 ? 'L9（已满级）' : `L${n + 1}`;
      const levelHint = n >= 9
        ? `本级 ${levelRange(info.currentLevel)} 笔 · 已达最高等级`
        : `本级 ${levelRange(info.currentLevel)} 笔 · 再完成 ${info.tradesToNext} 笔升至 ${nextLevel}（每 10 笔升 1 级）`;
      this.setData({
        loading: false,
        currentLevel: info.currentLevel,
        completedTrades: info.completedTrades,
        tradesToNext: info.tradesToNext,
        progressPercent: info.progressPercent,
        feeWaived: info.feeWaived,
        levelHint,
        feeRows,
      });
    } catch {
      // 错误提示已在 request 层处理；停留在 loading 态让用户可重试
      this.setData({ loading: false });
    }
  },
});
