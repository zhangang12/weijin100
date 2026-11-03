import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AdminKycController } from './admin-kyc.controller';

@Module({
  controllers: [UserController, AdminKycController],
  providers: [UserService],
})
export class UserModule {}
