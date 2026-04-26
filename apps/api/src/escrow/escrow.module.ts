import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { XrplModule } from '../xrpl/xrpl.module';

@Module({
  imports: [XrplModule],
  controllers: [EscrowController],
  providers: [EscrowService],
})
export class EscrowModule {}
