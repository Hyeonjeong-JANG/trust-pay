import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UsePipes,
  UseGuards,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { FinishEscrowDto } from './dto/finish-escrow.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createEscrowSchema, finishEscrowSchema } from '@prepaid-shield/validators';
import { AuthGuard } from '../common/auth.guard';

@Controller('escrow')
@UseGuards(AuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createEscrowSchema))
  create(@Body() dto: CreateEscrowDto, @Req() req: any) {
    return this.escrowService.create(dto, req.user);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: any) {
    return this.escrowService.findById(id, req.user);
  }

  @Post(':id/finish')
  finish(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finishEscrowSchema)) dto: FinishEscrowDto,
    @Req() req: any,
  ) {
    return this.escrowService.finishEntry(id, dto.entryMonth, req.user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.escrowService.cancelEscrow(id, req.user);
  }

  @Get('consumer/:consumerId')
  findByConsumer(@Param('consumerId') consumerId: string, @Req() req: any) {
    return this.escrowService.findByConsumer(consumerId, req.user);
  }
}
