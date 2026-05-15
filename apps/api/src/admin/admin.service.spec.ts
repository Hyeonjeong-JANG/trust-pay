import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { adminResolveRefundReviewSchema } from '@prepaid-shield/validators';

const adminUser = { userId: 'admin-1', role: 'admin' as const, name: 'TrustPay 운영자' };
const businessUser = { userId: 'business-1', role: 'business' as const, name: '사업자' };

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      business: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      consumer: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      escrow: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      refundReviewRequest: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new AdminService(prisma as PrismaService);
  });

  it('lists refund review cases for admin users only', async () => {
    prisma.refundReviewRequest.findMany.mockResolvedValue([
      {
        id: 'refund-review-1',
        status: 'platform_review',
        consumerReason: '2주 넘게 영업하지 않아 환불 검토를 요청합니다.',
        photoDataUrlsJson: JSON.stringify(['data:image/png;base64,ZmFrZQ==']),
        escrow: {
          id: 'escrow-1',
          totalAmount: 600,
          entries: [],
          chargeRequests: [],
          business: { id: 'business-1', name: '파워짐', xrplSecret: 'secret' },
          consumer: { id: 'consumer-1', name: '김민수', xrplSecret: 'secret' },
        },
      },
    ]);

    const result = await service.listRefundReviews(adminUser, { status: 'platform_review' });

    expect(prisma.refundReviewRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'platform_review' },
      orderBy: [{ requestedAt: 'asc' }],
    }));
    expect(result[0].photoDataUrls).toEqual(['data:image/png;base64,ZmFrZQ==']);
    expect(result[0].escrow.business).not.toHaveProperty('xrplSecret');
    await expect(service.listRefundReviews(businessUser, {})).rejects.toThrow(ForbiddenException);
  });

  it('defaults refund review lists to open operational statuses', async () => {
    prisma.refundReviewRequest.findMany.mockResolvedValue([]);

    await service.listRefundReviews(adminUser, {});

    expect(prisma.refundReviewRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['platform_review', 'merchant_response_requested', 'merchant_responded', 'merchant_review', 'platform_investigation'] } },
      orderBy: [{ requestedAt: 'asc' }],
    }));
  });

  it('returns dashboard counts for admin operations tabs', async () => {
    prisma.refundReviewRequest.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4);
    prisma.business.count.mockResolvedValue(7);
    prisma.consumer.count.mockResolvedValue(11);
    prisma.escrow.count.mockResolvedValue(5);
    prisma.refundReviewRequest.findMany.mockResolvedValue([]);
    prisma.escrow.findMany.mockResolvedValue([]);

    const result = await service.getDashboard(adminUser);

    expect(result).toEqual({
      refundReviews: {
        open: 3,
        merchantResponseRequested: 2,
        merchantResponded: 1,
        platformInvestigation: 4,
        byStatus: {
          platformReview: 0,
          waitingMerchant: 0,
          merchantResponded: 0,
          platformInvestigation: 0,
          resolved: 0,
        },
        slaRisks: [],
        slaDueSoon: 0,
        slaOverdue: 0,
      },
      businesses: { total: 7 },
      consumers: { total: 11 },
      escrows: {
        active: 5,
        releasedAmount: 0,
        pendingAmount: 0,
        frozenByRefundReviewAmount: 0,
        refundedAmount: 0,
      },
      recentEvents: [],
    });
    expect(prisma.refundReviewRequest.count).toHaveBeenCalledWith({
      where: { status: { in: ['platform_review', 'merchant_response_requested', 'merchant_responded', 'merchant_review', 'platform_investigation'] } },
    });
  });

  it('returns chart-ready dashboard metrics without exposing refund evidence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T00:00:00.000Z'));
    prisma.refundReviewRequest.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.business.count.mockResolvedValue(2);
    prisma.consumer.count.mockResolvedValue(3);
    prisma.escrow.count.mockResolvedValue(2);
    prisma.refundReviewRequest.findMany.mockResolvedValue([
      {
        id: 'platform',
        status: 'platform_review',
        refundableAmount: 300,
        requestedAt: new Date('2026-05-14T01:00:00.000Z'),
        merchantRespondBy: new Date('2026-05-18T00:00:00.000Z'),
        consumerReason: '비공개 소비자 사유',
        photoDataUrlsJson: JSON.stringify(['data:image/png;base64,ZmFrZQ==']),
        escrow: { business: { name: '파워짐' }, consumer: { name: '김민수' } },
      },
      {
        id: 'late',
        status: 'merchant_review',
        refundableAmount: 500,
        requestedAt: new Date('2026-05-12T01:00:00.000Z'),
        merchantRespondBy: new Date('2026-05-14T00:00:00.000Z'),
        escrow: { business: { name: '파워짐' }, consumer: { name: '오하준' } },
      },
      {
        id: 'soon',
        status: 'merchant_response_requested',
        refundableAmount: 110,
        requestedAt: new Date('2026-05-13T01:00:00.000Z'),
        merchantRespondBy: new Date('2026-05-16T00:00:00.000Z'),
        escrow: { business: { name: '크린토피아' }, consumer: { name: '정다은' } },
      },
      {
        id: 'responded',
        status: 'merchant_responded',
        refundableAmount: 220,
        requestedAt: new Date('2026-05-13T02:00:00.000Z'),
        merchantRespondedAt: new Date('2026-05-15T01:20:00.000Z'),
        merchantRespondBy: new Date('2026-05-16T00:00:00.000Z'),
        escrow: { business: { name: '헤어살롱 루나' }, consumer: { name: '정다은' } },
      },
      {
        id: 'investigation',
        status: 'platform_investigation',
        refundableAmount: 750,
        requestedAt: new Date('2026-05-15T00:45:00.000Z'),
        merchantRespondBy: new Date('2026-05-22T00:00:00.000Z'),
        escrow: { business: { name: '정상어학원' }, consumer: { name: '최유나' } },
      },
      {
        id: 'approved',
        status: 'platform_approved',
        refundableAmount: 300,
        requestedAt: new Date('2026-05-09T01:00:00.000Z'),
        resolvedAt: new Date('2026-05-10T06:20:00.000Z'),
        merchantRespondBy: new Date('2026-05-12T00:00:00.000Z'),
        escrow: { business: { name: '헤어살롱 루나' }, consumer: { name: '김민수' } },
      },
      {
        id: 'rejected',
        status: 'rejected',
        refundableAmount: 0,
        requestedAt: new Date('2026-04-18T01:00:00.000Z'),
        resolvedAt: new Date('2026-04-19T04:30:00.000Z'),
        merchantRespondBy: new Date('2026-04-20T00:00:00.000Z'),
        escrow: { business: { name: '정상어학원' }, consumer: { name: '오하준' } },
      },
    ]);
    prisma.escrow.findMany.mockResolvedValue([
      {
        id: 'escrow-1',
        entries: [
          { status: 'released', amount: '100' },
          { status: 'pending', amount: '100' },
          { status: 'pending', amount: '100' },
          { status: 'pending', amount: '100' },
          { status: 'pending', amount: '100' },
          { status: 'pending', amount: '100' },
        ],
        refundReviewRequests: [{ status: 'merchant_review', refundableAmount: 500 }],
      },
      {
        id: 'escrow-2',
        entries: [{ status: 'released', amount: '40' }, { status: 'pending', amount: '110' }],
        refundReviewRequests: [],
      },
      {
        id: 'escrow-3',
        entries: [{ status: 'released', amount: '100' }, { status: 'refunded', amount: '300' }],
        refundReviewRequests: [{ status: 'platform_approved', refundableAmount: 300 }],
      },
    ]);

    try {
      const result = await service.getDashboard(adminUser);

      expect(result.refundReviews.byStatus).toEqual({
        platformReview: 1,
        waitingMerchant: 2,
        merchantResponded: 1,
        platformInvestigation: 1,
        resolved: 2,
      });
      expect(result.refundReviews.slaRisks).toEqual([
        { id: 'late', businessName: '파워짐', consumerName: '오하준', refundableAmount: 500, daysRemaining: -1, status: 'merchant_review' },
        { id: 'soon', businessName: '크린토피아', consumerName: '정다은', refundableAmount: 110, daysRemaining: 1, status: 'merchant_response_requested' },
      ]);
      expect(result.refundReviews.slaOverdue).toBe(1);
      expect(result.refundReviews.slaDueSoon).toBe(1);
      expect(result.escrows).toMatchObject({
        active: 2,
        releasedAmount: 240,
        pendingAmount: 110,
        frozenByRefundReviewAmount: 500,
        refundedAmount: 300,
      });
      expect(result.recentEvents[0]).toMatchObject({
        id: 'responded',
        type: 'merchant_responded',
        label: '사업자 답변 도착',
        businessName: '헤어살롱 루나',
        consumerName: '정다은',
        amount: 220,
        occurredAt: '2026-05-15T01:20:00.000Z',
      });
      expect(JSON.stringify(result)).not.toContain('비공개 소비자 사유');
      expect(JSON.stringify(result)).not.toContain('photoDataUrls');
    } finally {
      jest.useRealTimers();
    }
  });

  it('lists businesses without secrets for admin review', async () => {
    prisma.business.findMany.mockResolvedValue([
      {
        id: 'business-1',
        name: '파워짐',
        category: '헬스장',
        registrationNumber: '1010100002',
        registrationVerificationStatus: 'demo_verified',
        isActive: true,
        xrplSecret: 'secret',
        _count: { products: 1, escrows: 2, refundReviewRequests: 1 },
      },
    ]);

    const result = await service.listBusinesses(adminUser);

    expect(prisma.business.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { _count: { select: { products: true, escrows: true, refundReviewRequests: true } } },
    }));
    expect(result[0]).not.toHaveProperty('xrplSecret');
    expect(result[0]._count).toEqual({ products: 1, escrows: 2, refundReviewRequests: 1 });
  });

  it('lists consumers without secrets for admin review', async () => {
    prisma.consumer.findMany.mockResolvedValue([
      {
        id: 'consumer-1',
        name: '김민수',
        phone: '01020000001',
        xrplSecret: 'secret',
        _count: { escrows: 2, chargeRequests: 3, refundReviewRequests: 1 },
      },
    ]);

    const result = await service.listConsumers(adminUser);

    expect(prisma.consumer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { _count: { select: { escrows: true, chargeRequests: true, refundReviewRequests: true } } },
    }));
    expect(result[0]).not.toHaveProperty('xrplSecret');
  });

  it('lists escrows with sanitized participants for admin review', async () => {
    prisma.escrow.findMany.mockResolvedValue([
      {
        id: 'escrow-1',
        status: 'active',
        totalAmount: 600,
        business: { id: 'business-1', name: '파워짐', xrplSecret: 'secret' },
        consumer: { id: 'consumer-1', name: '김민수', xrplSecret: 'secret' },
        entries: [],
        chargeRequests: [],
        refundReviewRequests: [{ id: 'review-1', photoDataUrlsJson: null }],
      },
    ]);

    const result = await service.listEscrows(adminUser);

    expect(prisma.escrow.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ business: true, consumer: true }),
    }));
    expect(result[0].business).not.toHaveProperty('xrplSecret');
    expect(result[0].consumer).not.toHaveProperty('xrplSecret');
  });

  it('requests a merchant response with an admin-written notice', async () => {
    prisma.refundReviewRequest.findUnique.mockResolvedValue({ id: 'refund-review-1', status: 'platform_review' });
    prisma.refundReviewRequest.update.mockResolvedValue({
      id: 'refund-review-1',
      status: 'merchant_response_requested',
      merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
      photoDataUrlsJson: null,
    });

    const result = await service.requestMerchantResponse(adminUser, 'refund-review-1', {
      merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
    });

    expect(prisma.refundReviewRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'refund-review-1' },
      data: expect.objectContaining({
        status: 'merchant_response_requested',
        merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
        merchantRespondBy: expect.any(Date),
      }),
    }));
    expect(result.status).toBe('merchant_response_requested');
  });

  it('resolves a refund review by approving or rejecting it', async () => {
    prisma.refundReviewRequest.findUnique.mockResolvedValue({ id: 'refund-review-1', status: 'platform_review' });
    prisma.refundReviewRequest.update.mockResolvedValue({
      id: 'refund-review-1',
      status: 'platform_approved',
      adminResolutionReason: '사업자 답변이 없어 미사용분 환불을 승인합니다.',
      photoDataUrlsJson: null,
    });

    const result = await service.resolveRefundReview(adminUser, 'refund-review-1', {
      decision: 'approve',
      reason: '사업자 답변이 없어 미사용분 환불을 승인합니다.',
    });

    expect(prisma.refundReviewRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'platform_approved',
        adminResolutionReason: '사업자 답변이 없어 미사용분 환불을 승인합니다.',
        resolvedAt: expect.any(Date),
      }),
    }));
    expect(result.status).toBe('platform_approved');
  });

  it('allows refund approval without forcing an operator-entered reason', async () => {
    prisma.refundReviewRequest.findUnique.mockResolvedValue({ id: 'refund-review-1', status: 'platform_review' });
    prisma.refundReviewRequest.update.mockResolvedValue({
      id: 'refund-review-1',
      status: 'platform_approved',
      adminResolutionReason: null,
      photoDataUrlsJson: null,
    });

    const result = await service.resolveRefundReview(adminUser, 'refund-review-1', {
      decision: 'approve',
    } as any);

    expect(prisma.refundReviewRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'platform_approved',
        adminResolutionReason: null,
        resolvedAt: expect.any(Date),
      }),
    }));
    expect(result.status).toBe('platform_approved');
  });

  it('validates refund resolution reasons by decision type', () => {
    expect(adminResolveRefundReviewSchema.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(adminResolveRefundReviewSchema.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(adminResolveRefundReviewSchema.safeParse({ decision: 'investigate', reason: '짧음' }).success).toBe(false);
    expect(adminResolveRefundReviewSchema.safeParse({ decision: 'reject', reason: '사업자 답변과 이용 내역상 환불 대상이 아닙니다.' }).success).toBe(true);
  });

  it('throws when the refund review case does not exist', async () => {
    prisma.refundReviewRequest.findUnique.mockResolvedValue(null);

    await expect(service.requestMerchantResponse(adminUser, 'missing', { merchantNotice: '상황을 설명해주세요.' })).rejects.toThrow(NotFoundException);
  });

  it('does not request merchant response for terminal cases', async () => {
    prisma.refundReviewRequest.findUnique.mockResolvedValue({ id: 'refund-review-1', status: 'platform_approved' });

    await expect(service.requestMerchantResponse(adminUser, 'refund-review-1', {
      merchantNotice: '상황을 설명해주세요.',
    })).rejects.toThrow('이미 종료된 환불 검토입니다');
    expect(prisma.refundReviewRequest.update).not.toHaveBeenCalled();
  });
});
