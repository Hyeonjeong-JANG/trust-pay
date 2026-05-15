import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { CreatePaymentRequest } from '@prepaid-shield/shared-types';
import { AuthGuard } from '../common/auth.guard';
import type { SessionUser } from '../common/session-token';
import { PaymentRequestService } from './payment-request.service';

@Controller('payment-requests')
@UseGuards(AuthGuard)
export class PaymentRequestController {
  constructor(private readonly paymentRequestService: PaymentRequestService) {}

  @Post()
  create(@Body() dto: CreatePaymentRequest, @Req() req: { user: SessionUser }) {
    return this.paymentRequestService.create(dto, req.user);
  }

  @Get()
  findByQuery(@Query('code') code = '') {
    return this.paymentRequestService.findByCode(code);
  }

  @Get(':code')
  findByParam(@Param('code') code: string) {
    return this.paymentRequestService.findByCode(code);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: { user: SessionUser }) {
    return this.paymentRequestService.cancel(id, req.user);
  }
}
