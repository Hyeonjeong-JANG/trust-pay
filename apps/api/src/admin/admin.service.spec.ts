import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

const adminUser = { userId: 'admin-1', role: 'admin' as const, name: 'TrustPay 운영자' };
const businessUser = { userId: 'business-1', role: 'business' as const, name: '사업자' };

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      refundReviewRequest: {
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
      adminResolutionReason: '사업자 소명이 없어 미사용분 환불을 승인합니다.',
      photoDataUrlsJson: null,
    });

    const result = await service.resolveRefundReview(adminUser, 'refund-review-1', {
      decision: 'approve',
      reason: '사업자 소명이 없어 미사용분 환불을 승인합니다.',
    });

    expect(prisma.refundReviewRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'platform_approved',
        adminResolutionReason: '사업자 소명이 없어 미사용분 환불을 승인합니다.',
        resolvedAt: expect.any(Date),
      }),
    }));
    expect(result.status).toBe('platform_approved');
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
