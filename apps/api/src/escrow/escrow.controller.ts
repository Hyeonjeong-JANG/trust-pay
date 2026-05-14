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
import { createChargeRequestSchema, createEscrowSchema, finishEscrowSchema, requestRefundReviewSchema, type CreateChargeRequestInput, type RequestRefundReviewInput } from '@prepaid-shield/validators';
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

  @Get('consumer/:consumerId')
  findByConsumer(@Param('consumerId') consumerId: string, @Req() req: any) {
    return this.escrowService.findByConsumer(consumerId, req.user);
  }

  @Get(':id/charge-requests')
  findChargeRequests(@Param('id') id: string, @Req() req: any) {
    return this.escrowService.findChargeRequestsByEscrow(id, req.user);
  }

  @Post(':id/charge-requests')
  createChargeRequest(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createChargeRequestSchema)) dto: CreateChargeRequestInput,
    @Req() req: any,
  ) {
    return this.escrowService.createChargeRequest(id, dto, req.user);
  }

  @Post('charge-requests/:requestId/approve')
  approveChargeRequest(@Param('requestId') requestId: string, @Req() req: any) {
    return this.escrowService.approveChargeRequest(requestId, req.user);
  }

  @Post('charge-requests/:requestId/reject')
  rejectChargeRequest(@Param('requestId') requestId: string, @Req() req: any) {
    return this.escrowService.rejectChargeRequest(requestId, req.user);
  }

  @Post(':id/refund-review-requests')
  requestRefundReview(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(requestRefundReviewSchema)) dto: RequestRefundReviewInput,
    @Req() req: any,
  ) {
    return this.escrowService.requestRefundReview(id, req.user, dto);
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
}
