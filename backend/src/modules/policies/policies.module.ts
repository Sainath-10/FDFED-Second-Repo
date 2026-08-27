import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { PlatformPolicyEntity } from '../../entities/platform-policy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformPolicyEntity])],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
