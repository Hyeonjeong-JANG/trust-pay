import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { BusinessClosureService } from './business-closure.service';
import { XrplModule } from '../xrpl/xrpl.module';

@Module({
  imports: [XrplModule],
  controllers: [BusinessController],
  providers: [BusinessService, BusinessClosureService],
  exports: [BusinessClosureService],
})
export class BusinessModule {}
