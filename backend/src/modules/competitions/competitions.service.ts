import { Injectable } from '@nestjs/common';
import { CompetitionRepository } from './repositories/competition.repository';
import { CreateCompetitionDto, UpdateCompetitionDto } from './dto/competition.dto';
import { ICompetition } from '@/common/interfaces';

@Injectable()
export class CompetitionsService {
  constructor(private competitionRepository: CompetitionRepository) {}

  async createCompetition(
    createCompetitionDto: CreateCompetitionDto,
  ): Promise<ICompetition> {
    const { name, description, startDate, endDate } = createCompetitionDto;

    return this.competitionRepository.create(
      name,
      description,
      new Date(startDate),
      new Date(endDate),
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
}
