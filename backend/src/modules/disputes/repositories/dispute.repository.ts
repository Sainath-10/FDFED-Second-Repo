import { Injectable, NotFoundException } from '@nestjs/common';
import { IDispute } from '@/common/interfaces';

@Injectable()
export class DisputeRepository {
  private disputes: Map<string, IDispute> = new Map();
  private competitionDisputesIndex: Map<string, string[]> = new Map();
  private nextId = 1;

  async create(
    competitionId: string,
    teamId: string,
    description: string,
    reportedBy: string = 'system',
    organizers: string[] = ['organizer'],
  ): Promise<IDispute> {
    const id = String(this.nextId++);

    const dispute: IDispute = {
      id,
      competitionId,
      teamId,
      reportedBy,
      organizers,
      description,
      status: 'open',
      createdAt: new Date(),
    };

    this.disputes.set(id, dispute);

    // Update competition index
    if (!this.competitionDisputesIndex.has(competitionId)) {
      this.competitionDisputesIndex.set(competitionId, []);
    }
    this.competitionDisputesIndex.get(competitionId).push(id);

    return dispute;
  }

  async findById(id: string): Promise<IDispute | null> {
    return this.disputes.get(id) || null;
  }

  async findAll(): Promise<IDispute[]> {
    return Array.from(this.disputes.values());
  }

  async findByCompetition(competitionId: string): Promise<IDispute[]> {
    const disputeIds = this.competitionDisputesIndex.get(competitionId) || [];
    return disputeIds
      .map((id) => this.disputes.get(id))
      .filter((dispute) => dispute !== undefined);
  }

  async findByTeam(teamId: string): Promise<IDispute[]> {
    return Array.from(this.disputes.values()).filter((dispute) => dispute.teamId === teamId);
  }

  async findByOrganizer(organizerId: string): Promise<IDispute[]> {
    return Array.from(this.disputes.values()).filter(
      (dispute) => dispute.organizers && dispute.organizers.includes(organizerId),
    );
  }

  async findByStatus(status: 'open' | 'under_review' | 'resolved' | 'escalated'): Promise<IDispute[]> {
    return Array.from(this.disputes.values()).filter((dispute) => dispute.status === status);
  }

  async update(id: string, updates: Partial<IDispute>): Promise<IDispute> {
    const dispute = this.disputes.get(id);
    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${id} not found`);
    }

    const updated: IDispute = {
      ...dispute,
      ...updates,
      id: dispute.id,
      competitionId: dispute.competitionId,
      reportedBy: dispute.reportedBy,
      organizers: updates.organizers || dispute.organizers || ['organizer'],
      resolutionNotes: updates.resolutionNotes !== undefined ? updates.resolutionNotes : dispute.resolutionNotes,
      resolvedBy: updates.resolvedBy !== undefined ? updates.resolvedBy : dispute.resolvedBy,
      createdAt: dispute.createdAt,
    };

    this.disputes.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const dispute = this.disputes.get(id);
    if (!dispute) return false;

    // Remove from competition index
    const competitionDisputes = this.competitionDisputesIndex.get(dispute.competitionId) || [];
    this.competitionDisputesIndex.set(
      dispute.competitionId,
      competitionDisputes.filter((disputeId) => disputeId !== id),
    );

    return this.disputes.delete(id);
  }

  async count(): Promise<number> {
    return this.disputes.size;
  }

  async countByStatus(status: 'open' | 'under_review' | 'resolved' | 'escalated'): Promise<number> {
    return Array.from(this.disputes.values()).filter((d) => d.status === status).length;
  }
}
