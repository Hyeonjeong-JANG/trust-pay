import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { BusinessClosureService } from '../business/business-closure.service';
import { PaymentRequestService } from '../payment-request/payment-request.service';
import { PartialPrepaidEscrowCreationError, XrplService } from '../xrpl/xrpl.service';
import { createEscrowSchema } from '@prepaid-shield/validators';

// Mock Wallet.fromSeed to avoid real XRPL seed validation
jest.mock('xrpl', () => ({
  Wallet: {
    fromSeed: jest.fn().mockReturnValue({
      classicAddress: 'rMockWalletAddr',
      seed: 'sMockSeed',
    }),
    generate: jest.fn().mockReturnValue({
      classicAddress: 'rMockGeneratedAddr',
      seed: 'sMockGeneratedSeed',
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

const mockPaymentRequest = {
  id: 'payment-request-1',
  code: 'TP-123456',
  businessId: 'business-1',
  businessName: '사업자',
  totalAmount: 150000,
  monthlyAmount: 50000,
  months: 3,
  escrowType: 'monthly',
  status: 'pending',
  createdAt: new Date('2026-05-14T00:00:00.000Z'),
};

const consumerUser = { userId: 'consumer-1', role: 'consumer' as const, name: '소비자' };
const businessUser = { userId: 'business-1', role: 'business' as const, name: '사업자' };

const mockEscrowResults = [
  { month: 1, sequence: 100, amount: '50000', finishAfter: '2026-06-01T00:00:00Z', cancelAfter: '2026-07-01T00:00:00Z', txHash: 'TX1' },
  { month: 2, sequence: 101, amount: '50000', finishAfter: '2026-07-01T00:00:00Z', cancelAfter: '2026-08-01T00:00:00Z', txHash: 'TX2' },
  { month: 3, sequence: 102, amount: '50000', finishAfter: '2026-08-01T00:00:00Z', cancelAfter: '2026-09-01T00:00:00Z', txHash: 'TX3' },
];

const mockPrepaidEscrowResults = Array.from({ length: 30 }, (_, index) => ({
  month: index + 1,
  sequence: 200 + index,
  amount: '5',
  finishAfter: 830000000,
  cancelAfter: 837000000,
  txHash: `PREPAID_TX_${index + 1}`,
}));

describe('EscrowService', () => {
  let service: EscrowService;
  let prisma: any;
  let xrplService: any;
  let configService: any;
  let businessClosureService: any;
  let paymentRequestService: any;

  beforeEach(async () => {
    prisma = {
      consumer: { findUnique: jest.fn() },
      business: { findUnique: jest.fn() },
      productMenuItem: { findUnique: jest.fn() },
      escrow: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      escrowEntry: {
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ status: 'pending' }]),
      },
      chargeRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refundReviewRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    xrplService = {
      createMonthlyEscrows: jest.fn().mockResolvedValue(mockEscrowResults),
      createPrepaidEscrows: jest.fn().mockResolvedValue(mockPrepaidEscrowResults),
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

    businessClosureService = {
      checkBusinessStatus: jest.fn().mockResolvedValue({
        status: 'active',
        source: 'nts',
        checkedAt: new Date('2026-05-14T00:00:00.000Z'),
      }),
    };
    paymentRequestService = {
      findByCode: jest.fn(),
      markUsedByCode: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: prisma },
        { provide: XrplService, useValue: xrplService },
        { provide: ConfigService, useValue: configService },
        { provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => 'encrypted:' + v), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
        { provide: BusinessClosureService, useValue: businessClosureService },
        { provide: PaymentRequestService, useValue: paymentRequestService },
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
      }, consumerUser);

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
      const createArgs = prisma.escrow.create.mock.calls[0][0];
      expect(xrplService.finishEscrow).toHaveBeenCalledWith(
        expect.anything(),
        'rConsumerAddr',
        100,
      );
      expect(createArgs.data.entries.create[0]).toMatchObject({
        status: 'released',
        txHash: 'FINISH_TX_HASH',
      });
      expect(createArgs.data.entries.create[1]).not.toHaveProperty('status');
      expect(result.entries).toHaveLength(3);
    });

    it('should reject a non-pending payment request before XRPL escrow creation', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      paymentRequestService.findByCode.mockResolvedValue({
        ...mockPaymentRequest,
        status: 'cancelled',
      });

      await expect(service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        paymentRequestCode: 'TP-123456',
        totalAmount: 150000,
        months: 3,
      }, consumerUser)).rejects.toThrow(BadRequestException);

      expect(paymentRequestService.findByCode).toHaveBeenCalledWith('TP-123456');
      expect(xrplService.createMonthlyEscrows).not.toHaveBeenCalled();
      expect(prisma.escrow.create).not.toHaveBeenCalled();
      expect(paymentRequestService.markUsedByCode).not.toHaveBeenCalled();
    });

    it('should reject a payment request for another business before XRPL escrow creation', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      paymentRequestService.findByCode.mockResolvedValue({
        ...mockPaymentRequest,
        businessId: 'other-business',
      });

      await expect(service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        paymentRequestCode: 'TP-123456',
        totalAmount: 150000,
        months: 3,
      }, consumerUser)).rejects.toThrow(BadRequestException);

      expect(xrplService.createMonthlyEscrows).not.toHaveBeenCalled();
      expect(prisma.escrow.create).not.toHaveBeenCalled();
      expect(paymentRequestService.markUsedByCode).not.toHaveBeenCalled();
    });

    it('should reject a payment request amount mismatch before XRPL escrow creation', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      paymentRequestService.findByCode.mockResolvedValue({
        ...mockPaymentRequest,
        totalAmount: 140000,
      });

      await expect(service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        paymentRequestCode: 'TP-123456',
        totalAmount: 150000,
        months: 3,
      }, consumerUser)).rejects.toThrow(BadRequestException);

      expect(xrplService.createMonthlyEscrows).not.toHaveBeenCalled();
      expect(prisma.escrow.create).not.toHaveBeenCalled();
      expect(paymentRequestService.markUsedByCode).not.toHaveBeenCalled();
    });

    it('should reject a prepaid payment request term mismatch before XRPL escrow creation', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      paymentRequestService.findByCode.mockResolvedValue({
        ...mockPaymentRequest,
        totalAmount: 150,
        monthlyAmount: null,
        months: null,
        escrowType: 'prepaid',
        unitPrice: 10,
        validityMonths: 3,
      });

      await expect(service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        paymentRequestCode: 'TP-123456',
        totalAmount: 150,
        escrowType: 'prepaid',
        unitPrice: 5,
        validityMonths: 3,
      }, consumerUser)).rejects.toThrow(BadRequestException);

      expect(xrplService.createPrepaidEscrows).not.toHaveBeenCalled();
      expect(prisma.escrow.create).not.toHaveBeenCalled();
      expect(paymentRequestService.markUsedByCode).not.toHaveBeenCalled();
    });

    it('should preflight and consume a matching payment request around escrow creation', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      paymentRequestService.findByCode.mockResolvedValue(mockPaymentRequest);
      prisma.escrow.create.mockResolvedValue({
        id: 'escrow-1',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 150000,
        monthlyAmount: 50000,
        months: 3,
        entries: mockEscrowResults.map((r, i) => ({ id: `entry-${i}`, ...r, status: 'pending' })),
      });

      await service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        paymentRequestCode: 'TP-123456',
        totalAmount: 150000,
        months: 3,
      }, consumerUser);

      expect(paymentRequestService.findByCode).toHaveBeenCalledWith('TP-123456');
      expect(paymentRequestService.findByCode.mock.invocationCallOrder[0])
        .toBeLessThan(xrplService.createMonthlyEscrows.mock.invocationCallOrder[0]);
      expect(paymentRequestService.markUsedByCode).toHaveBeenCalledWith('TP-123456', 'business-1');
      expect(paymentRequestService.markUsedByCode.mock.invocationCallOrder[0])
        .toBeGreaterThan(prisma.escrow.create.mock.invocationCallOrder[0]);
    });

    it('should create prepaid escrow entries by unit price', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.escrow.create.mockResolvedValue({
        id: 'escrow-prepaid-1',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 150,
        monthlyAmount: 5,
        months: 30,
        escrowType: 'prepaid',
        unitPrice: 5,
        validityMonths: 3,
        entries: mockPrepaidEscrowResults.map((r, i) => ({ id: `prepaid-entry-${i}`, ...r, status: 'pending' })),
      });

      const result = await service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 150,
        escrowType: 'prepaid',
        unitPrice: 5,
        validityMonths: 3,
      }, consumerUser);

      expect(xrplService.createPrepaidEscrows).toHaveBeenCalledWith(
        expect.anything(),
        'rBusinessAddr',
        '5',
        30,
        3,
      );
      expect(xrplService.createMonthlyEscrows).not.toHaveBeenCalled();
      expect(prisma.escrow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalAmount: 150,
          monthlyAmount: 5,
          months: 30,
          escrowType: 'prepaid',
          unitPrice: 5,
          validityMonths: 3,
        }),
        include: { entries: true },
      });
      expect(result.entries).toHaveLength(30);
    });

    it('should create prepaid escrows with decimal RLUSD amounts converted from KRW', async () => {
      const decimalPrepaidResults = Array.from({ length: 10 }, (_, index) => ({
        month: index + 1,
        sequence: 300 + index,
        amount: '0.740741',
        finishAfter: 830000000,
        cancelAfter: 837000000,
        txHash: `DECIMAL_PREPAID_TX_${index + 1}`,
      }));
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      xrplService.createPrepaidEscrows.mockResolvedValue(decimalPrepaidResults);
      prisma.escrow.create.mockResolvedValue({
        id: 'escrow-prepaid-decimal',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 7.407407,
        monthlyAmount: 0.740741,
        months: 10,
        escrowType: 'prepaid',
        unitPrice: 0.740741,
        validityMonths: 3,
        entries: decimalPrepaidResults.map((r, i) => ({ id: `decimal-entry-${i}`, ...r, status: 'pending' })),
      });

      await service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 7.407407,
        escrowType: 'prepaid',
        unitPrice: 0.740741,
        validityMonths: 3,
      }, consumerUser);

      expect(xrplService.createPrepaidEscrows).toHaveBeenCalledWith(
        expect.anything(),
        'rBusinessAddr',
        '0.740741',
        10,
        3,
      );
      expect(prisma.escrow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalAmount: 7.40741,
          monthlyAmount: 0.740741,
          months: 10,
          escrowType: 'prepaid',
          unitPrice: 0.740741,
          validityMonths: 3,
        }),
        include: { entries: true },
      });
    });

    it('should accept KRW-rounded prepaid totals that are valid whole unit counts', async () => {
      const decimalPrepaidResults = Array.from({ length: 30 }, (_, index) => ({
        month: index + 1,
        sequence: 400 + index,
        amount: '0.740741',
        finishAfter: 830000000,
        cancelAfter: 837000000,
        txHash: `KRW_ROUNDED_PREPAID_TX_${index + 1}`,
      }));
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      xrplService.createPrepaidEscrows.mockResolvedValue(decimalPrepaidResults);
      prisma.escrow.create.mockResolvedValue({
        id: 'escrow-prepaid-krw-rounded',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 22.22223,
        monthlyAmount: 0.740741,
        months: 30,
        escrowType: 'prepaid',
        unitPrice: 0.740741,
        validityMonths: 3,
        entries: decimalPrepaidResults.map((r, i) => ({ id: `krw-rounded-entry-${i}`, ...r, status: 'pending' })),
      });

      await service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 22.222222,
        escrowType: 'prepaid',
        unitPrice: 0.740741,
        validityMonths: 3,
      }, consumerUser);

      expect(xrplService.createPrepaidEscrows).toHaveBeenCalledWith(
        expect.anything(),
        'rBusinessAddr',
        '0.740741',
        30,
        3,
      );
      expect(prisma.escrow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalAmount: 22.22223,
          monthlyAmount: 0.740741,
          months: 30,
          escrowType: 'prepaid',
          unitPrice: 0.740741,
        }),
        include: { entries: true },
      });
    });

    it('should accept small KRW-rounded prepaid unit amounts within decimal rounding tolerance', async () => {
      const smallUnitResults = Array.from({ length: 49 }, (_, index) => ({
        month: index + 1,
        sequence: 450 + index,
        amount: '0.000741',
        finishAfter: 830000000,
        cancelAfter: 837000000,
        txHash: `SMALL_UNIT_TX_${index + 1}`,
      }));
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      xrplService.createPrepaidEscrows.mockResolvedValue(smallUnitResults);
      prisma.escrow.create.mockResolvedValue({
        id: 'escrow-prepaid-small-unit',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 0.036309,
        monthlyAmount: 0.000741,
        months: 49,
        escrowType: 'prepaid',
        unitPrice: 0.000741,
        validityMonths: 3,
        entries: smallUnitResults.map((r, i) => ({ id: `small-unit-entry-${i}`, ...r, status: 'pending' })),
      });

      await service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 0.036296,
        escrowType: 'prepaid',
        unitPrice: 0.000741,
        validityMonths: 3,
      }, consumerUser);

      expect(xrplService.createPrepaidEscrows).toHaveBeenCalledWith(
        expect.anything(),
        'rBusinessAddr',
        '0.000741',
        49,
        3,
      );
      expect(prisma.escrow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalAmount: 0.036309,
          monthlyAmount: 0.000741,
          months: 49,
          unitPrice: 0.000741,
        }),
        include: { entries: true },
      });
    });

    it('should validate decimal RLUSD prepaid amounts converted from KRW', () => {
      const result = createEscrowSchema.safeParse({
        consumerId: '00000000-0000-4000-a000-000000000001',
        businessId: '00000000-0000-4000-a000-000000000010',
        totalAmount: 7.407407,
        escrowType: 'prepaid',
        unitPrice: 0.740741,
        validityMonths: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should validate KRW-rounded prepaid totals that are valid whole unit counts', () => {
      const result = createEscrowSchema.safeParse({
        consumerId: '00000000-0000-4000-a000-000000000001',
        businessId: '00000000-0000-4000-a000-000000000010',
        totalAmount: 22.222222,
        escrowType: 'prepaid',
        unitPrice: 0.740741,
        validityMonths: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should validate small KRW-rounded prepaid unit amounts within decimal rounding tolerance', () => {
      const result = createEscrowSchema.safeParse({
        consumerId: '00000000-0000-4000-a000-000000000001',
        businessId: '00000000-0000-4000-a000-000000000010',
        totalAmount: 0.036296,
        escrowType: 'prepaid',
        unitPrice: 0.000741,
        validityMonths: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should reject prepaid requests above the ledger entry cap before XRPL submission', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);

      await expect(service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 255,
        escrowType: 'prepaid',
        unitPrice: 5,
        validityMonths: 3,
      }, consumerUser)).rejects.toThrow(BadRequestException);

      expect(xrplService.createPrepaidEscrows).not.toHaveBeenCalled();
      expect(prisma.escrow.create).not.toHaveBeenCalled();
    });

    it('should persist prepaid XRPL entries created before a partial submission failure', async () => {
      const partialResults = mockPrepaidEscrowResults.slice(0, 2);
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      xrplService.createPrepaidEscrows.mockRejectedValue(
        new PartialPrepaidEscrowCreationError('XRPL prepaid creation failed', partialResults),
      );
      prisma.escrow.create.mockResolvedValue({
        id: 'escrow-prepaid-partial',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 10,
        monthlyAmount: 5,
        months: 2,
        escrowType: 'prepaid',
        unitPrice: 5,
        validityMonths: 3,
        entries: partialResults.map((r, i) => ({ id: `partial-entry-${i}`, ...r, status: 'pending' })),
      });

      await expect(service.create({
        consumerId: 'consumer-1',
        businessId: 'business-1',
        totalAmount: 150,
        escrowType: 'prepaid',
        unitPrice: 5,
        validityMonths: 3,
      }, consumerUser)).rejects.toThrow(PartialPrepaidEscrowCreationError);

      expect(prisma.escrow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalAmount: 10,
          monthlyAmount: 5,
          months: 2,
          escrowType: 'prepaid',
          unitPrice: 5,
          validityMonths: 3,
          entries: {
            create: partialResults.map((r) => ({
              month: r.month,
              sequence: r.sequence,
              amount: r.amount,
              finishAfter: r.finishAfter,
              cancelAfter: r.cancelAfter,
              txHash: r.txHash,
            })),
          },
        }),
        include: { entries: true },
      });
    });

    it('should throw if consumer not found', async () => {
      prisma.consumer.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { consumerId: 'bad-id', businessId: 'business-1', totalAmount: 100000, months: 2 },
          { ...consumerUser, userId: 'bad-id' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if business not found', async () => {
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ consumerId: 'consumer-1', businessId: 'bad-id', totalAmount: 100000, months: 2 }, consumerUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return escrow with entries', async () => {
      const escrow = { id: 'escrow-1', consumerId: 'consumer-1', businessId: 'business-1', entries: [], business: mockBusiness, consumer: mockConsumer };
      prisma.escrow.findUnique.mockResolvedValue(escrow);

      const result = await service.findById('escrow-1', consumerUser);
      const { xrplSecret: _bs, ...expectedBusiness } = mockBusiness;
      const { xrplSecret: _cs, ...expectedConsumer } = mockConsumer;
      expect(result).toEqual({
        id: 'escrow-1',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        entries: [],
        business: expectedBusiness,
        consumer: expectedConsumer,
      });
      expect(prisma.escrow.findUnique).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        include: {
          entries: true,
          business: true,
          consumer: true,
          product: { include: { menuItems: true } },
          chargeRequests: { include: { menuItem: true } },
          refundReviewRequests: { orderBy: { requestedAt: 'desc' } },
        },
      });
    });

    it('should throw if escrow not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(null);
      await expect(service.findById('bad-id', consumerUser)).rejects.toThrow(NotFoundException);
    });

    it('should expose platform-review status to business viewers without consumer evidence', async () => {
      const escrow = {
        id: 'escrow-1',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        entries: [],
        business: mockBusiness,
        consumer: mockConsumer,
        refundReviewRequests: [
          {
            id: 'refund-review-platform',
            status: 'platform_review',
            consumerReason: '2주 넘게 영업하지 않아 환불을 요청합니다.',
            photoDataUrlsJson: JSON.stringify(['data:image/png;base64,ZmFrZQ==']),
          },
          {
            id: 'refund-review-visible',
            status: 'merchant_response_requested',
            merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부를 답변해주세요.',
            consumerReason: '원문은 사업자에게 바로 노출하지 않습니다.',
            photoDataUrlsJson: JSON.stringify(['data:image/png;base64,c2VjcmV0']),
          },
          {
            id: 'refund-review-legacy',
            status: 'merchant_review',
            consumerReason: '기존 요청 원문은 사업자에게 바로 노출하지 않습니다.',
            photoDataUrlsJson: JSON.stringify(['data:image/png;base64,bGVnYWN5']),
          },
        ],
      };
      prisma.escrow.findUnique.mockResolvedValue(escrow);

      const result = await service.findById('escrow-1', businessUser);

      expect(result.refundReviewRequests).toHaveLength(3);
      expect(result.refundReviewRequests[0]).toMatchObject({
        id: 'refund-review-platform',
        status: 'platform_review',
      });
      expect(result.refundReviewRequests[0]).not.toHaveProperty('consumerReason');
      expect(result.refundReviewRequests[0]).not.toHaveProperty('photoDataUrls');
      expect(result.refundReviewRequests[0]).not.toHaveProperty('photoDataUrlsJson');
      expect(result.refundReviewRequests[1]).toMatchObject({
        id: 'refund-review-visible',
        status: 'merchant_response_requested',
        merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부를 답변해주세요.',
      });
      expect(result.refundReviewRequests[1]).not.toHaveProperty('consumerReason');
      expect(result.refundReviewRequests[1]).not.toHaveProperty('photoDataUrls');
      expect(result.refundReviewRequests[1]).not.toHaveProperty('photoDataUrlsJson');
      expect(result.refundReviewRequests[2]).toMatchObject({
        id: 'refund-review-legacy',
        status: 'merchant_review',
      });
      expect(result.refundReviewRequests[2]).not.toHaveProperty('consumerReason');
      expect(result.refundReviewRequests[2]).not.toHaveProperty('photoDataUrls');
      expect(result.refundReviewRequests[2]).not.toHaveProperty('photoDataUrlsJson');
    });
  });

  describe('finishEntry', () => {
    const makeEscrow = (entryStatus = 'pending') => ({
      id: 'escrow-1',
      businessId: 'business-1',
      consumerAddress: 'rConsumerAddr',
      entries: [
        { id: 'entry-1', month: 1, sequence: 100, status: entryStatus, version: 0 },
        { id: 'entry-2', month: 2, sequence: 101, status: 'pending', version: 0 },
      ],
    });

    it('should finish a pending entry and update status to released', async () => {
      prisma.escrow.findUnique.mockResolvedValue(makeEscrow());
      prisma.business.findUnique.mockResolvedValue(mockBusiness);

      const result = await service.finishEntry('escrow-1', 1, businessUser);

      expect(xrplService.finishEscrow).toHaveBeenCalledWith(
        expect.anything(), // Wallet.fromSeed
        'rConsumerAddr',
        100,
      );
      expect(prisma.escrowEntry.updateMany).toHaveBeenCalledWith({
        where: { id: 'entry-1', version: 0, status: 'pending' },
        data: { status: 'released', txHash: 'FINISH_TX_HASH', version: 1 },
      });
      expect(result).toEqual({ txHash: 'FINISH_TX_HASH' });
    });

    it('should mark escrow as completed when all entries released', async () => {
      const escrow = {
        id: 'escrow-1',
        businessId: 'business-1',
        consumerAddress: 'rConsumerAddr',
        entries: [
          { id: 'entry-1', month: 1, sequence: 100, status: 'pending', version: 0 },
          { id: 'entry-2', month: 2, sequence: 101, status: 'released', version: 0 },
        ],
      };
      prisma.escrow.findUnique.mockResolvedValue(escrow);
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.escrowEntry.findMany.mockResolvedValue([
        { id: 'entry-1', status: 'released' },
        { id: 'entry-2', status: 'released' },
      ]);

      await service.finishEntry('escrow-1', 1, businessUser);

      expect(prisma.escrow.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: { status: 'completed' },
      });
    });

    it('should throw if entry already released', async () => {
      prisma.escrow.findUnique.mockResolvedValue(makeEscrow('released'));

      await expect(service.finishEntry('escrow-1', 1, businessUser)).rejects.toThrow(BadRequestException);
    });

    it('should block monthly settlement while refund review is open', async () => {
      prisma.escrow.findUnique.mockResolvedValue({
        ...makeEscrow(),
        refundReviewRequests: [{ id: 'review-1', status: 'merchant_review' }],
      });
      prisma.business.findUnique.mockResolvedValue(mockBusiness);

      await expect(service.finishEntry('escrow-1', 1, businessUser)).rejects.toThrow('환불 검토가 진행 중인 보호 결제는 정산할 수 없습니다');
      expect(xrplService.finishEscrow).not.toHaveBeenCalled();
      expect(prisma.escrowEntry.updateMany).not.toHaveBeenCalled();
    });

    it('should throw if entry month not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(makeEscrow());

      await expect(service.finishEntry('escrow-1', 99, businessUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw if escrow not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(null);
      await expect(service.finishEntry('bad-id', 1, businessUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('charge requests', () => {
    const menuItem = {
      id: 'menu-cut',
      productId: 'product-salon',
      name: '커트',
      amount: 30,
      isActive: true,
      product: { id: 'product-salon', businessId: 'business-1' },
    };

    const prepaidEscrow = {
      id: 'escrow-prepaid-1',
      consumerId: 'consumer-1',
      businessId: 'business-1',
      consumerAddress: 'rConsumerAddr',
      businessAddress: 'rBusinessAddr',
      escrowType: 'prepaid',
      status: 'active',
      productId: 'product-salon',
      unitPrice: 10,
      monthlyAmount: 10,
      entries: [
        { id: 'entry-1', month: 1, sequence: 201, amount: '10', status: 'pending', version: 0 },
        { id: 'entry-2', month: 2, sequence: 202, amount: '10', status: 'pending', version: 0 },
        { id: 'entry-3', month: 3, sequence: 203, amount: '10', status: 'pending', version: 0 },
        { id: 'entry-4', month: 4, sequence: 204, amount: '10', status: 'pending', version: 0 },
      ],
      chargeRequests: [],
    };

    it('should create a pending charge request without finishing XRPL entries', async () => {
      prisma.escrow.findUnique.mockResolvedValue(prepaidEscrow);
      prisma.productMenuItem.findUnique.mockResolvedValue(menuItem);
      prisma.chargeRequest.create.mockResolvedValue({
        id: 'charge-1',
        escrowId: 'escrow-prepaid-1',
        menuItemId: 'menu-cut',
        menuName: '커트',
        amount: 30,
        status: 'pending_approval',
        entryIds: JSON.stringify(['entry-1', 'entry-2', 'entry-3']),
      });

      const result = await service.createChargeRequest(
        'escrow-prepaid-1',
        { menuItemId: 'menu-cut' },
        businessUser,
      );

      expect(prisma.chargeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          escrowId: 'escrow-prepaid-1',
          consumerId: 'consumer-1',
          businessId: 'business-1',
          productId: 'product-salon',
          menuItemId: 'menu-cut',
          menuName: '커트',
          amount: 30,
          status: 'pending_approval',
          entryIds: JSON.stringify(['entry-1', 'entry-2', 'entry-3']),
        }),
        include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
      });
      expect(xrplService.finishEscrow).not.toHaveBeenCalled();
      expect(result.status).toBe('pending_approval');
    });

    it('should create a manual business-entered charge request without a menu item', async () => {
      prisma.escrow.findUnique.mockResolvedValue(prepaidEscrow);
      prisma.chargeRequest.create.mockResolvedValue({
        id: 'charge-manual',
        escrowId: 'escrow-prepaid-1',
        menuItemId: null,
        menuName: '직접 입력 이용금액',
        amount: 20,
        status: 'pending_approval',
        entryIds: JSON.stringify(['entry-1', 'entry-2']),
      });

      const result = await service.createChargeRequest(
        'escrow-prepaid-1',
        { menuName: '직접 입력 이용금액', amount: 20 },
        businessUser,
      );

      expect(prisma.productMenuItem.findUnique).not.toHaveBeenCalled();
      expect(prisma.chargeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          escrowId: 'escrow-prepaid-1',
          consumerId: 'consumer-1',
          businessId: 'business-1',
          productId: 'product-salon',
          menuItemId: null,
          menuName: '직접 입력 이용금액',
          amount: 20,
          status: 'pending_approval',
          entryIds: JSON.stringify(['entry-1', 'entry-2']),
        }),
        include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
      });
      expect(xrplService.finishEscrow).not.toHaveBeenCalled();
      expect(result.status).toBe('pending_approval');
    });

    it('should allow manual variable amount charge requests covered by available prepaid balance', async () => {
      prisma.escrow.findUnique.mockResolvedValue(prepaidEscrow);
      prisma.chargeRequest.create.mockResolvedValue({
        id: 'charge-variable',
        escrowId: 'escrow-prepaid-1',
        menuItemId: null,
        menuName: '수건 대여',
        amount: 5,
        status: 'pending_approval',
        entryIds: JSON.stringify(['entry-1']),
      });

      const result = await service.createChargeRequest(
        'escrow-prepaid-1',
        { menuName: '수건 대여', amount: 5 },
        businessUser,
      );

      expect(prisma.chargeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          menuName: '수건 대여',
          amount: 5,
          entryIds: JSON.stringify(['entry-1']),
        }),
        include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
      });
      expect(result.status).toBe('pending_approval');
    });

    it('should finish reserved entries only after consumer approval', async () => {
      prisma.chargeRequest.findUnique.mockResolvedValue({
        id: 'charge-1',
        escrowId: 'escrow-prepaid-1',
        consumerId: 'consumer-1',
        businessId: 'business-1',
        amount: 30,
        status: 'pending_approval',
        version: 0,
        entryIds: JSON.stringify(['entry-1', 'entry-2', 'entry-3']),
        escrow: prepaidEscrow,
      });
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      xrplService.finishEscrow
        .mockResolvedValueOnce('FINISH_TX_1')
        .mockResolvedValueOnce('FINISH_TX_2')
        .mockResolvedValueOnce('FINISH_TX_3');
      prisma.chargeRequest.update.mockResolvedValue({
        id: 'charge-1',
        status: 'settled',
        txHash: 'FINISH_TX_1,FINISH_TX_2,FINISH_TX_3',
      });

      const result = await service.approveChargeRequest('charge-1', consumerUser);

      expect(xrplService.finishEscrow).toHaveBeenCalledTimes(3);
      expect(xrplService.finishEscrow).toHaveBeenNthCalledWith(1, expect.anything(), 'rConsumerAddr', 201);
      expect(xrplService.finishEscrow).toHaveBeenNthCalledWith(2, expect.anything(), 'rConsumerAddr', 202);
      expect(xrplService.finishEscrow).toHaveBeenNthCalledWith(3, expect.anything(), 'rConsumerAddr', 203);
      expect(prisma.chargeRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'charge-1', version: 0, status: 'pending_approval' },
        data: { version: 1 },
      });
      expect(prisma.escrowEntry.updateMany).toHaveBeenCalledTimes(3);
      expect(prisma.chargeRequest.update).toHaveBeenCalledWith({
        where: { id: 'charge-1' },
        data: expect.objectContaining({
          status: 'settled',
          txHash: 'FINISH_TX_1,FINISH_TX_2,FINISH_TX_3',
          approvedAt: expect.any(Date),
          settledAt: expect.any(Date),
        }),
        include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
      });
      expect(result.status).toBe('settled');
    });

    it('should reserve KRW-rounded decimal menu charges by whole prepaid units', async () => {
      const decimalEntries = Array.from({ length: 30 }, (_, index) => ({
        id: `decimal-entry-${index + 1}`,
        month: index + 1,
        sequence: 500 + index,
        amount: '0.740741',
        status: 'pending',
      }));
      const decimalEscrow = {
        ...prepaidEscrow,
        unitPrice: 0.740741,
        monthlyAmount: 0.740741,
        entries: decimalEntries,
      };
      prisma.escrow.findUnique.mockResolvedValue(decimalEscrow);
      prisma.productMenuItem.findUnique.mockResolvedValue({
        ...menuItem,
        amount: 22.222222,
      });
      prisma.chargeRequest.create.mockResolvedValue({
        id: 'charge-decimal',
        escrowId: 'escrow-prepaid-1',
        menuItemId: 'menu-cut',
        menuName: '커트',
        amount: 22.222222,
        status: 'pending_approval',
        entryIds: JSON.stringify(decimalEntries.map((entry) => entry.id)),
      });

      await service.createChargeRequest(
        'escrow-prepaid-1',
        { menuItemId: 'menu-cut' },
        businessUser,
      );

      expect(prisma.chargeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 22.222222,
          entryIds: JSON.stringify(decimalEntries.map((entry) => entry.id)),
        }),
        include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
      });
    });

    it('should reserve small KRW-rounded decimal menu charges by whole prepaid units', async () => {
      const smallUnitEntries = Array.from({ length: 48 }, (_, index) => ({
        id: `small-menu-entry-${index + 1}`,
        month: index + 1,
        sequence: 600 + index,
        amount: '0.007407',
        status: 'pending',
      }));
      const smallUnitEscrow = {
        ...prepaidEscrow,
        unitPrice: 0.007407,
        monthlyAmount: 0.007407,
        entries: smallUnitEntries,
      };
      prisma.escrow.findUnique.mockResolvedValue(smallUnitEscrow);
      prisma.productMenuItem.findUnique.mockResolvedValue({
        ...menuItem,
        amount: 0.355556,
      });
      prisma.chargeRequest.create.mockResolvedValue({
        id: 'charge-small-decimal',
        escrowId: 'escrow-prepaid-1',
        menuItemId: 'menu-cut',
        menuName: '커트',
        amount: 0.355556,
        status: 'pending_approval',
        entryIds: JSON.stringify(smallUnitEntries.map((entry) => entry.id)),
      });

      await service.createChargeRequest(
        'escrow-prepaid-1',
        { menuItemId: 'menu-cut' },
        businessUser,
      );

      expect(prisma.chargeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 0.355556,
          entryIds: JSON.stringify(smallUnitEntries.map((entry) => entry.id)),
        }),
        include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
      });
    });
  });

  describe('refund review requests', () => {
    const refundableEscrow = {
      id: 'escrow-refund-1',
      consumerId: 'consumer-1',
      businessId: 'business-1',
      status: 'active',
      escrowType: 'prepaid',
      business: { ...mockBusiness, registrationNumber: '1234567890' },
      entries: [
        { id: 'entry-used', amount: '10', status: 'released' },
        { id: 'entry-pending-1', amount: '20', status: 'pending' },
        { id: 'entry-pending-2', amount: '10', status: 'pending' },
      ],
    };
    const refundReviewInput = {
      reason: '폐업 안내문을 확인했고 남은 이용권 환불 검토를 요청합니다.',
      photoDataUrls: ['data:image/png;base64,ZmFrZS1pbWFnZQ=='],
    };

    it('should create a platform review case without immediately exposing it to the merchant', async () => {
      prisma.escrow.findUnique.mockResolvedValue(refundableEscrow);
      prisma.refundReviewRequest.findFirst.mockResolvedValue(null);
      prisma.refundReviewRequest.create.mockResolvedValue({
        id: 'refund-review-1',
        escrowId: 'escrow-refund-1',
        status: 'platform_review',
        refundableAmount: 30,
        consumerReason: refundReviewInput.reason,
        photoDataUrlsJson: JSON.stringify(refundReviewInput.photoDataUrls),
      });

      const result = await service.requestRefundReview('escrow-refund-1', consumerUser, refundReviewInput);

      expect(businessClosureService.checkBusinessStatus).toHaveBeenCalledWith('1234567890');
      expect(prisma.refundReviewRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          escrowId: 'escrow-refund-1',
          consumerId: 'consumer-1',
          businessId: 'business-1',
          status: 'platform_review',
          refundableAmount: 30,
          businessClosureStatus: 'active',
          businessClosureSource: 'nts',
          investigationReason: 'TrustPay가 요청 내용을 먼저 검토한 뒤 필요한 경우 사업자 답변을 요청합니다.',
          consumerReason: refundReviewInput.reason,
          photoDataUrlsJson: JSON.stringify(refundReviewInput.photoDataUrls),
          merchantRespondBy: expect.any(Date),
        }),
        include: { escrow: { include: { business: true, consumer: true } } },
      });
      expect(xrplService.cancelEscrow).not.toHaveBeenCalled();
      expect(prisma.escrowEntry.update).not.toHaveBeenCalled();
      expect(result.status).toBe('platform_review');
      expect(result.photoDataUrls).toEqual(refundReviewInput.photoDataUrls);
    });

    it('should reject refund review requests without a detailed consumer reason', async () => {
      await expect(
        service.requestRefundReview('escrow-refund-1', consumerUser, { reason: '짧음', photoDataUrls: [] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.escrow.findUnique).not.toHaveBeenCalled();
    });

    it('should keep closed-business cases in platform review with closure context', async () => {
      businessClosureService.checkBusinessStatus.mockResolvedValue({
        status: 'closed',
        source: 'nts',
        checkedAt: new Date('2026-05-14T00:00:00.000Z'),
      });
      prisma.escrow.findUnique.mockResolvedValue(refundableEscrow);
      prisma.refundReviewRequest.findFirst.mockResolvedValue(null);
      prisma.refundReviewRequest.create.mockResolvedValue({
        id: 'refund-review-closed',
        escrowId: 'escrow-refund-1',
        status: 'closure_confirmed',
        refundableAmount: 30,
      });

      await service.requestRefundReview('escrow-refund-1', consumerUser, refundReviewInput);

      expect(prisma.refundReviewRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'platform_review',
          businessClosureStatus: 'closed',
          businessClosureSource: 'nts',
          investigationReason: '국세청 사업자 상태가 폐업으로 확인되어 TrustPay 확인 절차로 전환합니다.',
        }),
        include: { escrow: { include: { business: true, consumer: true } } },
      });
    });

    it('should return an existing active refund review instead of creating a duplicate', async () => {
      const existing = {
        id: 'refund-review-existing',
        escrowId: 'escrow-refund-1',
        status: 'platform_review',
      };
      prisma.escrow.findUnique.mockResolvedValue(refundableEscrow);
      prisma.refundReviewRequest.findFirst.mockResolvedValue(existing);

      const result = await service.requestRefundReview('escrow-refund-1', consumerUser, refundReviewInput);

      expect(result).toBe(existing);
      expect(prisma.refundReviewRequest.create).not.toHaveBeenCalled();
      expect(businessClosureService.checkBusinessStatus).not.toHaveBeenCalled();
    });

    it('should use demo NTS wording instead of saying the business number is missing', async () => {
      businessClosureService.checkBusinessStatus.mockResolvedValue({
        status: 'unavailable',
        source: 'internal',
        checkedAt: new Date('2026-05-14T00:00:00.000Z'),
      });
      prisma.escrow.findUnique.mockResolvedValue(refundableEscrow);
      prisma.refundReviewRequest.findFirst.mockResolvedValue(null);
      prisma.refundReviewRequest.create.mockResolvedValue({ id: 'refund-review-demo-nts' });

      await service.requestRefundReview('escrow-refund-1', consumerUser, refundReviewInput);

      expect(prisma.refundReviewRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          investigationReason: '국세청 사업자등록번호 인증은 데모 환경에서 제한되어 TrustPay 자체 검토와 사업자 답변 기한으로 진행합니다.',
        }),
        include: { escrow: { include: { business: true, consumer: true } } },
      });
    });

    it('should let the owning business submit a requested merchant response', async () => {
      prisma.refundReviewRequest.findUnique.mockResolvedValue({
        id: 'refund-review-response',
        status: 'merchant_response_requested',
        businessId: 'business-1',
      });
      prisma.refundReviewRequest.update.mockResolvedValue({
        id: 'refund-review-response',
        status: 'merchant_responded',
        merchantResponse: '현재 리모델링 중이며 다음 주부터 이용 가능합니다. 미사용분 환불 협의 가능합니다.',
        photoDataUrlsJson: null,
      });

      const result = await service.respondToRefundReviewRequest('refund-review-response', businessUser, {
        response: '현재 리모델링 중이며 다음 주부터 이용 가능합니다. 미사용분 환불 협의 가능합니다.',
      });

      expect(prisma.refundReviewRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'refund-review-response' },
        data: expect.objectContaining({
          status: 'merchant_responded',
          merchantResponse: '현재 리모델링 중이며 다음 주부터 이용 가능합니다. 미사용분 환불 협의 가능합니다.',
          merchantRespondedAt: expect.any(Date),
        }),
      }));
      expect(result.status).toBe('merchant_responded');
    });
  });

  describe('cancelEscrow', () => {
    it('should cancel all pending entries and update escrow status', async () => {
      const escrow = {
        id: 'escrow-1',
        consumerId: 'consumer-1',
        consumerAddress: 'rConsumerAddr',
        entries: [
          { id: 'entry-1', month: 1, sequence: 100, status: 'released', version: 0 },
          { id: 'entry-2', month: 2, sequence: 101, status: 'pending', version: 0 },
          { id: 'entry-3', month: 3, sequence: 102, status: 'pending', version: 0 },
        ],
      };
      prisma.escrow.findUnique.mockResolvedValue(escrow);
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);

      const result = await service.cancelEscrow('escrow-1', consumerUser);

      // Should only cancel pending entries (2 and 3), not released (1)
      expect(xrplService.cancelEscrow).toHaveBeenCalledTimes(2);
      expect(prisma.escrowEntry.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.escrow.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: { status: 'cancelled' },
      });
      expect(result).toEqual({ cancelled: 2, failed: 0 });
    });

    it('should keep escrow retryable when one pending entry cancellation fails', async () => {
      const escrow = {
        id: 'escrow-1',
        consumerId: 'consumer-1',
        consumerAddress: 'rConsumerAddr',
        entries: [
          { id: 'entry-1', month: 1, sequence: 100, status: 'pending', version: 0 },
          { id: 'entry-2', month: 2, sequence: 101, status: 'pending', version: 0 },
        ],
      };
      prisma.escrow.findUnique.mockResolvedValue(escrow);
      prisma.consumer.findUnique.mockResolvedValue(mockConsumer);
      xrplService.cancelEscrow
        .mockRejectedValueOnce(new Error('XRPL error'))
        .mockResolvedValueOnce('CANCEL_TX_2');

      const result = await service.cancelEscrow('escrow-1', consumerUser);

      expect(prisma.escrow.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: { status: 'cancel_failed' },
      });
      // Only the successful entry gets DB update
      expect(prisma.escrowEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ cancelled: 1, failed: 1 });
    });

    it('should throw if escrow not found', async () => {
      prisma.escrow.findUnique.mockResolvedValue(null);
      await expect(service.cancelEscrow('bad-id', consumerUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByConsumer', () => {
    it('should return escrows for a consumer', async () => {
      const escrows = [{ id: 'e-1' }, { id: 'e-2' }];
      prisma.escrow.findMany.mockResolvedValue(escrows);

      const result = await service.findByConsumer('consumer-1', consumerUser);

      expect(prisma.escrow.findMany).toHaveBeenCalledWith({
        where: { consumerId: 'consumer-1' },
        include: {
          entries: true,
          business: true,
          product: { include: { menuItems: true } },
          chargeRequests: { include: { menuItem: true } },
          refundReviewRequests: { orderBy: { requestedAt: 'desc' } },
        },
      });
      expect(result).toEqual(escrows);
    });
  });
});
