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
    createdBy: string = 'system',
    coOrganizers: string[] = [],
  ): Promise<ICompetition> {
    const id = String(this.nextId++);

    // Combine primary creator and co-organizers without duplicates
    const organizersSet = new Set([createdBy, ...(coOrganizers || [])]);

    const competition: ICompetition = {
      id,
      name,
      description,
      startDate,
      endDate,
      status: 'active', // Auto-approved upon creation
      createdBy,
      organizers: Array.from(organizersSet),
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
      (comp) => comp.createdBy === userId || (comp.organizers && comp.organizers.includes(userId)),
    );
  }

  async findByOrganizer(userId: string): Promise<ICompetition[]> {
    return Array.from(this.competitions.values()).filter(
      (comp) => comp.createdBy === userId || (comp.organizers && comp.organizers.includes(userId)),
    );
  }

  async addCoOrganizer(id: string, organizerId: string): Promise<ICompetition> {
    const competition = this.competitions.get(id);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    if (!competition.organizers) {
      competition.organizers = [competition.createdBy];
    }

    if (!competition.organizers.includes(organizerId)) {
      competition.organizers.push(organizerId);
    }

    this.competitions.set(id, competition);
    return competition;
  }

  async removeCoOrganizer(id: string, organizerId: string): Promise<ICompetition> {
    const competition = this.competitions.get(id);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    // Do not allow removing the primary creator
    if (competition.createdBy === organizerId) {
      return competition;
    }

    if (competition.organizers) {
      competition.organizers = competition.organizers.filter((o) => o !== organizerId);
    }

    this.competitions.set(id, competition);
    return competition;
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
      organizers: updates.organizers || competition.organizers || [competition.createdBy],
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
