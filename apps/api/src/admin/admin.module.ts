import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { XrplModule } from '../xrpl/xrpl.module';

@Module({
  imports: [XrplModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
