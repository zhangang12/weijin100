import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Server } from 'node:http';
import * as path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { prodConfigProblems } from './config/config';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { MarketService } from './market/market.service';
import { startMarketWs } from './market/market.ws';

// 金额以 BigInt(分) 存储；统一序列化为 JSON 数字。
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this as unknown as bigint);
};

async function bootstrap(): Promise<void> {
  const problems = prodConfigProblems();
  if (problems.length) {
    console.error('生产环境配置不完整，拒绝启动：\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.use((req: { method: string; url: string }, _res: unknown, next: () => void) => {
    if (!req.url.includes('SdkReport')) process.stdout.write(`\x1b[36m${req.method} ${req.url}\x1b[0m\n`);
    next();
  });
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService);
  // 公开图片（商品图/头像）：线上由 nginx 直出 /uploads/，这里供本机开发与容器内自测；证件等私密目录不暴露。
  for (const dir of ['listing', 'avatar']) {
    app.useStaticAssets(path.join(config.uploadDir, dir), { prefix: `/uploads/${dir}/`, maxAge: '7d' });
  }
  const market = app.get(MarketService);
  const port = config.port;

  await app.listen(port);

  // listen 后用原生 ws 把行情 WebSocket 挂到底层 http server（路径 /ws/market）。
  const server = app.getHttpServer() as Server;
  startMarketWs(server, market);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  微金100 后端已启动`);
  console.log(`  REST : http://localhost:${port}/api/v1`);
  console.log(`  WS   : ws://localhost:${port}/ws/market`);
  console.log(`  行情源: ${config.quoteHttp}`);
  console.log(`  自检 : http://localhost:${port}/api/v1/market/quote?metal=gold`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

void bootstrap();
