import { Controller, Post, Get, Param, Body, UsePipes, UseGuards } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { consumerRegistrationSchema } from '@prepaid-shield/validators';
import { AuthGuard } from '../common/auth.guard';

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
  getBalance(@Param('id') id: string) {
    return this.consumerService.getBalance(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findById(@Param('id') id: string) {
    return this.consumerService.findById(id);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    return this.consumerService.findAll();
  }
}
