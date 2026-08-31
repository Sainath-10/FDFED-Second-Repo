import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { UserRepository } from '../modules/auth/repositories/user.repository';
import { CompetitionRepository } from '../modules/competitions/repositories/competition.repository';
import { PoliciesService } from '../modules/policies/policies.service';
import { RevenueService } from '../modules/revenue/revenue.service';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly compRepo: CompetitionRepository,
    private readonly policiesService: PoliciesService,
    private readonly revenueService: RevenueService,
  ) {}

  async onApplicationBootstrap() {
    try {
      console.log('⚡ Running PostgreSQL database seed check...');
      await this.userRepo.seedDemoAccounts();
      await this.compRepo.seedDemoCompetitions();
      await this.policiesService.seedDefaultPolicies();
      
      // Seed initial revenue configuration
      await this.revenueService.getConfig();

      // Seed sample revenue transactions if table is empty
      const txCheck = await this.revenueService.getTransactions({ limit: 1 });
      if (txCheck.total === 0) {
        await this.revenueService.createTransaction({
          competitionId: 'comp-seed-1',
          competitionName: 'Apex Legends Winter Clash',
          organizerName: 'Nexus Operations',
          grossAmount: 1000,
          status: 'CONFIRMED',
        });
        await this.revenueService.createTransaction({
          competitionId: 'comp-seed-2',
          competitionName: 'Valorant Community Cup',
          organizerName: 'Riot Nexus',
          grossAmount: 500,
          status: 'CONFIRMED',
        });
      }

      console.log('✅ PostgreSQL database seeding completed successfully');
    } catch (err) {
      console.error('⚠️ Seeding error (database may not be ready yet):', err.message);
    }
  }
}
