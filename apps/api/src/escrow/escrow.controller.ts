import {
  Controller,
  Post,
  Get,
  Param,
  Body,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { FinishEscrowDto } from './dto/finish-escrow.dto';

@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  create(@Body() dto: CreateEscrowDto) {
    return this.escrowService.create(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.escrowService.findById(id);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string, @Body() dto: FinishEscrowDto) {
    return this.escrowService.finishEntry(id, dto.entryMonth);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.escrowService.cancelEscrow(id);
  }

  @Get('consumer/:address')
  findByConsumer(@Param('address') address: string) {
    return this.escrowService.findByConsumer(address);
  }
}
