import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

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

/** 脉动行情 HTTP 抓取（接口二）。 */
@Injectable()
export class PulseService {
  constructor(private readonly config: ConfigService) {}

  /** HTTP 拉取实时行情。code 多个以逗号分隔，最多 50 个。 */
  async fetchQuotes(codes: string[]): Promise<Record<string, PulseQuote>> {
    const url = `${this.config.quoteHttp}?code=${encodeURIComponent(codes.join(','))}`;
    const res = await fetch(url); // undici 自动协商并解压 gzip
    const json = (await res.json()) as {
      code: number;
      msg: string;
      data?: { body?: PulseQuote[] };
    };
    const out: Record<string, PulseQuote> = {};
    if (json && json.code === 200 && json.data && Array.isArray(json.data.body)) {
      for (const q of json.data.body) out[q.StockCode] = q;
    } else if (json && json.code !== 200) {
      throw new Error('PulseData: ' + (json.msg || 'error'));
    }
    return out;
  }
}
