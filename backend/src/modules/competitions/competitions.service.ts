import { Injectable, BadRequestException } from '@nestjs/common';
import { CompetitionRepository } from './repositories/competition.repository';
import { CreateCompetitionDto, UpdateCompetitionDto } from './dto/competition.dto';
import { ICompetition } from '../../common/interfaces';

@Injectable()
export class CompetitionsService {
  constructor(private competitionRepository: CompetitionRepository) {}

  async createCompetition(
    createCompetitionDto: CreateCompetitionDto,
    createdBy: string = 'system',
  ): Promise<ICompetition> {
    const { name, description, startDate, endDate, coOrganizers, ...extras } = createCompetitionDto;

    if (!name || name.trim().length < 3) {
      throw new BadRequestException('Tournament name must be at least 3 characters.');
    }
    if (!description || description.trim().length < 10) {
      throw new BadRequestException('Tournament description must be at least 10 characters.');
    }
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      throw new BadRequestException('Valid tournament start date is required for auto-approval.');
    }
    if (!endDate || isNaN(new Date(endDate).getTime())) {
      throw new BadRequestException('Valid tournament end date is required for auto-approval.');
    }

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    if (sDate >= eDate) {
      throw new BadRequestException('Tournament End Date must be strictly after Start Date.');
    }

    return this.competitionRepository.create(
      name.trim(),
      description.trim(),
      sDate,
      eDate,
      createdBy,
      coOrganizers || [],
      extras,
    );
  }

  async getCompetitionById(id: string): Promise<ICompetition> {
    return this.competitionRepository.findById(id);
  }

  async getAllCompetitions(): Promise<ICompetition[]> {
    return this.competitionRepository.findAll();
  }

  async getCompetitionsByUser(userId: string): Promise<ICompetition[]> {
    return this.competitionRepository.findByCreator(userId);
  }

  async getCompetitionsByOrganizer(userId: string): Promise<ICompetition[]> {
    return this.competitionRepository.findByOrganizer(userId);
  }

  async addCoOrganizer(id: string, organizerId: string): Promise<ICompetition> {
    return this.competitionRepository.addCoOrganizer(id, organizerId);
  }

  async removeCoOrganizer(id: string, organizerId: string): Promise<ICompetition> {
    return this.competitionRepository.removeCoOrganizer(id, organizerId);
  }

  async updateCompetition(
    id: string,
    updateCompetitionDto: UpdateCompetitionDto,
  ): Promise<ICompetition> {
    const updates: Partial<ICompetition> = {};

    if (updateCompetitionDto.name) updates.name = updateCompetitionDto.name;
    if (updateCompetitionDto.description) updates.description = updateCompetitionDto.description;
    if (updateCompetitionDto.status) updates.status = updateCompetitionDto.status;
    if (updateCompetitionDto.endDate) updates.endDate = new Date(updateCompetitionDto.endDate);

    return this.competitionRepository.update(id, updates);
  }

  async deleteCompetition(id: string): Promise<void> {
    await this.competitionRepository.delete(id);
  }

  async getActiveCompetitions(): Promise<ICompetition[]> {
    return this.competitionRepository.findByStatus('active');
  }

  async setApproval(id: string, decision: string, adminUsername: string): Promise<ICompetition> {
    return this.competitionRepository.setApproval(id, decision, adminUsername);
  }
}
