import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';

interface LoginDto {
  phone?: string;
  email?: string;
  role: 'consumer' | 'business';
  name?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
    private crypto: CryptoService,
  ) {}

  async login(dto: LoginDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('phone 또는 email이 필요합니다');
    }

    if (dto.role === 'consumer') {
      return this.loginConsumer(dto);
    } else {
      return this.loginBusiness(dto);
    }
  }

  private async loginConsumer(dto: LoginDto) {
    // 기존 사용자 조회
    const where = dto.phone
      ? { phone: dto.phone }
      : { email: dto.email! };

    let consumer = await this.prisma.consumer.findFirst({ where });

    if (!consumer) {
      // 자동 등록: 지갑 생성 + Trust Line
      const { wallet, address: xrplAddress, secret: xrplSecret } =
        await this.xrplService.createWallet();
      await this.xrplService.setTrustLine(wallet);

      consumer = await this.prisma.consumer.create({
        data: {
          name: dto.name || '소비자',
          phone: dto.phone,
          email: dto.email,
          xrplAddress,
          xrplSecret: this.crypto.encrypt(xrplSecret),
        },
      });

      this.logger.log(`새 소비자 등록: ${consumer.id}`);
    }

    return {
      userId: consumer.id,
      role: 'consumer' as const,
      name: consumer.name,
    };
  }

  private async loginBusiness(dto: LoginDto) {
    const where = dto.phone
      ? { phone: dto.phone }
      : { email: dto.email! };

    let business = await this.prisma.business.findFirst({ where });

    if (!business) {
      // 사업자는 로그인 시 자동 등록하지 않음 — 별도 등록 필요
      throw new BadRequestException('등록되지 않은 사업자입니다. 먼저 사업자 등록을 해주세요.');
    }

    return {
      userId: business.id,
      role: 'business' as const,
      name: business.name,
    };
  }
}
