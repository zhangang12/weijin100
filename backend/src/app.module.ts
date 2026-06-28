import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { WeChatModule } from './infra/wechat/wechat.module';
import { StorageModule } from './infra/storage/storage.module';
import { SmsModule } from './infra/sms/sms.module';
import { PaymentModule } from './infra/payment/payment.module';
import { MarketModule } from './market/market.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { MarginModule } from './modules/margin/margin.module';
import { LevelModule } from './modules/level/level.module';
import { ListingModule } from './modules/listing/listing.module';
import { AddressModule } from './modules/address/address.module';
import { AlertModule } from './modules/alert/alert.module';
import { LockModule } from './modules/lock/lock.module';
import { OrderModule } from './modules/order/order.module';
import { DefaultModule } from './modules/default/default.module';
import { MockModule } from './mock/mock.module';

/** 根模块。全局基建(config/prisma/auth/infra) + 行情 + 已实现业务模块 + 其余 Mock。 */
@Module({
  imports: [
    // 全局基建
    ConfigModule,
    PrismaModule,
    AuthCoreModule,
    WeChatModule,
    StorageModule,
    SmsModule,
    PaymentModule,
    // 行情
    MarketModule,
    // 已实现业务（真库）
    AuthModule,
    UserModule,
    MarginModule,
    LevelModule,
    ListingModule,
    AddressModule,
    AlertModule,
    LockModule,
    OrderModule,
    DefaultModule,
    // 仅剩通用占位接口
    MockModule,
  ],
})
export class AppModule {}
