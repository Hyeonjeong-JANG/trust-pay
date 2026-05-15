import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { XrplModule } from '../xrpl/xrpl.module';
import { BusinessModule } from '../business/business.module';
import { PaymentRequestModule } from '../payment-request/payment-request.module';

@Module({
  imports: [XrplModule, BusinessModule, PaymentRequestModule],
  controllers: [EscrowController],
  providers: [EscrowService],
})
export class EscrowModule {}
