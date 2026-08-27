import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { CompetitionRepository } from './repositories/competition.repository';
import { CompetitionEntity } from '../../entities/competition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompetitionEntity])],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, CompetitionRepository],
  exports: [CompetitionsService, CompetitionRepository],
})
export class CompetitionsModule {}
