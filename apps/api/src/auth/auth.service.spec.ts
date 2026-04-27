import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { consumer: any; business: any };
  let xrplService: { createWallet: jest.Mock; setTrustLine: jest.Mock };

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
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: XrplService, useValue: xrplService },
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

  describe('consumer login', () => {
    it('should auto-register new consumer with wallet + trust line', async () => {
      prisma.consumer.findFirst.mockResolvedValue(null);
      prisma.consumer.create.mockResolvedValue({
        id: 'consumer-1',
        name: '테스트',
        phone: '010-1234-5678',
        xrplAddress: 'rTestAddr123',
        xrplSecret: 'sTestSecret123',
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
          phone: '010-1234-5678',
          name: '테스트',
          xrplAddress: 'rTestAddr123',
          xrplSecret: 'sTestSecret123',
        }),
      });
      expect(result).toEqual({
        userId: 'consumer-1',
        role: 'consumer',
        name: '테스트',
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
        xrplSecret: 'sTestSecret123',
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
