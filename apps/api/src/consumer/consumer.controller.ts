import { Controller, Post, Get, Param, Body, UsePipes } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { consumerRegistrationSchema } from '@prepaid-shield/validators';

@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(consumerRegistrationSchema))
  register(@Body() dto: { name: string; phone?: string; email?: string }) {
    return this.consumerService.register(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.consumerService.findById(id);
  }

  @Get()
  findAll() {
    return this.consumerService.findAll();
  }
}
