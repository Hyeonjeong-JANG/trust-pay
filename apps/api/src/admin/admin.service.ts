import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminRefundReviewListInput, AdminRequestMerchantResponseInput, AdminResolveRefundReviewInput } from '@prepaid-shield/validators';

type AdminSession = { role: string };
const TERMINAL_REFUND_REVIEW_STATUSES = new Set(['platform_approved', 'rejected', 'refunded']);
const OPEN_REFUND_REVIEW_STATUSES = ['platform_review', 'merchant_response_requested', 'merchant_responded', 'merchant_review', 'platform_investigation'];

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

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(user: AdminSession) {
    this.assertAdmin(user);
    const [open, merchantResponseRequested, merchantResponded, platformInvestigation, businesses, consumers, activeEscrows] = await Promise.all([
      this.prisma.refundReviewRequest.count({ where: { status: { in: OPEN_REFUND_REVIEW_STATUSES } } }),
      this.prisma.refundReviewRequest.count({ where: { status: 'merchant_response_requested' } }),
      this.prisma.refundReviewRequest.count({ where: { status: 'merchant_responded' } }),
      this.prisma.refundReviewRequest.count({ where: { status: 'platform_investigation' } }),
      this.prisma.business.count(),
      this.prisma.consumer.count(),
      this.prisma.escrow.count({ where: { status: 'active' } }),
    ]);

    return {
      refundReviews: {
        open,
        merchantResponseRequested,
        merchantResponded,
        platformInvestigation,
      },
      businesses: { total: businesses },
      consumers: { total: consumers },
      escrows: { active: activeEscrows },
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
    if (user.role !== 'admin') throw new ForbiddenException('관리자 권한이 필요합니다');
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
