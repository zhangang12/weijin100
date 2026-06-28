import { WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import { getQuote, allQuotes } from './market/quote.js';

/** 行情 WebSocket：/ws/market
 *  客户端：{action:'sub',metals:['gold',...]} 订阅；{ping:ts} 心跳。
 *  服务端：连接即推 snapshot，之后每 2s 推 tick；{pong:ts} 回心跳。 */
export function startMarketWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/market' });
  wss.on('connection', (ws) => {
    let metals = ['gold', 'silver', 'platinum'];
    ws.send(JSON.stringify({ type: 'snapshot', data: allQuotes() }));

    ws.on('message', (buf) => {
      try {
        const m = JSON.parse(buf.toString());
        if (m.ping) { ws.send(JSON.stringify({ pong: m.ping })); return; }
        if (m.action === 'sub' && Array.isArray(m.metals)) metals = m.metals;
      } catch { /* ignore */ }
    });

    const timer = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return;
      const data: Record<string, unknown> = {};
      for (const mm of metals) { const sn = getQuote(mm); if (sn) data[mm] = sn; }
      ws.send(JSON.stringify({ type: 'tick', data }));
    }, 2000);

    ws.on('close', () => clearInterval(timer));
  });
}
