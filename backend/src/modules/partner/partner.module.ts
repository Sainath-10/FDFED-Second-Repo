import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';
import { WebhookNotifierService } from './webhook-notifier.service';
import { PartnerApiKeyMiddleware } from './partner-api-key.middleware';

@Module({
  controllers: [PartnerController],
  providers: [PartnerService, WebhookNotifierService],
  exports: [WebhookNotifierService],
})
export class PartnerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Router-level B2B middleware: API key auth applied only to /partner/* routes
    consumer.apply(PartnerApiKeyMiddleware).forRoutes(PartnerController);
  }
}
