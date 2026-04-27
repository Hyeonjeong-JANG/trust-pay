import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UsePipes,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { FinishEscrowDto } from './dto/finish-escrow.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createEscrowSchema, finishEscrowSchema } from '@prepaid-shield/validators';

@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createEscrowSchema))
  create(@Body() dto: CreateEscrowDto) {
    return this.escrowService.create(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.escrowService.findById(id);
  }

  @Post(':id/finish')
  finish(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finishEscrowSchema)) dto: FinishEscrowDto,
  ) {
    return this.escrowService.finishEntry(id, dto.entryMonth);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.escrowService.cancelEscrow(id);
  }

  @Get('consumer/:consumerId')
  findByConsumer(@Param('consumerId') consumerId: string) {
    return this.escrowService.findByConsumer(consumerId);
  }
}
