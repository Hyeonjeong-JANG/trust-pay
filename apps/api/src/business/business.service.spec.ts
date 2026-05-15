import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import { BusinessClosureService } from './business-closure.service';
import { PaymentRequestService } from '../payment-request/payment-request.service';

const mockBusiness = {
  id: 'biz-1',
  name: '테스트카페',
  category: '카페',
  address: '서울시 강남구',
  phone: '010-1234-5678',
  email: 'cafe@test.com',
  registrationNumber: '1234567890',
  registrationVerificationStatus: 'demo_verified',
  registrationVerificationSource: 'demo',
  registrationVerifiedAt: new Date('2026-01-01'),
  xrplAddress: 'rBizAddr123',
  xrplSecret: 'encrypted:sBizSecret123',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const businessUser = { userId: 'biz-1', role: 'business' as const, name: '테스트카페' };

describe('BusinessService', () => {
  let service: BusinessService;
  let prisma: any;
  let xrplService: any;
  let businessClosureService: any;
  let paymentRequestService: any;

  beforeEach(async () => {
    prisma = {
      business: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      escrowEntry: { update: jest.fn() },
      escrow: { update: jest.fn() },
      businessProduct: { findMany: jest.fn() },
    };

    xrplService = {
      createWallet: jest.fn().mockResolvedValue({
        wallet: { classicAddress: 'rBizAddr123' },
        address: 'rBizAddr123',
        secret: 'sBizSecret123',
      }),
      setTrustLine: jest.fn().mockResolvedValue('TX_HASH'),
      finishEscrow: jest.fn().mockResolvedValue('FINISH_TX_HASH'),
    };

    businessClosureService = {
      checkBusinessStatus: jest.fn().mockResolvedValue({
        status: 'unavailable',
        source: 'internal',
        checkedAt: new Date('2026-05-14T00:00:00.000Z'),
      }),
    };
    paymentRequestService = {
      listForBusiness: jest.fn().mockReturnValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        BusinessService,
        { provide: PrismaService, useValue: prisma },
        { provide: XrplService, useValue: xrplService },
        { provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => 'encrypted:' + v), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
        { provide: BusinessClosureService, useValue: businessClosureService },
        { provide: PaymentRequestService, useValue: paymentRequestService },
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
        registrationNumber: '123-45-67890',
      });

      expect(businessClosureService.checkBusinessStatus).toHaveBeenCalledWith('1234567890');
      expect(xrplService.createWallet).toHaveBeenCalled();
      expect(xrplService.setTrustLine).toHaveBeenCalled();
      expect(prisma.business.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '테스트카페',
          category: '카페',
          address: '서울시 강남구',
          registrationNumber: '1234567890',
          registrationVerificationStatus: 'demo_verified',
          registrationVerificationSource: 'demo',
          registrationVerifiedAt: expect.any(Date),
          xrplAddress: 'rBizAddr123',
          xrplSecret: 'encrypted:sBizSecret123',
        }),
      });
      // Should NOT include xrplSecret in response
      expect(result).not.toHaveProperty('xrplSecret');
      expect(result).toHaveProperty('name', '테스트카페');
    });

    it('should reject registration without a business registration number', async () => {
      await expect(service.register({
        name: '테스트카페',
        category: '카페',
        address: '서울시 강남구',
        phone: '010-1234-5678',
      } as any)).rejects.toThrow(BadRequestException);

      expect(prisma.business.create).not.toHaveBeenCalled();
      expect(xrplService.createWallet).not.toHaveBeenCalled();
    });

    it('should expose a demo NTS verification result when real NTS is unavailable', async () => {
      const result = await service.verifyRegistrationNumber('123-45-67890');

      expect(businessClosureService.checkBusinessStatus).toHaveBeenCalledWith('1234567890');
      expect(result).toEqual({
        registrationNumber: '1234567890',
        status: 'demo_verified',
        source: 'demo',
        checkedAt: expect.any(Date),
        message: '국세청 사업자등록번호 인증은 데모 환경에서 모의 인증으로 진행됩니다.',
      });
    });
  });

  describe('findById', () => {
    it('should return business without secret', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);

      const result = await service.findById('biz-1', businessUser);

      expect(result).not.toHaveProperty('xrplSecret');
      expect(result).toHaveProperty('xrplAddress', 'rBizAddr123');
    });

    it('should throw if business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(
        service.findById('bad-id', { ...businessUser, userId: 'bad-id' }),
      ).rejects.toThrow(NotFoundException);
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

      const result = await service.dashboard('biz-1', businessUser);

      expect(prisma.business.findUnique).toHaveBeenCalledWith({
        where: { id: 'biz-1' },
        select: expect.objectContaining({
          id: true,
          name: true,
          xrplSecret: true,
          escrows: {
            select: expect.objectContaining({
              id: true,
              status: true,
              entries: expect.objectContaining({ select: expect.any(Object) }),
              consumer: { select: { id: true, name: true } },
            }),
          },
        }),
      });
      // e-1: 2 released * 10000 = 20000 received, 1 pending * 10000 = 10000 pending
      // e-2: 0 released = 0 received, 2 pending * 20000 = 40000 pending
      expect(result.totalReceived).toBe(20000);
      expect(result.totalPending).toBe(50000);
      expect(result.activeEscrows).toBe(2);
      expect(result.business).toEqual({ id: 'biz-1', name: '테스트카페' });
    });

    it('should aggregate prepaid voucher totals from settled charge amounts instead of ledger unit amounts', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [
          {
            id: 'e-prepaid-variable',
            status: 'active',
            escrowType: 'prepaid',
            totalAmount: 100,
            monthlyAmount: 10,
            entries: [
              { status: 'released', amount: '10' },
              { status: 'pending', amount: '10' },
            ],
            chargeRequests: [
              { status: 'settled', amount: 7.5 },
            ],
            consumer: { id: 'c-1', name: '소비자1' },
          },
        ],
      });

      const result = await service.dashboard('biz-1', businessUser);

      expect(result.totalReceived).toBe(7.5);
      expect(result.totalPending).toBe(92.5);
    });

    it('should expose platform-review status to merchants without consumer evidence', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [
          {
            id: 'e-refund-review',
            status: 'active',
            escrowType: 'prepaid',
            totalAmount: 100,
            monthlyAmount: 10,
            entries: [{ status: 'pending', amount: '10' }],
            chargeRequests: [],
            refundReviewRequests: [
              {
                id: 'refund-review-1',
                status: 'platform_review',
                consumerReason: '2주 넘게 영업하지 않아 환불을 요청합니다.',
                photoDataUrlsJson: JSON.stringify(['data:image/png;base64,ZmFrZQ==']),
              },
              {
                id: 'refund-review-2',
                status: 'merchant_response_requested',
                merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부를 답변해주세요.',
                consumerReason: '원문은 사업자에게 바로 노출하지 않습니다.',
                photoDataUrlsJson: JSON.stringify(['data:image/png;base64,c2VjcmV0']),
              },
              {
                id: 'refund-review-3',
                status: 'merchant_review',
                consumerReason: '기존 요청 원문은 사업자에게 노출하지 않습니다.',
                photoDataUrlsJson: JSON.stringify(['data:image/png;base64,bGVnYWN5']),
              },
            ],
            consumer: { id: 'c-1', name: '소비자1' },
          },
        ],
      });

      const result = await service.dashboard('biz-1', businessUser);
      const platformReview = result.escrows[0].refundReviewRequests[0];
      const merchantReview = result.escrows[0].refundReviewRequests[1];
      const legacyMerchantReview = result.escrows[0].refundReviewRequests[2];

      expect(result.escrows[0].refundReviewRequests).toHaveLength(3);
      expect(platformReview).toMatchObject({ id: 'refund-review-1', status: 'platform_review' });
      expect(platformReview).not.toHaveProperty('photoDataUrlsJson');
      expect(platformReview).not.toHaveProperty('photoDataUrls');
      expect(platformReview).not.toHaveProperty('consumerReason');
      expect(merchantReview).toMatchObject({
        id: 'refund-review-2',
        status: 'merchant_response_requested',
        merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부를 답변해주세요.',
      });
      expect(merchantReview).not.toHaveProperty('photoDataUrlsJson');
      expect(merchantReview).not.toHaveProperty('photoDataUrls');
      expect(merchantReview).not.toHaveProperty('consumerReason');
      expect(legacyMerchantReview).toMatchObject({ id: 'refund-review-3', status: 'merchant_review' });
      expect(legacyMerchantReview).not.toHaveProperty('photoDataUrlsJson');
      expect(legacyMerchantReview).not.toHaveProperty('photoDataUrls');
      expect(legacyMerchantReview).not.toHaveProperty('consumerReason');
    });

    it('should include pending merchant-created payment requests', async () => {
      const pendingRequest = {
        id: 'request-1',
        code: 'TP-000001',
        businessId: 'biz-1',
        businessName: '테스트카페',
        paymentAmount: 222.222222,
        totalAmount: 244.444444,
        paymentModel: 'voucher',
        escrowType: 'prepaid',
        status: 'pending',
        createdAt: '2026-05-15T00:00:00.000Z',
      };
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [],
      });
      paymentRequestService.listForBusiness.mockReturnValue([pendingRequest]);

      const result = await service.dashboard('biz-1', businessUser);

      expect(paymentRequestService.listForBusiness).toHaveBeenCalledWith('biz-1');
      expect(result.pendingPaymentRequests).toEqual([pendingRequest]);
      expect(result.summary).toMatchObject({
        pendingApprovalAmount: 222.222222,
        refundActionRequiredCount: 0,
        dueSettlementCount: 0,
      });
    });

    it('should summarize merchant action counts by dashboard concern', async () => {
      paymentRequestService.listForBusiness.mockReturnValue([
        {
          id: 'request-1',
          code: 'TP-000001',
          businessId: 'biz-1',
          businessName: '테스트카페',
          paymentAmount: 20,
          totalAmount: 30,
          escrowType: 'monthly',
          status: 'pending',
          createdAt: '2026-05-15T00:00:00.000Z',
        },
      ]);
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [
          {
            id: 'e-action-required',
            status: 'active',
            escrowType: 'prepaid',
            totalAmount: 100,
            monthlyAmount: 10,
            entries: [{ id: 'en-1', status: 'pending', amount: '10', finishAfter: 999999999 }],
            chargeRequests: [],
            refundReviewRequests: [{ id: 'review-1', status: 'merchant_response_requested' }],
            consumer: { id: 'c-1', name: '소비자1' },
          },
          {
            id: 'e-monitoring',
            status: 'active',
            escrowType: 'monthly',
            totalAmount: 100,
            monthlyAmount: 10,
            entries: [{ id: 'en-2', status: 'pending', amount: '10', finishAfter: 999999999 }],
            chargeRequests: [],
            refundReviewRequests: [{ id: 'review-2', status: 'platform_review' }],
            consumer: { id: 'c-2', name: '소비자2' },
          },
          {
            id: 'e-completed-review',
            status: 'cancelled',
            escrowType: 'prepaid',
            totalAmount: 100,
            monthlyAmount: 10,
            entries: [{ id: 'en-3', status: 'refunded', amount: '10', finishAfter: 999999999 }],
            chargeRequests: [],
            refundReviewRequests: [{ id: 'review-3', status: 'refunded' }],
            consumer: { id: 'c-3', name: '소비자3' },
          },
        ],
      });

      const result = await service.dashboard('biz-1', businessUser);

      expect(result.summary).toMatchObject({
        pendingApprovalAmount: 20,
        refundActionRequiredCount: 1,
        refundMonitoringCount: 1,
        refundCompletedCount: 1,
      });
    });

    it('should auto-finish eligible monthly entries before returning dashboard totals', async () => {
      const eligibleEntry = { id: 'entry-due', month: 2, amount: '10', status: 'pending', finishAfter: 1, sequence: 321 };
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [
          {
            id: 'e-due',
            status: 'active',
            escrowType: 'monthly',
            consumerAddress: 'rConsumerAddr',
            totalAmount: 30,
            monthlyAmount: 10,
            entries: [
              { id: 'entry-released', month: 1, amount: '10', status: 'released', finishAfter: 1, sequence: 320 },
              eligibleEntry,
            ],
            chargeRequests: [],
            refundReviewRequests: [],
            consumer: { id: 'c-1', name: '소비자1' },
          },
        ],
      });

      const result = await service.dashboard('biz-1', businessUser);

      expect(xrplService.finishEscrow).toHaveBeenCalledWith(expect.anything(), 'rConsumerAddr', 321);
      expect(prisma.escrowEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-due' },
        data: { status: 'released', txHash: 'FINISH_TX_HASH' },
      });
      expect(result.totalReceived).toBe(20);
      expect(result.totalPending).toBe(0);
      expect(result.summary).toMatchObject({
        receivedAmount: 20,
        protectedPendingAmount: 0,
        autoSettledCount: 1,
        autoSettledAmount: 10,
      });
    });

    it('should not retry a failed automatic settlement on every dashboard refresh', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-15T00:00:00.000Z'));
      xrplService.finishEscrow.mockRejectedValue(new Error('XRPL unavailable'));
      const businessWithDueEntry = {
        ...mockBusiness,
        escrows: [
          {
            id: 'e-retry-guard',
            status: 'active',
            escrowType: 'monthly',
            consumerAddress: 'rConsumerAddr',
            totalAmount: 30,
            monthlyAmount: 10,
            entries: [
              { id: 'entry-retry-guard', month: 1, amount: '10', status: 'pending', finishAfter: 1, sequence: 321 },
            ],
            chargeRequests: [],
            refundReviewRequests: [],
            consumer: { id: 'c-1', name: '소비자1' },
          },
        ],
      };
      prisma.business.findUnique.mockResolvedValue(businessWithDueEntry);

      try {
        await service.dashboard('biz-1', businessUser);
        await service.dashboard('biz-1', businessUser);

        expect(xrplService.finishEscrow).toHaveBeenCalledTimes(1);

        jest.setSystemTime(new Date('2026-05-15T00:01:01.000Z'));
        await service.dashboard('biz-1', businessUser);

        expect(xrplService.finishEscrow).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should return zero amounts when no escrows', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        escrows: [],
      });

      const result = await service.dashboard('biz-1', businessUser);

      expect(result.totalReceived).toBe(0);
      expect(result.totalPending).toBe(0);
      expect(result.activeEscrows).toBe(0);
    });

    it('should throw if business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(
        service.dashboard('bad-id', { ...businessUser, userId: 'bad-id' }),
      ).rejects.toThrow(NotFoundException);
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

  describe('findProducts', () => {
    it('should return active products with active menu items for a business', async () => {
      prisma.businessProduct.findMany.mockResolvedValue([
        {
          id: 'product-1',
          businessId: 'biz-1',
          name: '커피 30잔 이용권',
          escrowType: 'prepaid',
          totalAmount: 150,
          monthlyAmount: 5,
          months: 30,
          unitPrice: 5,
          validityMonths: 3,
          menuItems: [{ id: 'menu-1', name: '아메리카노', amount: 5 }],
        },
      ]);

      const result = await service.findProducts('biz-1');

      expect(prisma.businessProduct.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1', isActive: true },
        include: { menuItems: { where: { isActive: true } } },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].menuItems).toEqual([{ id: 'menu-1', name: '아메리카노', amount: 5 }]);
    });
  });
});
