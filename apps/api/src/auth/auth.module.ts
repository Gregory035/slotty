import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, AccessTokenGuard],
  exports: [AccessTokenGuard],
})
export class AuthModule {}
