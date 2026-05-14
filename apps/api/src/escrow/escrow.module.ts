import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { XrplModule } from '../xrpl/xrpl.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [XrplModule, BusinessModule],
  controllers: [EscrowController],
  providers: [EscrowService],
})
export class EscrowModule {}
