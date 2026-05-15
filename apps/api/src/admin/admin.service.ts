import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminRefundReviewListInput, AdminRequestMerchantResponseInput, AdminResolveRefundReviewInput } from '@prepaid-shield/validators';

type AdminSession = { role: string };
const RESOLVED_REFUND_REVIEW_STATUSES = ['platform_approved', 'rejected', 'refunded'];
const TERMINAL_REFUND_REVIEW_STATUSES = new Set(RESOLVED_REFUND_REVIEW_STATUSES);
const OPEN_REFUND_REVIEW_STATUSES = ['platform_review', 'merchant_response_requested', 'merchant_responded', 'merchant_review', 'platform_investigation'];
const WAITING_MERCHANT_STATUSES = new Set(['merchant_response_requested', 'merchant_review']);
const DASHBOARD_REFUND_REVIEW_STATUSES = [...OPEN_REFUND_REVIEW_STATUSES, ...RESOLVED_REFUND_REVIEW_STATUSES];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parsePhotoDataUrls(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function addBusinessDays(value: Date, days: number): Date {
  const result = new Date(value);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

function asNumber(value: unknown): number {
  return Number(value || 0);
}

function daysUntil(value: Date | string | null | undefined, now = new Date()): number {
  const deadline = value ? new Date(value).getTime() : now.getTime();
  return Math.floor((deadline - now.getTime()) / ONE_DAY_MS);
}

function getParticipantName(review: any, role: 'business' | 'consumer'): string {
  return review.escrow?.[role]?.name ?? `${role === 'business' ? '사업자' : '소비자'} 미확인`;
}

function buildDashboardByStatus(reviews: any[]) {
  return {
    platformReview: reviews.filter((review) => review.status === 'platform_review').length,
    waitingMerchant: reviews.filter((review) => WAITING_MERCHANT_STATUSES.has(review.status)).length,
    merchantResponded: reviews.filter((review) => review.status === 'merchant_responded').length,
    platformInvestigation: reviews.filter((review) => review.status === 'platform_investigation').length,
    resolved: reviews.filter((review) => TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)).length,
  };
}

function buildDashboardSlaMetrics(reviews: any[]) {
  const slaRisks = reviews
    .filter((review) => WAITING_MERCHANT_STATUSES.has(review.status))
    .map((review) => ({
      id: review.id,
      businessName: getParticipantName(review, 'business'),
      consumerName: getParticipantName(review, 'consumer'),
      refundableAmount: asNumber(review.refundableAmount),
      daysRemaining: daysUntil(review.merchantRespondBy),
      status: review.status,
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    slaRisks,
    slaOverdue: slaRisks.filter((risk) => risk.daysRemaining < 0).length,
    slaDueSoon: slaRisks.filter((risk) => risk.daysRemaining >= 0 && risk.daysRemaining <= 1).length,
  };
}

function buildDashboardEscrowAmounts(escrows: any[]) {
  return escrows.reduce((totals, escrow) => {
    const entries = escrow.entries ?? [];
    const released = entries.filter((entry: any) => entry.status === 'released').reduce((sum: number, entry: any) => sum + asNumber(entry.amount), 0);
    const pending = entries.filter((entry: any) => entry.status === 'pending').reduce((sum: number, entry: any) => sum + asNumber(entry.amount), 0);
    const refunded = entries.filter((entry: any) => entry.status === 'refunded').reduce((sum: number, entry: any) => sum + asNumber(entry.amount), 0);
    const frozen = Math.max(0, ...(escrow.refundReviewRequests ?? [])
      .filter((review: any) => OPEN_REFUND_REVIEW_STATUSES.includes(review.status))
      .map((review: any) => asNumber(review.refundableAmount)));

    totals.releasedAmount += released;
    totals.pendingAmount += Math.max(pending - frozen, 0);
    totals.frozenByRefundReviewAmount += frozen;
    totals.refundedAmount += refunded;
    return totals;
  }, { releasedAmount: 0, pendingAmount: 0, frozenByRefundReviewAmount: 0, refundedAmount: 0 });
}

function buildDashboardRecentEvents(reviews: any[]) {
  return reviews
    .map((review) => {
      const isResolved = TERMINAL_REFUND_REVIEW_STATUSES.has(review.status);
      const isMerchantResponded = review.status === 'merchant_responded' || review.merchantRespondedAt;
      const type = isResolved ? review.status : isMerchantResponded ? 'merchant_responded' : review.status;
      const label = isResolved
        ? review.status === 'platform_approved' ? '환불 승인' : review.status === 'rejected' ? '환불 거절' : '환불 완료'
        : isMerchantResponded ? '사업자 답변 도착' : review.status === 'platform_investigation' ? '추가 확인' : '환불 검토 접수';
      const occurredAt = (isResolved ? review.resolvedAt : isMerchantResponded ? review.merchantRespondedAt : review.requestedAt) ?? review.requestedAt;
      return {
        id: review.id,
        type,
        label,
        businessName: getParticipantName(review, 'business'),
        consumerName: getParticipantName(review, 'consumer'),
        amount: asNumber(review.refundableAmount),
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
        status: review.status,
      };
    })
    .filter((event) => event.occurredAt)
    .sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime())
    .slice(0, 6);
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(user: AdminSession) {
    this.assertAdmin(user);
    const [open, merchantResponseRequested, merchantResponded, platformInvestigation, businesses, consumers, activeEscrows, dashboardReviews, dashboardEscrows] = await Promise.all([
      this.prisma.refundReviewRequest.count({ where: { status: { in: OPEN_REFUND_REVIEW_STATUSES } } }),
      this.prisma.refundReviewRequest.count({ where: { status: 'merchant_response_requested' } }),
      this.prisma.refundReviewRequest.count({ where: { status: 'merchant_responded' } }),
      this.prisma.refundReviewRequest.count({ where: { status: 'platform_investigation' } }),
      this.prisma.business.count(),
      this.prisma.consumer.count(),
      this.prisma.escrow.count({ where: { status: 'active' } }),
      this.prisma.refundReviewRequest.findMany({
        where: { status: { in: DASHBOARD_REFUND_REVIEW_STATUSES } },
        select: {
          id: true,
          status: true,
          refundableAmount: true,
          requestedAt: true,
          resolvedAt: true,
          merchantRespondBy: true,
          merchantRespondedAt: true,
          escrow: {
            select: {
              business: { select: { name: true } },
              consumer: { select: { name: true } },
            },
          },
        },
        orderBy: [{ requestedAt: 'desc' }],
      }),
      this.prisma.escrow.findMany({
        select: {
          entries: { select: { status: true, amount: true } },
          refundReviewRequests: { select: { status: true, refundableAmount: true } },
        },
      }),
    ]);
    const slaMetrics = buildDashboardSlaMetrics(dashboardReviews);

    return {
      refundReviews: {
        open,
        merchantResponseRequested,
        merchantResponded,
        platformInvestigation,
        byStatus: buildDashboardByStatus(dashboardReviews),
        ...slaMetrics,
      },
      businesses: { total: businesses },
      consumers: { total: consumers },
      escrows: { active: activeEscrows, ...buildDashboardEscrowAmounts(dashboardEscrows) },
      recentEvents: buildDashboardRecentEvents(dashboardReviews),
    };
  }

  async listBusinesses(user: AdminSession) {
    this.assertAdmin(user);
    const businesses = await this.prisma.business.findMany({
      include: { _count: { select: { products: true, escrows: true, refundReviewRequests: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });
    return businesses.map((business) => this.stripSecret(business));
  }

  async listConsumers(user: AdminSession) {
    this.assertAdmin(user);
    const consumers = await this.prisma.consumer.findMany({
      include: { _count: { select: { escrows: true, chargeRequests: true, refundReviewRequests: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });
    return consumers.map((consumer) => this.stripSecret(consumer));
  }

  async listEscrows(user: AdminSession) {
    this.assertAdmin(user);
    const escrows = await this.prisma.escrow.findMany({
      include: {
        business: true,
        consumer: true,
        entries: true,
        chargeRequests: true,
        refundReviewRequests: { orderBy: { requestedAt: 'desc' } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    return escrows.map((escrow) => ({
      ...escrow,
      business: escrow.business ? this.stripSecret(escrow.business) : escrow.business,
      consumer: escrow.consumer ? this.stripSecret(escrow.consumer) : escrow.consumer,
      refundReviewRequests: (escrow.refundReviewRequests ?? []).map((review: any) => this.serializeRefundReview(review)),
    }));
  }

  async listRefundReviews(user: AdminSession, query: AdminRefundReviewListInput) {
    this.assertAdmin(user);
    const reviews = await this.prisma.refundReviewRequest.findMany({
      where: { status: query.status ?? { in: OPEN_REFUND_REVIEW_STATUSES } },
      include: this.refundReviewInclude(),
      orderBy: [{ requestedAt: 'asc' }],
    });
    return reviews.map((review) => this.serializeRefundReview(review));
  }

  async getRefundReview(user: AdminSession, id: string) {
    this.assertAdmin(user);
    const review = await this.prisma.refundReviewRequest.findUnique({
      where: { id },
      include: this.refundReviewInclude(),
    });
    if (!review) throw new NotFoundException('Refund review not found');
    return this.serializeRefundReview(review);
  }

  async requestMerchantResponse(user: AdminSession, id: string, dto: AdminRequestMerchantResponseInput) {
    this.assertAdmin(user);
    const existing = await this.requireRefundReview(id);
    if (TERMINAL_REFUND_REVIEW_STATUSES.has(existing.status)) {
      throw new BadRequestException('이미 종료된 환불 검토입니다');
    }
    const review = await this.prisma.refundReviewRequest.update({
      where: { id },
      data: {
        status: 'merchant_response_requested',
        merchantNotice: dto.merchantNotice,
        merchantRespondBy: addBusinessDays(new Date(), 3),
      },
      include: this.refundReviewInclude(),
    });
    return this.serializeRefundReview(review);
  }

  async resolveRefundReview(user: AdminSession, id: string, dto: AdminResolveRefundReviewInput) {
    this.assertAdmin(user);
    const existing = await this.requireRefundReview(id);
    if (TERMINAL_REFUND_REVIEW_STATUSES.has(existing.status)) {
      throw new BadRequestException('이미 종료된 환불 검토입니다');
    }
    const status = dto.decision === 'approve'
      ? 'platform_approved'
      : dto.decision === 'reject'
        ? 'rejected'
        : 'platform_investigation';
    const review = await this.prisma.refundReviewRequest.update({
      where: { id },
      data: {
        status,
        adminResolutionReason: dto.reason ?? null,
        resolvedAt: dto.decision === 'investigate' ? null : new Date(),
      },
      include: this.refundReviewInclude(),
    });
    return this.serializeRefundReview(review);
  }

  private async requireRefundReview(id: string) {
    const review = await this.prisma.refundReviewRequest.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Refund review not found');
    return review;
  }

  private assertAdmin(user: AdminSession) {
    if (user.role !== 'admin') throw new ForbiddenException('운영자 권한이 필요합니다');
  }

  private refundReviewInclude() {
    return {
      escrow: {
        include: {
          entries: true,
          chargeRequests: true,
          business: true,
          consumer: true,
        },
      },
    } as const;
  }

  private stripSecret(record: any) {
    const { xrplSecret: _secret, ...rest } = record;
    return rest;
  }

  private serializeRefundReview(review: any) {
    const { photoDataUrlsJson, ...rest } = review;
    const serialized = { ...rest, photoDataUrls: parsePhotoDataUrls(photoDataUrlsJson) };
    if (serialized.escrow?.business) {
      const { xrplSecret: _, ...business } = serialized.escrow.business;
      serialized.escrow = { ...serialized.escrow, business };
    }
    if (serialized.escrow?.consumer) {
      const { xrplSecret: _, ...consumer } = serialized.escrow.consumer;
      serialized.escrow = { ...serialized.escrow, consumer };
    }
    return serialized;
  }
}
