import { Injectable, NotFoundException } from '@nestjs/common';
import { ICompetition } from '@/common/interfaces';

@Injectable()
export class CompetitionRepository {
  private competitions: Map<string, ICompetition> = new Map();
  private nextId = 1;

  async create(
    name: string,
    description: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ICompetition> {
    const id = String(this.nextId++);

    const competition: ICompetition = {
      id,
      name,
      description,
      startDate,
      endDate,
      status: 'draft',
      createdBy: 'system',
      createdAt: new Date(),
    };

    this.competitions.set(id, competition);
    return competition;
  }

  async findById(id: string): Promise<ICompetition | null> {
    return this.competitions.get(id) || null;
  }

  async findAll(): Promise<ICompetition[]> {
    return Array.from(this.competitions.values());
  }

  async findByCreator(userId: string): Promise<ICompetition[]> {
    return Array.from(this.competitions.values()).filter(
      (comp) => comp.createdBy === userId,
    );
  }

  async update(id: string, updates: Partial<ICompetition>): Promise<ICompetition> {
    const competition = this.competitions.get(id);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    const updated: ICompetition = {
      ...competition,
      ...updates,
      id: competition.id,
      createdBy: competition.createdBy,
      createdAt: competition.createdAt,
    };

    this.competitions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.competitions.delete(id);
  }

  async findByStatus(status: 'draft' | 'active' | 'completed'): Promise<ICompetition[]> {
    return Array.from(this.competitions.values()).filter(
      (comp) => comp.status === status,
    );
  }

  async count(): Promise<number> {
    return this.competitions.size;
  }
}
