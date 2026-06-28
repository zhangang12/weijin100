import { Global, Module } from '@nestjs/common';
import { WeChatService } from './wechat.service';

@Global()
@Module({
  providers: [WeChatService],
  exports: [WeChatService],
})
export class WeChatModule {}
