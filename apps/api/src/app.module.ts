import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ConsumerModule } from './consumer/consumer.module';
import { EscrowModule } from './escrow/escrow.module';
import { XrplModule } from './xrpl/xrpl.module';
import { BusinessModule } from './business/business.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoService } from './common/crypto.service';
import configuration from './config/configuration';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    XrplModule,
    AuthModule,
    ConsumerModule,
    EscrowModule,
    BusinessModule,
  ],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class AppModule {}
