import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepository } from './repositories/user.repository';
import { JwtTokenService } from './jwt-token.service';
import { LoggerModule } from '@/common/logger/logger.module';

@Module({
  imports: [LoggerModule],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, JwtTokenService],
  exports: [AuthService, UserRepository, JwtTokenService],
})
export class AuthModule {}
