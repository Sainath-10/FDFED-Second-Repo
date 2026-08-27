import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchEntity } from '../../entities/match.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MatchEntity])],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
