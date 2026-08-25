import { Injectable, NotFoundException } from '@nestjs/common';
import { DisputeRepository } from './repositories/dispute.repository';
import { CreateDisputeDto, UpdateDisputeDto } from './dto/dispute.dto';
import { IDispute } from '@/common/interfaces';

@Injectable()
export class DisputesService {
  constructor(private disputeRepository: DisputeRepository) {}

  async createDispute(createDisputeDto: CreateDisputeDto): Promise<IDispute> {
    const { competitionId, teamId, description } = createDisputeDto;

    return this.disputeRepository.create(competitionId, teamId, description);
  }

  async getDisputeById(id: string): Promise<IDispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }
    return dispute;
  }

  async getAllDisputes(): Promise<IDispute[]> {
    return this.disputeRepository.findAll();
  }

  async getDisputesByCompetition(competitionId: string): Promise<IDispute[]> {
    return this.disputeRepository.findByCompetition(competitionId);
  }

  async getDisputesByTeam(teamId: string): Promise<IDispute[]> {
    return this.disputeRepository.findByTeam(teamId);
  }

  async getDisputesByStatus(
    status: 'open' | 'under_review' | 'resolved' | 'escalated',
  ): Promise<IDispute[]> {
    return this.disputeRepository.findByStatus(status);
  }

  async updateDispute(id: string, updateDisputeDto: UpdateDisputeDto): Promise<IDispute> {
    const updates: Partial<IDispute> = {};

    if (updateDisputeDto.status) updates.status = updateDisputeDto.status;
    if (updateDisputeDto.description) updates.description = updateDisputeDto.description;

    return this.disputeRepository.update(id, updates);
  }

  async deleteDispute(id: string): Promise<void> {
    await this.disputeRepository.delete(id);
  }

  async getOpenDisputes(): Promise<IDispute[]> {
    return this.disputeRepository.findByStatus('open');
  }

  async getEscalatedDisputes(): Promise<IDispute[]> {
    return this.disputeRepository.findByStatus('escalated');
  }
}
