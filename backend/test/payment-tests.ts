import 'reflect-metadata';
import { strict as assert } from 'assert';
import { createHmac } from 'crypto';
import { platformFeeMinor, validWebhookSignature, captureMatches } from '../src/modules/payments/payment.rules';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentTransactionEntity } from '../src/entities/payment-transaction.entity';
import { CompetitionEntity } from '../src/entities/competition.entity';
import { RolesGuard } from '../src/common/decorators/roles.guard';
import { UserRole } from '../src/common/interfaces';

async function run() {
  assert.equal(platformFeeMinor(10000, 7, 50), 70000);
  assert.equal(platformFeeMinor(0, 7, 50), 5000);
  assert.equal(platformFeeMinor(100.55, 7, 1), 704);
  assert.throws(() => platformFeeMinor(NaN, 7, 50));
  assert.throws(() => platformFeeMinor(0, 0, 0));
  const secret = 'test-secret';
  const payment = { id: 'pay_test', order_id: 'order_test', amount: 70000, currency: 'INR', status: 'captured', captured: true };
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } }));
  const sign = (value: Buffer) => createHmac('sha256', secret).update(value).digest('hex');
  assert(validWebhookSignature(body, sign(body), secret));
  assert(!validWebhookSignature(Buffer.from(body.toString() + ' '), sign(body), secret));
  assert(!validWebhookSignature(body, 'bad', secret));
  assert(!validWebhookSignature(body, sign(body), ''));
  const tx: any = { id: 'tx1', competitionId: 'comp1', type: 'PLATFORM_FEE', userUsername: 'owner', amountMinor: 70000, currency: 'INR', status: 'PENDING', gatewayOrderId: 'order_test' };
  assert(captureMatches(payment, tx));
  assert(!captureMatches({ ...payment, amount: 1 }, tx));
  assert(!captureMatches({ ...payment, currency: 'USD' }, tx));
  assert(!captureMatches({ ...payment, captured: false }, tx));
  const comp: any = { id: 'comp1', name: 'Cup', createdBy: 'owner', organizers: ['owner'], paymentStatus: 'AWAITING_PLATFORM_FEE', organizerPaid: false, platformFee: 700 };
  const writes: any[] = [];
  const manager: any = {
    findOne: async (entity: any) => entity === CompetitionEntity ? comp : tx,
    findOneBy: async (entity: any) => entity === CompetitionEntity ? comp : tx,
    create: (entity: any, values: any) => Object.assign(new entity(), values),
    save: async (value: any) => { writes.push(value); return value; },
  };
  const db: any = { transaction: (callback: any) => callback(manager) };
  let gatewayCalls = 0;
  const service = new PaymentsService(db, { keyId: 'rzp_test', createOrder: async () => { gatewayCalls++; return { id: 'order_new' }; } } as any, { get: (key: string) => key === 'PAYMENT_PROVIDER' ? 'razorpay' : secret } as any);
  await assert.rejects(() => service.initiatePlatformFee('comp1', 'intruder'), /Only this competition/);
  const resumed = await service.initiatePlatformFee('comp1', 'owner');
  assert.equal(resumed.orderId, 'order_test'); assert.equal(gatewayCalls, 0);
  await assert.rejects(() => service.webhook(body, 'invalid'), /Invalid webhook signature/);
  assert.equal(writes.length, 0);
  const wrong = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { ...payment, amount: 1 } } } }));
  await assert.rejects(() => service.webhook(wrong, sign(wrong)), /does not match/);
  assert.equal(writes.length, 0);
  await service.webhook(body, sign(body));
  assert.equal(comp.organizerPaid, true);
  assert.equal(comp.status, 'active');
  assert.equal(tx.status, 'CONFIRMED');
  assert.equal(writes.length, 4); // transaction, competition, revenue, notification
  assert.equal((await service.webhook(body, sign(body))).duplicate, true);
  assert.equal(writes.length, 4);
  const other = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { ...payment, id: 'pay_other' } } } }));
  await assert.rejects(() => service.webhook(other, sign(other)), /different payment/);
  await assert.rejects(() => service.initiatePlatformFee('comp1', 'owner'), /does not require/);
  const mockService = new PaymentsService(db, { createOrder: () => { throw new Error('Mock must never contact Razorpay'); } } as any, { get: (key: string, fallback?: string) => key === 'NODE_ENV' ? 'development' : fallback } as any);
  comp.paymentStatus = 'AWAITING_PLATFORM_FEE'; comp.organizerPaid = false;
  tx.status = 'PENDING'; tx.gatewayOrderId = null; tx.gatewayRefId = null;
  const mockOrder = await mockService.initiatePlatformFee('comp1', 'owner');
  assert.equal(mockOrder.provider, 'mock');
  assert.equal(mockOrder.orderId, 'mock_order_tx1');
  await assert.rejects(() => mockService.simulate('comp1', 'intruder', 'success'), /Only this competition/);
  await mockService.simulate('comp1', 'owner', 'failed');
  assert.equal(tx.status, 'FAILED'); assert.equal(comp.organizerPaid, false);
  await mockService.simulate('comp1', 'owner', 'success');
  assert.equal(tx.status, 'CONFIRMED'); assert.equal(comp.organizerPaid, true);
  assert.equal(tx.gatewayRefId, 'mock_pay_tx1');
  const writeCount = writes.length;
  await mockService.simulate('comp1', 'owner', 'success');
  await mockService.simulate('comp1', 'owner', 'failed');
  assert.equal(writes.length, writeCount);
  await assert.rejects(() => service.simulate('comp1', 'owner', 'success'), /not enabled/);
  await assert.rejects(() => mockService.webhook(body, sign(body)), /disabled in mock mode/);
  const production = new PaymentsService(db, {} as any, { get: (key: string, fallback?: string) => key === 'NODE_ENV' ? 'production' : fallback } as any);
  await assert.rejects(() => production.simulate('comp1', 'owner', 'success'), /disabled in production/);
  const context: any = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.FINANCE_MODERATOR } }) }) };
  assert(new RolesGuard({ getAllAndOverride: () => [UserRole.FINANCE_MODERATOR] } as any).canActivate(context));
  assert.throws(() => new RolesGuard({ getAllAndOverride: () => [UserRole.COMP_ADMIN] } as any).canActivate(context));
  console.log('Payment tests passed: fees, signatures, capture matching, ownership, retries, publication, duplicate delivery, role isolation.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
