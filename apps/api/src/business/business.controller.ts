import { Controller, Post, Get, Param, Body, UsePipes, UseGuards } from '@nestjs/common';
import { BusinessService } from './business.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { businessRegistrationSchema } from '@prepaid-shield/validators';
import { AuthGuard } from '../common/auth.guard';

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
  @UseGuards(AuthGuard)
  findAll() {
    return this.businessService.findAll();
  }

  @Get(':id/balance')
  @UseGuards(AuthGuard)
  getBalance(@Param('id') id: string) {
    return this.businessService.getBalance(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findById(@Param('id') id: string) {
    return this.businessService.findById(id);
  }

  @Get(':id/dashboard')
  @UseGuards(AuthGuard)
  dashboard(@Param('id') id: string) {
    return this.businessService.dashboard(id);
  }
}
