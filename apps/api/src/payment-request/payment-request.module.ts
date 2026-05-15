import { Module } from '@nestjs/common';
import { PaymentRequestController } from './payment-request.controller';
import { PaymentRequestService } from './payment-request.service';

@Module({
  controllers: [PaymentRequestController],
  providers: [PaymentRequestService],
  exports: [PaymentRequestService],
})
export class PaymentRequestModule {}
