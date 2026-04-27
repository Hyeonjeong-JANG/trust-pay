import { Controller, Post, Get, Param, Body, UsePipes } from '@nestjs/common';
import { BusinessService } from './business.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { businessRegistrationSchema } from '@prepaid-shield/validators';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(businessRegistrationSchema))
  register(
    @Body() dto: { name: string; category: string; address: string; phone?: string; email?: string },
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
