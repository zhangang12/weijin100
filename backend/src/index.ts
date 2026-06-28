import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { PORT, QUOTE_HTTP } from './config.js';
import { registerRoutes } from './routes.js';
import { startMarketWs } from './ws.js';
import { startPoller } from './market/quote.js';

const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (_req, res) => res.json({ name: '微金100 backend', ok: true, api: '/api/v1', ws: '/ws/market' }));
registerRoutes(app);

const server = http.createServer(app);
startMarketWs(server);
startPoller(); // 启动行情轮询（真实数据源）

server.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  微金100 后端已启动`);
  console.log(`  REST : http://localhost:${PORT}/api/v1`);
  console.log(`  WS   : ws://localhost:${PORT}/ws/market`);
  console.log(`  行情源: ${QUOTE_HTTP}`);
  console.log(`  自检 : http://localhost:${PORT}/api/v1/market/quote?metal=gold`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
