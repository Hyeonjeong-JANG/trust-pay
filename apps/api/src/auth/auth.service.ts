import { Injectable, BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import { createSessionToken } from '../common/session-token';

interface LoginDto {
  phone?: string;
  email?: string;
  role: 'consumer' | 'business';
  name?: string;
}

interface VerifyCodeDto extends LoginDto {
  code: string;
}

const DEMO_OTP = '123456';
const OTP_TTL_SECONDS = 300;
const MAX_OTP_ATTEMPTS = 5;

function normalizePhone(phone?: string): string | undefined {
  const normalized = phone?.replace(/\D/g, '');
  return normalized || undefined;
}

function formatKoreanPhone(phone: string): string {
  if (phone.length === 11 && phone.startsWith('01')) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  }
  if (phone.startsWith('02')) {
    if (phone.length === 10) return `02-${phone.slice(2, 6)}-${phone.slice(6)}`;
    if (phone.length === 9) return `02-${phone.slice(2, 5)}-${phone.slice(5)}`;
  }
  if (phone.length === 10) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  return phone;
}

function phoneCandidates(phone: string): string[] {
  const trimmed = phone.trim();
  const normalized = normalizePhone(trimmed);
  return Array.from(new Set([
    trimmed,
    normalized,
    normalized ? formatKoreanPhone(normalized) : undefined,
  ].filter((value): value is string => Boolean(value))));
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
    private crypto: CryptoService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('phone 또는 email이 필요합니다');
    }

    return this.authenticate(dto);
  }

  async requestCode(dto: LoginDto) {
    this.assertIdentifier(dto);
    if (!this.isDemoOtpMode()) {
      throw new ServiceUnavailableException('OTP delivery provider is not configured');
    }

    const code = DEMO_OTP;
    this.otpCodes.set(this.otpKey(dto), {
      code,
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
      attempts: 0,
    });
    const isNewUser = dto.role === 'consumer'
      ? !(await this.findConsumer(dto))
      : !(await this.findBusiness(dto));

    return {
      delivery: 'demo' as const,
      code,
      expiresInSeconds: OTP_TTL_SECONDS,
      isNewUser,
    };
  }

  async verifyCode(dto: VerifyCodeDto) {
    this.assertIdentifier(dto);
    const otp = this.otpCodes.get(this.otpKey(dto));
    if (!otp || otp.expiresAt < Date.now()) {
      if (otp) this.otpCodes.delete(this.otpKey(dto));
      throw new BadRequestException('인증코드가 올바르지 않습니다');
    }
    if (otp.code !== dto.code) {
      otp.attempts += 1;
      if (otp.attempts >= MAX_OTP_ATTEMPTS) {
        this.otpCodes.delete(this.otpKey(dto));
      }
      throw new BadRequestException('인증코드가 올바르지 않습니다');
    }
    this.otpCodes.delete(this.otpKey(dto));

    const user = await this.authenticate(dto);
    return {
      ...user,
      token: createSessionToken(user),
    };
  }

  private assertIdentifier(dto: LoginDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('phone 또는 email이 필요합니다');
    }
  }

  private otpKey(dto: LoginDto) {
    return `${dto.role}:${dto.phone ? `phone:${normalizePhone(dto.phone) ?? dto.phone}` : `email:${dto.email}`}`;
  }

  private isDemoOtpMode() {
    return (
      this.configService.get<boolean>('authDemoOtp') ||
      process.env.AUTH_DEMO_OTP === 'true' ||
      this.configService.get<boolean>('demoMode') ||
      process.env.NODE_ENV === 'test'
    );
  }

  private async authenticate(dto: LoginDto) {
    if (dto.role === 'consumer') {
      return this.loginConsumer(dto);
    } else {
      return this.loginBusiness(dto);
    }
  }

  private async loginConsumer(dto: LoginDto) {
    let consumer = await this.findConsumer(dto);
    const isNewUser = !consumer;

    if (!consumer) {
      // 자동 등록: 지갑 생성 + Trust Line
      const { wallet, address: xrplAddress, secret: xrplSecret } =
        await this.xrplService.createWallet();
      await this.xrplService.setTrustLine(wallet);

      // Auto-fund RLUSD for testnet (non-fatal if it fails)
      try {
        const fundingAmount = this.configService.get<string>('rlusd.fundingAmount') ?? '10000';
        await this.xrplService.issueRLUSD(xrplAddress, fundingAmount);
      } catch (err) {
        this.logger.warn(`RLUSD auto-funding failed for ${xrplAddress}: ${err}`);
      }

      consumer = await this.prisma.consumer.create({
        data: {
          name: dto.name || '소비자',
          phone: dto.phone ? normalizePhone(dto.phone) : undefined,
          email: dto.email?.trim(),
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
      isNewUser,
    };
  }

  private async loginBusiness(dto: LoginDto) {
    let business = await this.findBusiness(dto);

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

  private findConsumer(dto: LoginDto) {
    if (dto.phone) {
      return this.prisma.consumer.findFirst({
        where: { OR: phoneCandidates(dto.phone).map((phone) => ({ phone })) },
      });
    }
    return this.prisma.consumer.findFirst({ where: { email: dto.email!.trim() } });
  }

  private findBusiness(dto: LoginDto) {
    if (dto.phone) {
      return this.prisma.business.findFirst({
        where: { OR: phoneCandidates(dto.phone).map((phone) => ({ phone })) },
      });
    }
    return this.prisma.business.findFirst({ where: { email: dto.email!.trim() } });
  }
}
