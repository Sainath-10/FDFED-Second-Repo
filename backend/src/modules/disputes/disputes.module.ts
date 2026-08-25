import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { DisputeRepository } from './repositories/dispute.repository';

@Module({
  controllers: [DisputesController],
  providers: [DisputesService, DisputeRepository],
  exports: [DisputesService, DisputeRepository],
})
export class DisputesModule {}
