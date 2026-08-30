import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { RevenueRepository } from './repositories/revenue.repository';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { SetCompetitionFeeDto, RecordPaymentDto } from './dto/revenue.dto';
import { ICompetitionFee, ITransaction } from '@/common/interfaces';
import { FileLoggerService } from '@/common/logger/file-logger.service';

@Injectable()
export class RevenueService {
  constructor(
    private revenueRepository: RevenueRepository,
    private competitionRepository: CompetitionRepository,
    private fileLogger: FileLoggerService,
  ) {}

  /**
   * Calculates platform fee: max(₹50, 7% of prize pool)
   */
  calculatePlatformFee(prizePool: number): { platformFee: number; percentageFee: number; appliedRate: string } {
    const rawPct = Math.round(Number(prizePool) * 0.07 * 100) / 100;
    const platformFee = Math.max(50, rawPct);
    const appliedRate = rawPct >= 50 ? '7% of Prize Pool' : '₹50 Minimum Flat Fee';

    return {
      platformFee,
      percentageFee: rawPct,
      appliedRate,
    };
  }

  async setCompetitionFee(
    competitionId: string,
    dto: SetCompetitionFeeDto,
  ): Promise<ICompetitionFee> {
    const comp = await this.competitionRepository.findById(competitionId);
    if (!comp) {
      throw new NotFoundException(`Competition ${competitionId} not found`);
    }

    const { entryFee, prizePool, currency = 'INR' } = dto;
    if (entryFee < 0 || prizePool < 0) {
      throw new BadRequestException('Entry fee and prize pool must be non-negative.');
    }

    const { platformFee, appliedRate } = this.calculatePlatformFee(prizePool);

    this.fileLogger.log(
      `Set competition fee for "${comp.name}": Prize Pool = ₹${prizePool}, Platform Fee = ₹${platformFee} (${appliedRate})`,
      'RevenueService',
      { competitionId, prizePool, platformFee, appliedRate },
    );

    return this.revenueRepository.upsertFee(
      competitionId,
      entryFee,
      prizePool,
      platformFee,
      7.0,
      currency,
      false,
    );
  }

  async getCompetitionFee(competitionId: string): Promise<ICompetitionFee> {
    const fee = await this.revenueRepository.findFeeByCompetitionId(competitionId);
    if (!fee) {
      // Return default calculated fee (entry: 0, prize: 0, platform_fee: 50)
      return {
        id: 'default',
        competitionId,
        entryFee: 0,
        prizePool: 0,
        platformFee: 50,
        platformFeePct: 7.0,
        currency: 'INR',
        feePaid: false,
        createdAt: new Date(),
      };
    }
    return fee;
  }

  async payPlatformFee(competitionId: string): Promise<{ fee: ICompetitionFee; transaction: ITransaction }> {
    const comp = await this.competitionRepository.findById(competitionId);
    if (!comp) throw new NotFoundException(`Competition ${competitionId} not found`);

    let fee = await this.revenueRepository.findFeeByCompetitionId(competitionId);
    if (!fee) {
      fee = await this.setCompetitionFee(competitionId, { entryFee: 0, prizePool: 0 });
    }

    const updatedFee = await this.revenueRepository.setFeePaid(competitionId, true);
    const transaction = await this.revenueRepository.createTransaction(
      competitionId,
      null,
      'platform_fee',
      fee.platformFee,
      fee.currency,
      `Platform fee paid by organizer for competition "${comp.name}" [max(₹50, 7% of ₹${fee.prizePool})]`,
    );

    this.fileLogger.log(
      `Platform fee ₹${fee.platformFee} paid for tournament "${comp.name}"`,
      'RevenueService',
      { competitionId, amount: fee.platformFee, transactionId: transaction.id },
    );

    return { fee: updatedFee, transaction };
  }

  async recordPayment(
    competitionId: string,
    dto: RecordPaymentDto,
  ): Promise<ITransaction> {
    const comp = await this.competitionRepository.findById(competitionId);
    const compName = comp ? comp.name : competitionId;

    const transaction = await this.revenueRepository.createTransaction(
      competitionId,
      dto.teamId || null,
      dto.type,
      dto.amount,
      'INR',
      dto.description || `${dto.type} recorded for competition "${compName}"`,
    );

    if (dto.type === 'platform_fee') {
      await this.revenueRepository.setFeePaid(competitionId, true).catch(() => {});
    }

    return transaction;
  }

  async getRevenueStats(): Promise<any> {
    return this.revenueRepository.getRevenueStats();
  }

  async getTransactions(competitionId?: string): Promise<ITransaction[]> {
    return this.revenueRepository.findAllTransactions(competitionId);
  }
}
