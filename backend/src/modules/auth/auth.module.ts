import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepository } from './repositories/user.repository';
import { JwtStrategy } from '../../common/guards/jwt.strategy';
import { UserEntity } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, JwtStrategy],
  exports: [AuthService, UserRepository],
})
export class AuthModule {}
