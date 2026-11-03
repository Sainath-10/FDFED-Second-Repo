import { LifecycleService } from './lifecycle.service';
import { UserEntity } from '../../entities/user.entity';
import { Optional, Injectable, BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CompetitionEntity } from '../../entities/competition.entity';
import { PaymentTransactionEntity } from '../../entities/payment-transaction.entity';
import { RevenueTransactionEntity } from '../../entities/revenue-transaction.entity';
import { NotificationEntity } from '../../entities/notification.entity';
import { AdminActivityLogEntity } from '../../entities/admin-activity-log.entity';
import { RazorpayService } from './razorpay.service';
import { captureMatches, validWebhookSignature } from './payment.rules';

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DataSource, private readonly gateway: RazorpayService, private readonly config: ConfigService, @Optional() private readonly lifecycle?: LifecycleService) {}

  get provider(): 'mock' | 'razorpay' {
    const mode = this.config.get<string>('PAYMENT_PROVIDER', 'mock');
    if (mode !== 'mock' && mode !== 'razorpay') throw new BadRequestException('Unknown payment provider');
    if (mode === 'mock' && this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Mock payments are disabled in production.');
    }
    return mode;
  }

  private assertOwner(comp: CompetitionEntity, username: string) {
    if (comp.createdBy !== username && !(comp.organizers || []).includes(username)) throw new ForbiddenException('Only this competition’s organizers can initiate its payment.');
  }

  async initiatePlatformFee(id: string, username: string) {
    const provider = this.provider;
    // Serialize orders per competition, including concurrent retries.
    return this.db.transaction(async manager => {
      const comp = await manager.findOne(CompetitionEntity, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!comp) throw new NotFoundException('Competition not found');
      this.assertOwner(comp, username);
      if (comp.paymentStatus !== 'AWAITING_PLATFORM_FEE' || comp.organizerPaid) throw new BadRequestException('This competition does not require a platform fee payment.');
      let tx = await manager.findOneBy(PaymentTransactionEntity, { competitionId: id, type: 'PLATFORM_FEE' });
      if (!tx) {
        tx = manager.create(PaymentTransactionEntity, { competitionId: id, userUsername: username, type: 'PLATFORM_FEE', amountMinor: Math.round(Number(comp.platformFee) * 100) });
        if (!Number.isSafeInteger(tx.amountMinor) || tx.amountMinor < 100) throw new BadRequestException('Invalid platform fee');
        tx = await manager.save(tx);
      }
      if (!tx.gatewayOrderId) {
        const order = provider === 'mock' ? { id: `mock_order_${tx.id}` } : await this.gateway.createOrder(tx.amountMinor, tx.id);
        tx.gatewayOrderId = order.id;
        await manager.save(tx);
      }
      if (tx.gatewayOrderId.startsWith('mock_order_') !== (provider === 'mock')) throw new BadRequestException('This order belongs to a different payment provider.');
      return { provider, transactionId: tx.id, orderId: tx.gatewayOrderId, amount: tx.amountMinor, currency: tx.currency, keyId: provider === 'razorpay' ? this.gateway.keyId : undefined };
    });
  }

  async webhook(rawBody: Buffer, signature: string) {
    if (this.provider !== 'razorpay') throw new ForbiddenException('Gateway webhooks are disabled in mock mode.');
    if (!validWebhookSignature(rawBody, signature, this.config.get<string>('RAZORPAY_WEBHOOK_SECRET'))) throw new UnauthorizedException('Invalid webhook signature');
    let event: any;
    try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw new BadRequestException('Invalid webhook payload'); }
    if (event.event !== 'payment.captured') return { received: true, ignored: true };
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id) throw new BadRequestException('Missing payment order');
    return this.db.transaction(async manager => {
      const existing = await manager.findOneBy(PaymentTransactionEntity, { gatewayOrderId: payment.order_id });
      if (!existing) throw new BadRequestException('Unknown payment order');
      const comp = await manager.findOne(CompetitionEntity, { where: { id: existing.competitionId }, lock: { mode: 'pessimistic_write' } });
      const tx = await manager.findOne(PaymentTransactionEntity, { where: { id: existing.id }, lock: { mode: 'pessimistic_write' } });
      if (!captureMatches(payment, tx)) throw new BadRequestException('Payment amount, currency, or capture status does not match');
      if (tx.status === 'CONFIRMED') {
        if (tx.gatewayRefId !== payment.id) throw new BadRequestException('Order already confirmed with a different payment');
        return { received: true, duplicate: true };
      }
      return this.confirm(manager, comp, tx, payment.id, false);
    });
  }

  async simulate(id: string, username: string, outcome: 'success' | 'failed') {
    if (this.provider !== 'mock') throw new ForbiddenException('Mock payments are not enabled.');
    return this.db.transaction(async manager => {
      const comp = await manager.findOne(CompetitionEntity, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!comp) throw new NotFoundException('Competition not found');
      this.assertOwner(comp, username);
      const tx = await manager.findOne(PaymentTransactionEntity, { where: { competitionId: id, type: 'PLATFORM_FEE' }, lock: { mode: 'pessimistic_write' } });
      if (!tx?.gatewayOrderId?.startsWith('mock_order_')) throw new BadRequestException('Create a mock order first.');
      if (tx.status === 'CONFIRMED') return { received: true, duplicate: true, mock: true };
      if (comp.paymentStatus !== 'AWAITING_PLATFORM_FEE') throw new BadRequestException('Competition is not awaiting payment');
      if (outcome === 'failed') {
        tx.status = 'FAILED';
        await manager.save(tx);
        return { received: true, mock: true, status: 'FAILED' };
      }
      return this.confirm(manager, comp, tx, `mock_pay_${tx.id}`, true);
    });
  }

  private async confirm(manager: EntityManager, comp: CompetitionEntity, tx: PaymentTransactionEntity, reference: string, mock: boolean) {
      if (!comp || comp.paymentStatus !== 'AWAITING_PLATFORM_FEE' || tx.type !== 'PLATFORM_FEE') throw new BadRequestException('Competition is not awaiting this payment');
      tx.status = 'CONFIRMED'; tx.gatewayRefId = reference; tx.paidAt = new Date();
      comp.organizerPaid = true; comp.platformFeeTransactionId = tx.id;
      comp.paymentStatus = 'OPEN_FOR_REGISTRATION'; comp.status = 'active';
      // Nothing to deposit, so a zero prize pool must not trigger the unfunded-prize auto-cancel.
      if (!Number(comp.prize)) { comp.prizePoolPaid = true; comp.prizePoolPaidAt = tx.paidAt; }
      await manager.save(tx);
      await manager.save(comp);
      await manager.save(manager.create(RevenueTransactionEntity, {
        competitionId: comp.id, competitionName: comp.name, organizerName: tx.userUsername,
        grossAmount: tx.amountMinor / 100, platformFee: tx.amountMinor / 100,
        netPayout: 0, status: 'CONFIRMED', date: tx.paidAt,
      }));
      // The lifecycle sends the email + notification when available; this is the fallback.
      if (!this.lifecycle) await manager.save(manager.create(NotificationEntity, {
        toUsername: comp.createdBy, type: 'competition-live', status: 'info', title: 'Competition live',
        body: `${mock ? 'Mock platform fee simulated' : 'Platform fee received'} for "${comp.name}". Your competition is published.`, meta: { compId: comp.id, transactionId: tx.id, mock, category: 'payment' },
      }));
      if (this.lifecycle) {
        await this.lifecycle.notify(manager,comp,comp.createdBy,'competition-live','', 'Platform fee confirmed. Fund the prize pool before play starts.');
        for(const subscriber of await manager.find(UserEntity,{where:{competitionAlerts:true,banned:false}})) await this.lifecycle.notify(manager,comp,subscriber.username,'new-competition-alert','', 'A new competition is available for registration.');
      }
      return { received: true };
  }

  async status(id: string, user: any) {
    const comp = await this.db.getRepository(CompetitionEntity).findOneBy({ id });
    if (!comp) throw new NotFoundException('Competition not found');
    if (!['finance_moderator', 'revenue_admin', 'super_admin'].includes(user.role)) this.assertOwner(comp, user.username);
    const transactions = await this.db.getRepository(PaymentTransactionEntity).find({ where: { competitionId: id }, order: { createdAt: 'DESC' } });
    return { provider: this.provider, competitionId: id, paymentStatus: comp.paymentStatus, platformFeePaid: comp.organizerPaid, platformFeeAmount: comp.platformFee, transactions };
  }

  async transactions(page = 1) {
    const limit = 25;
    const [items, total] = await this.db.getRepository(PaymentTransactionEntity).findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: (page - 1) * limit });
    return { items, total, page, limit };
  }

  async review(id: string, username: string, note: string) {
    if (!await this.db.getRepository(PaymentTransactionEntity).existsBy({ id })) throw new NotFoundException('Transaction not found');
    return this.db.getRepository(AdminActivityLogEntity).save({ adminUsername: username, actionType: 'PAYMENT_REVIEW', details: note.trim(), metadata: { transactionId: id } });
  }
}
