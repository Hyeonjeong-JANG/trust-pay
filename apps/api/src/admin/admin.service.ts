import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminRefundReviewListInput, AdminRequestMerchantResponseInput, AdminResolveRefundReviewInput } from '@prepaid-shield/validators';

type AdminSession = { role: string };
const TERMINAL_REFUND_REVIEW_STATUSES = new Set(['platform_approved', 'rejected', 'refunded']);

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

  async listRefundReviews(user: AdminSession, query: AdminRefundReviewListInput) {
    this.assertAdmin(user);
    const reviews = await this.prisma.refundReviewRequest.findMany({
      where: query.status ? { status: query.status } : undefined,
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
        adminResolutionReason: dto.reason,
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
