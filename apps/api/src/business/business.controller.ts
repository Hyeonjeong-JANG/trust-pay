import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { BusinessService } from './business.service';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  register(
    @Body() dto: { name: string; category: string; address: string; xrplAddress: string },
  ) {
    return this.businessService.register(dto);
  }

  @Get()
  findAll() {
    return this.businessService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.businessService.findById(id);
  }

  @Get(':id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.businessService.dashboard(id);
  }
}
