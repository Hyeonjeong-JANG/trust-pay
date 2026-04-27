import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';

const mockBusiness = {
  id: 'biz-1',
  name: '테스트카페',
  category: '카페',
  address: '서울시 강남구',
  phone: '010-1234-5678',
  email: 'cafe@test.com',
  xrplAddress: 'rBizAddr123',
  xrplSecret: 'encrypted:sBizSecret123',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('BusinessService', () => {
  let service: BusinessService;
  let prisma: any;
  let xrplService: any;

  beforeEach(async () => {
    prisma = {
      business: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    xrplService = {
      createWallet: jest.fn().mockResolvedValue({
        wallet: { classicAddress: 'rBizAddr123' },
        address: 'rBizAddr123',
        secret: 'sBizSecret123',
      }),
      setTrustLine: jest.fn().mockResolvedValue('TX_HASH'),
    };

    const module = await Test.createTestingModule({
      providers: [
        BusinessService,
        { provide: PrismaService, useValue: prisma },
        { provide: XrplService, useValue: xrplService },
        { provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => 'encrypted:' + v), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
      ],
    }).compile();

    service = module.get(BusinessService);
  });

  describe('register', () => {
    it('should create wallet, set trust line, and register business', async () => {
      prisma.business.create.mockResolvedValue(mockBusiness);

      const result = await service.register({
        name: '테스트카페',
        category: '카페',
        address: '서울시 강남구',
        phone: '010-1234-5678',
        email: 'cafe@test.com',
      });

      expect(xrplService.createWallet).toHaveBeenCalled();
      expect(xrplService.setTrustLine).toHaveBeenCalled();
      expect(prisma.business.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '테스트카페',
          category: '카페',
          address: '서울시 강남구',
          xrplAddress: 'rBizAddr123',
          xrplSecret: 'encrypted:sBizSecret123',
        }),
      });
      // Should NOT include xrplSecret in response
      expect(result).not.toHaveProperty('xrplSecret');
      expect(result).toHaveProperty('name', '테스트카페');
    });
  });

  describe('findById', () => {
    it('should return business without secret', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);

      const result = await service.findById('biz-1');

      expect(result).not.toHaveProperty('xrplSecret');
      expect(result).toHaveProperty('xrplAddress', 'rBizAddr123');
    });

    it('should throw if business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('dashboard', () => {
    it('should aggregate received and pending amounts', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [
          {
            id: 'e-1',
            status: 'active',
            monthlyAmount: 10000,
            entries: [
              { status: 'released' },
              { status: 'released' },
              { status: 'pending' },
            ],
            consumer: { id: 'c-1', name: '소비자1' },
          },
          {
            id: 'e-2',
            status: 'active',
            monthlyAmount: 20000,
            entries: [
              { status: 'pending' },
              { status: 'pending' },
            ],
            consumer: { id: 'c-2', name: '소비자2' },
          },
        ],
      });

      const result = await service.dashboard('biz-1');

      // e-1: 2 released * 10000 = 20000 received, 1 pending * 10000 = 10000 pending
      // e-2: 0 released = 0 received, 2 pending * 20000 = 40000 pending
      expect(result.totalReceived).toBe(20000);
      expect(result.totalPending).toBe(50000);
      expect(result.activeEscrows).toBe(2);
      expect(result.business).toEqual({ id: 'biz-1', name: '테스트카페' });
    });

    it('should return zero amounts when no escrows', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [],
      });

      const result = await service.dashboard('biz-1');

      expect(result.totalReceived).toBe(0);
      expect(result.totalPending).toBe(0);
      expect(result.activeEscrows).toBe(0);
    });

    it('should throw if business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.dashboard('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return active businesses without secrets', async () => {
      prisma.business.findMany.mockResolvedValue([mockBusiness]);

      const result = await service.findAll();

      expect(prisma.business.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('xrplSecret');
    });
  });
});
