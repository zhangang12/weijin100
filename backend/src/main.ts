import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Server } from 'node:http';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { MarketService } from './market/market.service';
import { startMarketWs } from './market/market.ws';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService);
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
