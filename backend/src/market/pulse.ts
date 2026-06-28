import { QUOTE_HTTP } from '../config.js';

/** 脉动行情原始字段（仅取我们用到的） */
export interface PulseQuote {
  StockCode: string;
  Price: number;
  Open: number;
  LastClose: number;
  High: number;
  Low: number;
  Time: string;
  LastTime: number;
  Diff: number;
  DiffRate: number;
}

/** HTTP 拉取实时行情（接口二）。code 多个以逗号分隔，最多 50 个。 */
export async function fetchQuotes(codes: string[]): Promise<Record<string, PulseQuote>> {
  const url = `${QUOTE_HTTP}?code=${encodeURIComponent(codes.join(','))}`;
  const res = await fetch(url); // undici 自动协商并解压 gzip
  const json = (await res.json()) as { code: number; msg: string; data?: { body?: PulseQuote[] } };
  const out: Record<string, PulseQuote> = {};
  if (json && json.code === 200 && json.data && Array.isArray(json.data.body)) {
    for (const q of json.data.body) out[q.StockCode] = q;
  } else if (json && json.code !== 200) {
    throw new Error('PulseData: ' + (json.msg || 'error'));
  }
  return out;
}
