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
      console.log('Running database seed check...');
      await this.userRepo.seedDemoAccounts();
      await this.compRepo.seedDemoCompetitions();
      await this.policiesService.seedDefaultPolicies();
      
      // Seed initial revenue configuration
      await this.revenueService.getConfig();

      console.log('Database seed check complete');
    } catch (err) {
      console.error('⚠️ Seeding error (database may not be ready yet):', err.message);
    }
  }
}
