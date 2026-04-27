import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ConsumerService } from './consumer.service';

@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Post()
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
