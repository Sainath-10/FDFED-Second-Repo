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
