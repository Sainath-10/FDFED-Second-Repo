import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { TeamsModule } from './modules/teams/teams.module';
import { DisputesModule } from './modules/disputes/disputes.module';

@Module({
  imports: [AuthModule, CompetitionsModule, TeamsModule, DisputesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
