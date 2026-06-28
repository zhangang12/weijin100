import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { MarketService } from './market.service';

/** 行情 WebSocket：/ws/market
 *  客户端：{action:'sub',metals:['gold',...]} 订阅；{ping:ts} 心跳。
 *  服务端：连接即推 snapshot，之后每 2s 推 tick；{pong:ts} 回心跳。
 *  用原生 ws，从 main.ts 在 listen 后挂到 app.getHttpServer()。 */
export function startMarketWs(server: Server, market: MarketService): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/market' });
  wss.on('connection', (ws) => {
    let metals = ['gold', 'silver', 'platinum'];
    ws.send(JSON.stringify({ type: 'snapshot', data: market.allQuotes() }));

    ws.on('message', (buf) => {
      try {
        const m = JSON.parse(buf.toString());
        if (m.ping) {
          ws.send(JSON.stringify({ pong: m.ping }));
          return;
        }
        if (m.action === 'sub' && Array.isArray(m.metals)) metals = m.metals;
      } catch {
        /* ignore */
      }
    });

    const timer = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return;
      const data: Record<string, unknown> = {};
      for (const mm of metals) {
        const sn = market.getQuote(mm);
        if (sn) data[mm] = sn;
      }
      ws.send(JSON.stringify({ type: 'tick', data }));
    }, 2000);

    ws.on('close', () => clearInterval(timer));
  });
  return wss;
}
