import { WS_URL } from '../config/env';
import type { PriceSnapshot } from '../types/api';

type TickCallback = (quote: PriceSnapshot) => void;

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
const PING_INTERVAL_MS = 25000;

/** 行情 WebSocket 封装。USE_MOCK=true 时跳过连接，由 REST 兜底。 */
export class MarketSocket {
  private task: WechatMiniprogram.SocketTask | null = null;
  private metals: string[];
  private onTick: TickCallback;
  private retryCount = 0;
  private closed = false;
  private isOpen = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(metals: string[], onTick: TickCallback) {
    this.metals = metals;
    this.onTick = onTick;
  }

  connect(): void {
    if (this.closed) return;
    this.task = wx.connectSocket({
      url: WS_URL,
      fail: () => this.scheduleReconnect(),
    });

    this.task.onOpen(() => {
      this.retryCount = 0;
      this.isOpen = true;
      this.task!.send({ data: JSON.stringify({ action: 'sub', metals: this.metals }) });
      this.startPing();
    });

    this.task.onMessage((ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as {
          type?: string;
          pong?: number;
          data?: Record<string, PriceSnapshot>;
        };
        if (msg.type === 'snapshot' || msg.type === 'tick') {
          for (const metal of this.metals) {
            const q = msg.data?.[metal];
            if (q) this.onTick(q);
          }
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    this.task.onError(() => {
      this.isOpen = false;
      this.scheduleReconnect();
    });
    this.task.onClose(() => {
      this.isOpen = false;
      this.clearPing();
      if (!this.closed) this.scheduleReconnect();
    });
  }

  close(): void {
    this.closed = true;
    this.isOpen = false;
    this.clearPing();
    this.task?.close({});
    this.task = null;
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.isOpen) {
        this.task?.send({ data: JSON.stringify({ ping: Date.now() }) });
      }
    }, PING_INTERVAL_MS);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = RECONNECT_DELAYS[Math.min(this.retryCount, RECONNECT_DELAYS.length - 1)];
    this.retryCount++;
    setTimeout(() => this.connect(), delay);
  }
}
