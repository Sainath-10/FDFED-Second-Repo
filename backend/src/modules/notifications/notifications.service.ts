import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../../entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
  ) {}

  async create(data: {
    toUsername: string;
    type: string;
    status?: string;
    title: string;
    body?: string;
    meta?: Record<string, any>;
  }): Promise<NotificationEntity> {
    const notif = this.repo.create({
      ...data,
      status: data.status || 'pending',
      body: data.body || '',
      read: false,
    });
    return this.repo.save(notif);
  }

  async getForUser(username: string): Promise<NotificationEntity[]> {
    return this.repo.find({
      where: { toUsername: username },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string): Promise<NotificationEntity> {
    await this.repo.update(id, { read: true });
    return this.repo.findOne({ where: { id } });
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async setStatus(id: string, status: string): Promise<NotificationEntity> {
    await this.repo.update(id, { status, read: true });
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Closes a user's still-pending actionable notifications once the action was
   * answered (from any page), so Alerts never offers buttons that can no
   * longer work. Matches on the notification type and one meta field.
   */
  async resolvePending(username: string, type: string, metaKey: string, metaValue: string, status: 'approved' | 'rejected' | 'info'): Promise<void> {
    await this.repo.createQueryBuilder()
      .update(NotificationEntity)
      .set({ status, read: true })
      .where('lower("toUsername") = lower(:username)', { username })
      .andWhere('type = :type', { type })
      .andWhere('status = :pending', { pending: 'pending' })
      .andWhere(`meta ->> :metaKey = :metaValue`, { metaKey, metaValue: String(metaValue) })
      .execute();
  }

  async markAllRead(username: string): Promise<void> {
    await this.repo.update({ toUsername: username, read: false }, { read: true });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async getUnreadCount(username: string): Promise<number> {
    return this.repo.count({ where: { toUsername: username, read: false } });
  }
}
