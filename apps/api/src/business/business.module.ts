import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { XrplModule } from '../xrpl/xrpl.module';

@Module({
  imports: [XrplModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
