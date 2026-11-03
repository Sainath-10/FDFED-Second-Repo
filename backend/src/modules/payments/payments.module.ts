import { LifecycleService } from './lifecycle.service';
import { Global, Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
@Global()
@Module({ controllers: [PaymentsController], providers: [PaymentsService, RazorpayService, LifecycleService], exports: [LifecycleService] })
export class PaymentsModule {}
