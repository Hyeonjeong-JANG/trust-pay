import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EscrowModule } from './escrow/escrow.module';
import { XrplModule } from './xrpl/xrpl.module';
import { BusinessModule } from './business/business.module';
import { PrismaModule } from './prisma/prisma.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    XrplModule,
    EscrowModule,
    BusinessModule,
  ],
})
export class AppModule {}
