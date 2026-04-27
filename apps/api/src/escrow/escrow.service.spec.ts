import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';

// Mock Wallet.fromSeed to avoid real XRPL seed validation
jest.mock('xrpl', () => ({
  Wallet: {
    fromSeed: jest.fn().mockReturnValue({
      classicAddress: 'rMockWalletAddr',
      seed: 'sMockSeed',
    }),
  },
}));

const mockConsumer = {
  id: 'consumer-1',
  name: '소비자',
  phone: '010-1234-5678',
  xrplAddress: 'rConsumerAddr',
  xrplSecret: 'sConsumerSecret',
};

const mockBusiness = {
  id: 'business-1',
  name: '사업자',
  xrplAddress: 'rBusinessAddr',
  xrplSecret: 'sBusinessSecret',
};

const mockEscrowResults = [
  { month: 1, sequence: 100, amount: '50000', finishAfter: '2026-06-01T00:00:00Z', cancelAfter: '2026-07-01T00:00:00Z', txHash: 'TX1' },
  { month: 2, sequence: 101, amount: '50000', finishAfter: '2026-07-01T00:00:00Z', cancelAfter: '2026-08-01T00:00:00Z', txHash: 'TX2' },
  { month: 3, sequence: 102, amount: '50000', finishAfter: '2026-08-01T00:00:00Z', cancelAfter: '2026-09-01T00:00:00Z', txHash: 'TX3' },
];

