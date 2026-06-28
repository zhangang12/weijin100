import { Injectable, Logger } from '@nestjs/common';

/** 短信服务（当前 mock 驱动，仅日志；后续接阿里云短信 driver）。 */
@Injectable()
export class SmsService {
  private readonly log = new Logger('SMS');

  async send(phone: string, template: string, params: Record<string, string> = {}): Promise<void> {
    this.log.log(`[mock-sms] → ${phone} [${template}] ${JSON.stringify(params)}`);
  }
}
