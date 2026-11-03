import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RazorpayService {
  constructor(private readonly config: ConfigService) {}

  get keyId(): string { return this.config.get<string>('RAZORPAY_KEY_ID'); }

  async createOrder(amount: number, receipt: string): Promise<{ id: string; amount: number; currency: string }> {
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!this.keyId || !secret || !this.config.get<string>('RAZORPAY_WEBHOOK_SECRET')) {
      throw new ServiceUnavailableException('Payment gateway is not configured. Your draft is saved; contact the platform team.');
    }
    try {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${this.keyId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR', receipt }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Order creation rejected');
      const order = await response.json() as any;
      if (typeof order.id !== 'string' || !order.id.startsWith('order_') || order.amount !== amount || order.currency !== 'INR') throw new Error('Invalid gateway response');
      return order;
    } catch {
      throw new ServiceUnavailableException('Could not create a payment order. Retry from your saved draft.');
    }
  }
}
