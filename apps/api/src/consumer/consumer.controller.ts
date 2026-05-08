import { Controller, Post, Get, Param, Body, UsePipes, UseGuards, Req } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { consumerRegistrationSchema } from '@prepaid-shield/validators';
import { AuthGuard } from '../common/auth.guard';
import type { SessionUser } from '../common/session-token';

@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(consumerRegistrationSchema))
  register(@Body() dto: { name: string; phone?: string; email?: string }) {
    return this.consumerService.register(dto);
  }

  @Get(':id/balance')
  @UseGuards(AuthGuard)
  getBalance(@Param('id') id: string, @Req() req: { user: SessionUser }) {
    return this.consumerService.getBalance(id, req.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findById(@Param('id') id: string, @Req() req: { user: SessionUser }) {
    return this.consumerService.findById(id, req.user);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(@Req() req: { user: SessionUser }) {
    return this.consumerService.findAll(req.user);
  }
}