describe('EscrowService', () => {
  let service: EscrowService;
  let prisma: any;
  let xrplService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      consumer: { findUnique: jest.fn() },
      business: { findUnique: jest.fn() },
      escrow: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      escrowEntry: { update: jest.fn() },
    };

    xrplService = {
      createMonthlyEscrows: jest.fn().mockResolvedValue(mockEscrowResults),
      finishEscrow: jest.fn().mockResolvedValue('FINISH_TX_HASH'),
      cancelEscrow: jest.fn().mockResolvedValue('CANCEL_TX_HASH'),
    };

    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, any> = {
          'rlusd.issuer': 'rIssuerAddress',
          'rlusd.currency': 'USD',
          demoMode: false,
        };
        return map[key];
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: prisma },
        { provide: XrplService, useValue: xrplService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(EscrowService);
  });

  describe('create', () => {
    it('should create escrow with monthly entries on XRPL', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.escrow.create.mockResolvedValue({
        id: 'escrow-1',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 150000,
        monthlyAmount: 50000,
        months: 3,
        entries: mockEscrowResults.map((r, i) => ({ id: `entry-${i}`, ...r, status: 'pending' })),
      });

      const result = await service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 150000,
        months: 3,
      });

      expect(xrplService.createMonthlyEscrows).toHaveBeenCalledWith(
        expect.anything(), // Wallet.fromSeed result
        'rBusinessAddr',
        '50000',
        3,
      );
      expect(prisma.escrow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          consumerId: 'consumer-1',
          businessId: 'business-1',
          totalAmount: 150000,
          monthlyAmount: 50000,
          months: 3,
          issuer: 'rIssuerAddress',
        }),
        include: { entries: true },
      });
      expect(result.entries).toHaveLength(3);
    });

    it('should throw if consumer not found', async () => {
      prisma.consumer.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ consumerId: 'bad-id', businessId: 'business-1', totalAmount: 100000, months: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if business not found', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ consumerId: 'consumer-1', businessId: 'bad-id', totalAmount: 100000, months: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return escrow with entries', async () => {
      const escrow = { id: 'escrow-1', entries: [], business: mockBusiness, consumer: mockConsumer };
      prisma.escrow.findUnique.mockResolvedValue(escrow);

      const result = await service.findById('escrow-1');
      expect(result).toEqual(escrow);
      expect(prisma.escrow.findUnique).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        include: { entries: true, business: true, consumer: true },
      });
    });

    it('should throw if escrow not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(null);
      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('finishEntry', () => {
    const makeEscrow = (entryStatus = 'pending') => ({
      id: 'escrow-1',
      businessId: 'business-1',
      consumerAddress: 'rConsumerAddr',
      entries: [
        { id: 'entry-1', month: 1, sequence: 100, status: entryStatus },
        { id: 'entry-2', month: 2, sequence: 101, status: 'pending' },
      ],
    });

    it('should finish a pending entry and update status to released', async () => {
      prisma.escrow.findUnique.mockResolvedValue(makeEscrow());
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.escrowEntry.update.mockResolvedValue({});

      const result = await service.finishEntry('escrow-1', 1);

      expect(xrplService.finishEscrow).toHaveBeenCalledWith(
        expect.anything(), // Wallet.fromSeed
        'rConsumerAddr',
        100,
      );
      expect(prisma.escrowEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { status: 'released', txHash: 'FINISH_TX_HASH' },
      });
      expect(result).toEqual({ txHash: 'FINISH_TX_HASH' });
    });

    it('should mark escrow as completed when all entries released', async () => {
      const escrow = {
        id: 'escrow-1',
        businessId: 'business-1',
        consumerAddress: 'rConsumerAddr',
        entries: [
          { id: 'entry-1', month: 1, sequence: 100, status: 'pending' },
          { id: 'entry-2', month: 2, sequence: 101, status: 'released' },
        ],
      };
      prisma.escrow.findUnique.mockResolvedValue(escrow);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.escrowEntry.update.mockResolvedValue({});

      await service.finishEntry('escrow-1', 1);

      expect(prisma.escrow.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: { status: 'completed' },
      });
    });

    it('should throw if entry already released', async () => {
      prisma.escrow.findUnique.mockResolvedValue(makeEscrow('released'));

      await expect(service.finishEntry('escrow-1', 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if entry month not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(makeEscrow());

      await expect(service.finishEntry('escrow-1', 99)).rejects.toThrow(NotFoundException);
    });

    it('should throw if escrow not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(null);
      await expect(service.finishEntry('bad-id', 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelEscrow', () => {
    it('should cancel all pending entries and update escrow status', async () => {
      const escrow = {
        id: 'escrow-1',
        consumerId: 'consumer-1',
        consumerAddress: 'rConsumerAddr',
        entries: [
          { id: 'entry-1', month: 1, sequence: 100, status: 'released' },
          { id: 'entry-2', month: 2, sequence: 101, status: 'pending' },
          { id: 'entry-3', month: 3, sequence: 102, status: 'pending' },
        ],
      };
      prisma.escrow.findUnique.mockResolvedValue(escrow);
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.escrowEntry.update.mockResolvedValue({});

      const result = await service.cancelEscrow('escrow-1');

      // Should only cancel pending entries (2 and 3), not released (1)
      expect(xrplService.cancelEscrow).toHaveBeenCalledTimes(2);
      expect(prisma.escrowEntry.update).toHaveBeenCalledTimes(2);
      expect(prisma.escrow.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: { status: 'cancelled' },
      });
      expect(result).toEqual({ cancelled: 2 });
    });

    it('should continue cancelling even if one entry fails', async () => {
      const escrow = {
        id: 'escrow-1',
        consumerId: 'consumer-1',
        consumerAddress: 'rConsumerAddr',
        entries: [
          { id: 'entry-1', month: 1, sequence: 100, status: 'pending' },
          { id: 'entry-2', month: 2, sequence: 101, status: 'pending' },
        ],
      };
      prisma.escrow.findUnique.mockResolvedValue(escrow);
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      xrplService.cancelEscrow
        .mockRejectedValueOnce(new Error('XRPL error'))
        .mockResolvedValueOnce('CANCEL_TX_2');
      prisma.escrowEntry.update.mockResolvedValue({});

      const result = await service.cancelEscrow('escrow-1');

      // Still marks escrow as cancelled
      expect(prisma.escrow.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: { status: 'cancelled' },
      });
      // Only the successful entry gets DB update
      expect(prisma.escrowEntry.update).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ cancelled: 2 });
    });

    it('should throw if escrow not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(null);
      await expect(service.cancelEscrow('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByConsumer', () => {
    it('should return escrows for a consumer', async () => {
      const escrows = [{ id: 'e-1' }, { id: 'e-2' }];
      prisma.escrow.findMany.mockResolvedValue(escrows);

      const result = await service.findByConsumer('consumer-1');

      expect(prisma.escrow.findMany).toHaveBeenCalledWith({
        where: { consumerId: 'consumer-1' },
        include: { entries: true, business: true },
      });
      expect(result).toEqual(escrows);
    });
  });
});
