import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformPolicyEntity } from '../../entities/platform-policy.entity';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(PlatformPolicyEntity)
    private readonly repo: Repository<PlatformPolicyEntity>,
  ) {}

  async create(data: {
    title: string;
    content: string;
    category?: string;
    version?: string;
    createdBy: string;
    compliance?: number;
  }): Promise<PlatformPolicyEntity> {
    const policy = this.repo.create({ ...data, active: true });
    return this.repo.save(policy);
  }

  async findAll(activeOnly = false): Promise<PlatformPolicyEntity[]> {
    const where = activeOnly ? { active: true } : {};
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<PlatformPolicyEntity> {
    const policy = await this.repo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException(`Policy ${id} not found`);
    return policy;
  }

  async update(id: string, updates: Partial<PlatformPolicyEntity>): Promise<PlatformPolicyEntity> {
    const { id: _id, createdAt: _ca, createdBy: _cb, ...safeUpdates } = updates as any;
    await this.repo.update(id, safeUpdates);
    return this.findById(id);
  }

  async archive(id: string): Promise<PlatformPolicyEntity> {
    await this.repo.update(id, { active: false });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async seedDefaultPolicies(createdBy = 'superadmin@nexus.gg'): Promise<void> {
    const defaults = [
      { title: 'Fair Play Standards', content: 'All participants must adhere to fair play. Cheating, exploitation of bugs, and unsportsmanlike conduct are strictly prohibited.', category: 'CONDUCT', version: 'V1.0', compliance: 95 },
      { title: 'Tournament Code of Conduct', content: 'Players and teams must maintain respectful communication. Harassment, hate speech, or discriminatory behavior will result in immediate disqualification.', category: 'CONDUCT', version: 'V2.1', compliance: 88 },
      { title: 'Prize Pool Distribution Guidelines', content: 'Prize pools are distributed within 14 business days after tournament completion. Platform fee of 10% applies. All taxes are the responsibility of winners.', category: 'FINANCIAL', version: 'V2.1', compliance: 98 },
      { title: 'Data Privacy and Protection Standards', content: 'Guidelines for handling player data, GDPR compliance, and privacy protection measures. User data is never sold to third parties.', category: 'PRIVACY', version: 'V2.0', compliance: 100 },
    ];

    for (const p of defaults) {
      const existing = await this.repo.findOne({ where: { title: p.title } });
      if (!existing) {
        await this.create({ ...p, createdBy });
        console.log(`✓ Seeded policy: ${p.title}`);
      }
    }
  }
}
