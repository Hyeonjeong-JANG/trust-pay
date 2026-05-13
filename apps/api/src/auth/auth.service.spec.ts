import { Test } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { consumer: any; business: any };
  let xrplService: { createWallet: jest.Mock; setTrustLine: jest.Mock; issueRLUSD: jest.Mock };

  beforeEach(async () => {
    prisma = {
      consumer: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      business: {
        findFirst: jest.fn(),
      },
    };

    xrplService = {
      createWallet: jest.fn().mockResolvedValue({
        wallet: { classicAddress: 'rTestAddr123' },
        address: 'rTestAddr123',
        secret: 'sTestSecret123',
      }),
      setTrustLine: jest.fn().mockResolvedValue('TX_HASH'),
      issueRLUSD: jest.fn().mockResolvedValue('TX_ISSUE_HASH'),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: XrplService, useValue: xrplService },
        { provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => 'encrypted:' + v), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
        { provide: ConfigService, useValue: { get: jest.fn((key: string) => key === 'rlusd.fundingAmount' ? '10000' : undefined) } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login validation', () => {
    it('should throw if neither phone nor email provided', async () => {
      await expect(
        service.login({ role: 'consumer' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('OTP session login', () => {
    it('should allow fixed OTP without enabling XRPL demo mode for local Testnet verification', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalAuthDemoOtp = process.env.AUTH_DEMO_OTP;
      process.env.NODE_ENV = 'development';
      process.env.AUTH_DEMO_OTP = 'true';

      try {
        const result = await service.requestCode({
          phone: '010-1234-5678',
          role: 'consumer',
        });

        expect(result).toEqual({
          delivery: 'demo',
          code: '123456',
          expiresInSeconds: 300,
          isNewUser: true,
        });
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalAuthDemoOtp === undefined) {
          delete process.env.AUTH_DEMO_OTP;
        } else {
          process.env.AUTH_DEMO_OTP = originalAuthDemoOtp;
        }
      }
    });

    it('should fail closed when non-demo OTP delivery is not configured', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalAuthDemoOtp = process.env.AUTH_DEMO_OTP;
      process.env.NODE_ENV = 'development';
      delete process.env.AUTH_DEMO_OTP;

      try {
        await expect(
          service.requestCode({ phone: '010-1234-5678', role: 'consumer' }),
        ).rejects.toThrow(ServiceUnavailableException);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalAuthDemoOtp === undefined) {
          delete process.env.AUTH_DEMO_OTP;
        } else {
          process.env.AUTH_DEMO_OTP = originalAuthDemoOtp;
        }
      }
    });

    it('should return the fixed demo OTP for phone login requests', async () => {
      prisma.consumer.findFirst.mockResolvedValue({
        id: 'existing-1',
        name: '기존소비자',
        phone: '010-1234-5678',
      });

      const result = await service.requestCode({
        phone: '010-1234-5678',
        role: 'consumer',
      });

      expect(result).toEqual({
        delivery: 'demo',
        code: '123456',
        expiresInSeconds: 300,
        isNewUser: false,
      });
    });

    it('should mark a consumer OTP request as new when no account matches', async () => {
      prisma.consumer.findFirst.mockResolvedValue(null);

      const result = await service.requestCode({
        phone: '010-9999-0000',
        role: 'consumer',
      });

      expect(result).toEqual({
        delivery: 'demo',
        code: '123456',
        expiresInSeconds: 300,
        isNewUser: true,
      });
    });

    it('should treat hyphenated and digit-only phone numbers as the same consumer', async () => {
      prisma.consumer.findFirst.mockResolvedValue({
        id: 'minsu-1',
        name: '김민수',
        phone: '010-2000-0001',
      });

      await service.requestCode({ phone: '01020000001', role: 'consumer' });
      const result = await service.verifyCode({
        phone: '01020000001',
        role: 'consumer',
        code: '123456',
      });

      expect(prisma.consumer.findFirst).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { phone: '01020000001' },
            { phone: '010-2000-0001' },
          ]),
        },
      });
      expect(prisma.consumer.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        userId: 'minsu-1',
        role: 'consumer',
        name: '김민수',
      });
    });

    it('should reject an incorrect OTP before creating a session', async () => {
      await service.requestCode({ phone: '010-1234-5678', role: 'consumer' });

      await expect(
        service.verifyCode({ phone: '010-1234-5678', role: 'consumer', code: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should invalidate an OTP after repeated incorrect attempts', async () => {
      prisma.consumer.findFirst.mockResolvedValue({
        id: 'existing-1',
        name: '기존소비자',
        phone: '010-1234-5678',
      });
      await service.requestCode({ phone: '010-1234-5678', role: 'consumer' });
      prisma.consumer.findFirst.mockClear();

      for (let attempt = 0; attempt < 5; attempt++) {
        await expect(
          service.verifyCode({ phone: '010-1234-5678', role: 'consumer', code: '000000' }),
        ).rejects.toThrow(BadRequestException);
      }

      await expect(
        service.verifyCode({ phone: '010-1234-5678', role: 'consumer', code: '123456' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.consumer.findFirst).not.toHaveBeenCalled();
    });

    it('should issue a server-signed session token after OTP verification', async () => {
      prisma.consumer.findFirst.mockResolvedValue({
        id: 'existing-1',
        name: '기존소비자',
        phone: '010-1234-5678',
      });
      await service.requestCode({ phone: '010-1234-5678', role: 'consumer' });

      const result = await service.verifyCode({
        phone: '010-1234-5678',
        role: 'consumer',
        code: '123456',
      });

      expect(result).toEqual({
        userId: 'existing-1',
        role: 'consumer',
        name: '기존소비자',
        token: expect.any(String),
        isNewUser: false,
      });
      expect(result.token.split('.')).toHaveLength(2);
    });
  });

  describe('consumer login', () => {
    it('should auto-register new consumer with wallet + trust line', async () => {
      prisma.consumer.findFirst.mockResolvedValue(null);
      prisma.consumer.create.mockResolvedValue({
        id: 'consumer-1',
        name: '테스트',
        phone: '010-1234-5678',
        xrplAddress: 'rTestAddr123',
        xrplSecret: 'encrypted:sTestSecret123',
      });

      const result = await service.login({
        phone: '010-1234-5678',
        role: 'consumer',
        name: '테스트',
      });

      expect(xrplService.createWallet).toHaveBeenCalled();
      expect(xrplService.setTrustLine).toHaveBeenCalled();
      expect(prisma.consumer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phone: '01012345678',
          name: '테스트',
          xrplAddress: 'rTestAddr123',
          xrplSecret: 'encrypted:sTestSecret123',
        }),
      });
      expect(result).toEqual({
        userId: 'consumer-1',
        role: 'consumer',
        name: '테스트',
        isNewUser: true,
      });
    });

    it('should return existing consumer without creating wallet', async () => {
      prisma.consumer.findFirst.mockResolvedValue({
        id: 'existing-1',
        name: '기존소비자',
        phone: '010-1111-2222',
      });

      const result = await service.login({
        phone: '010-1111-2222',
        role: 'consumer',
      });

      expect(xrplService.createWallet).not.toHaveBeenCalled();
      expect(prisma.consumer.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        userId: 'existing-1',
        role: 'consumer',
        name: '기존소비자',
        isNewUser: false,
      });
    });

    it('should lookup by email when phone not provided', async () => {
      prisma.consumer.findFirst.mockResolvedValue({
        id: 'email-1',
        name: '이메일유저',
        email: 'test@test.com',
      });

      await service.login({ email: 'test@test.com', role: 'consumer' });

      expect(prisma.consumer.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });

    it('should default name to 소비자 when not provided', async () => {
      prisma.consumer.findFirst.mockResolvedValue(null);
      prisma.consumer.create.mockResolvedValue({
        id: 'c-1',
        name: '소비자',
        phone: '010-0000-0000',
        xrplAddress: 'rTestAddr123',
        xrplSecret: 'encrypted:sTestSecret123',
      });

      await service.login({ phone: '010-0000-0000', role: 'consumer' });

      expect(prisma.consumer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: '소비자' }),
      });
    });
  });

  describe('business login', () => {
    it('should return existing business', async () => {
      prisma.business.findFirst.mockResolvedValue({
        id: 'biz-1',
        name: '테스트사업자',
        phone: '010-9999-8888',
      });

      const result = await service.login({
        phone: '010-9999-8888',
        role: 'business',
      });

      expect(result).toEqual({
        userId: 'biz-1',
        role: 'business',
        name: '테스트사업자',
      });
    });

    it('should throw if business not registered', async () => {
      prisma.business.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ phone: '010-0000-0000', role: 'business' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should lookup business by email', async () => {
      prisma.business.findFirst.mockResolvedValue({
        id: 'biz-2',
        name: '이메일사업자',
        email: 'biz@test.com',
      });

      await service.login({ email: 'biz@test.com', role: 'business' });

      expect(prisma.business.findFirst).toHaveBeenCalledWith({
        where: { email: 'biz@test.com' },
      });
    });
  });
});
