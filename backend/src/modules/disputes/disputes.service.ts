import { Injectable, NotFoundException } from '@nestjs/common';
import { DisputeRepository } from './repositories/dispute.repository';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { CreateDisputeDto, UpdateDisputeDto } from './dto/dispute.dto';
import { IDispute } from '@/common/interfaces';

@Injectable()
export class DisputesService {
  constructor(
    private disputeRepository: DisputeRepository,
    private competitionRepository: CompetitionRepository,
  ) {}

  async createDispute(
    createDisputeDto: CreateDisputeDto,
    reportedBy: string = 'system',
  ): Promise<IDispute> {
    const { competitionId, teamId, description } = createDisputeDto;

    // Look up competition to get primary organizer and all co-organizers
    const comp = await this.competitionRepository.findById(competitionId);
    const organizers = (comp && comp.organizers && comp.organizers.length > 0)
      ? comp.organizers
      : (comp && comp.createdBy ? [comp.createdBy] : ['organizer']);

    return this.disputeRepository.create(
      competitionId,
      teamId,
      description,
      reportedBy,
      organizers,
    );
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

  async getDisputesByOrganizer(organizerId: string): Promise<IDispute[]> {
    return this.disputeRepository.findByOrganizer(organizerId);
  }

  async getDisputesByTeam(teamId: string): Promise<IDispute[]> {
    return this.disputeRepository.findByTeam(teamId);
  }

  async getDisputesByStatus(
    status: 'open' | 'under_review' | 'resolved' | 'escalated',
  ): Promise<IDispute[]> {
    return this.disputeRepository.findByStatus(status);
  }

  async updateDispute(
    id: string,
    updateDisputeDto: UpdateDisputeDto,
    resolvedBy?: string,
  ): Promise<IDispute> {
    const updates: Partial<IDispute> = {};

    if (updateDisputeDto.status) updates.status = updateDisputeDto.status;
    if (updateDisputeDto.description) updates.description = updateDisputeDto.description;
    if (updateDisputeDto.resolutionNotes) updates.resolutionNotes = updateDisputeDto.resolutionNotes;
    if (resolvedBy) updates.resolvedBy = resolvedBy;

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
