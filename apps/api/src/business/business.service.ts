import { BadRequestException, Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import type { SessionUser } from '../common/session-token';
import { BusinessClosureService } from './business-closure.service';
import { PaymentRequestService } from '../payment-request/payment-request.service';
import { Wallet } from 'xrpl';

type BusinessRegistrationVerificationStatus = 'verified' | 'demo_verified' | 'unavailable';

function normalizeRegistrationNumber(value?: string | null): string {
  return value?.replace(/\D/g, '') ?? '';
}

function parseRefundReviewPhotoDataUrls(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

const MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES = new Set([
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'merchant_review',
  'merchant_disputed',
  'platform_investigation',
  'auto_approved',
  'platform_approved',
  'refunded',
  'rejected',
]);

const REFUND_REVIEW_ACTION_REQUIRED_STATUSES = new Set([
  'merchant_response_requested',
  'merchant_review',
]);
const REFUND_REVIEW_MONITORING_STATUSES = new Set([
  'platform_review',
  'merchant_responded',
  'merchant_disputed',
  'platform_investigation',
]);
const REFUND_REVIEW_COMPLETED_STATUSES = new Set([
  'auto_approved',
  'platform_approved',
  'refunded',
  'rejected',
]);
const AUTO_SETTLEMENT_RETRY_DELAY_MS = 60_000;

function safeWalletFromSeed(secret: string): Wallet {
  try {
    return Wallet.fromSeed(secret);
  } catch {
    return Wallet.generate();
  }
}

function getRippleNow(): number {
  return Math.floor(Date.now() / 1000) - 946684800;
}

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);
  private readonly autoSettlementRetryAfterByEntryId = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
    private crypto: CryptoService,
    private businessClosureService: BusinessClosureService,
    private paymentRequestService: PaymentRequestService,
  ) {}

  async verifyRegistrationNumber(registrationNumber: string) {
    const normalized = normalizeRegistrationNumber(registrationNumber);
    if (!/^\d{10}$/.test(normalized)) {
      throw new BadRequestException('사업자등록번호 10자리를 입력해주세요');
    }

    const check = await this.businessClosureService.checkBusinessStatus(normalized);
    const status: BusinessRegistrationVerificationStatus = check.source === 'nts' && check.status === 'active'
      ? 'verified'
      : check.source === 'internal'
        ? 'demo_verified'
        : 'unavailable';
    const source = status === 'demo_verified' ? 'demo' : check.source;
    return {
      registrationNumber: normalized,
      status,
      source,
      checkedAt: check.checkedAt,
      message: status === 'verified'
        ? '국세청 사업자등록번호 인증이 완료되었습니다.'
        : status === 'demo_verified'
          ? '국세청 사업자등록번호 인증은 데모 환경에서 모의 인증으로 진행됩니다.'
          : '국세청 사업자등록번호 인증을 완료할 수 없어 TrustPay 확인 절차로 진행합니다.',
    };
  }

  async register(data: { name: string; category: string; address: string; phone?: string; email?: string; registrationNumber: string }) {
    const verification = await this.verifyRegistrationNumber(data.registrationNumber);
    if (verification.status === 'unavailable') {
      throw new BadRequestException('국세청 사업자등록번호 인증을 완료할 수 없습니다');
    }

    // Auto-create XRPL wallet + Trust Line
    const { wallet, address: xrplAddress, secret: xrplSecret } = await this.xrplService.createWallet();
    await this.xrplService.setTrustLine(wallet);

    const business = await this.prisma.business.create({
      data: {
        name: data.name,
        category: data.category,
        address: data.address,
        phone: data.phone,
        email: data.email,
        registrationNumber: verification.registrationNumber,
        registrationVerificationStatus: verification.status,
        registrationVerificationSource: verification.source,
        registrationVerifiedAt: verification.checkedAt,
        xrplAddress,
        xrplSecret: this.crypto.encrypt(xrplSecret),
      },
    });

    this.logger.log(`Registered business ${business.id} with XRPL address ${xrplAddress}`);

    // Return without xrplSecret
    const { xrplSecret: _, ...result } = business;
    return result;
  }

  async findById(id: string, user: SessionUser) {
    this.assertBusinessOwner(id, user);
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    const { xrplSecret: _, ...result } = business;
    return result;
  }

  async dashboard(id: string, user: SessionUser) {
    this.assertBusinessOwner(id, user);
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        escrows: {
          include: {
            entries: true,
            consumer: true,
            product: { include: { menuItems: true } },
            chargeRequests: { include: { menuItem: true } },
            refundReviewRequests: { orderBy: { requestedAt: 'desc' } },
          },
        },
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    const autoSettled = await this.autoFinishEligibleMonthlyEntries(business);
    const pendingPaymentRequests = this.paymentRequestService.listForBusiness(id);

    const totalReceived = business.escrows.reduce((sum, e) => {
      if (e.escrowType === 'prepaid') {
        const settledCharges = e.chargeRequests
          .filter((request) => request.status === 'settled')
          .reduce((chargeSum, request) => chargeSum + Number(request.amount), 0);
        if (settledCharges > 0) return sum + settledCharges;
      }
      const released = e.entries.filter((en) => en.status === 'released');
      return sum + released.reduce((entrySum, entry) => entrySum + Number(entry.amount ?? e.monthlyAmount), 0);
    }, 0);

    const totalPending = business.escrows.reduce((sum, e) => {
      if (e.escrowType === 'prepaid') {
        const settledCharges = e.chargeRequests
          .filter((request) => request.status === 'settled')
          .reduce((chargeSum, request) => chargeSum + Number(request.amount), 0);
        const refundedAmount = e.entries
          .filter((en) => en.status === 'refunded')
          .reduce((entrySum, entry) => entrySum + Number(entry.amount), 0);
        return sum + Math.max(Number(e.totalAmount) - settledCharges - refundedAmount, 0);
      }
      const pending = e.entries.filter((en) => en.status === 'pending');
      return sum + pending.reduce((entrySum, entry) => entrySum + Number(entry.amount ?? e.monthlyAmount), 0);
    }, 0);

    return {
      business: { id: business.id, name: business.name },
      totalReceived,
      totalPending,
      activeEscrows: business.escrows.filter((e) => e.status === 'active').length,
      summary: this.buildDashboardSummary(business.escrows, pendingPaymentRequests, totalReceived, totalPending, autoSettled),
      escrows: business.escrows.map((e) => this.stripEscrowDashboardFields(e)),
      pendingPaymentRequests,
    };
  }

  async getBalance(id: string, user: SessionUser) {
    this.assertBusinessOwner(id, user);
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    const balance = await this.xrplService.getBalance(business.xrplAddress);
    return { xrplAddress: business.xrplAddress, balance };
  }

  async findAll() {
    const businesses = await this.prisma.business.findMany({ where: { isActive: true } });
    return businesses.map(({ xrplSecret: _, ...b }) => b);
  }

  async findProducts(businessId: string) {
    return this.prisma.businessProduct.findMany({
      where: { businessId, isActive: true },
      include: { menuItems: { where: { isActive: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private assertBusinessOwner(id: string, user: SessionUser) {
    if (user.role !== 'business' || user.userId !== id) {
      throw new ForbiddenException('해당 사업자 계정으로만 접근할 수 있습니다');
    }
  }

  private stripEscrowDashboardFields(escrow: any) {
    if (escrow.consumer) {
      const { xrplSecret: _, ...consumer } = escrow.consumer;
      escrow = { ...escrow, consumer };
    }
    if (escrow.refundReviewRequests) {
      escrow = {
        ...escrow,
        refundReviewRequests: escrow.refundReviewRequests
          .filter((request: any) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status))
          .map((request: any) => this.stripRefundReviewRequestForMerchant(request)),
      };
    }
    return escrow;
  }

  private stripRefundReviewRequestForMerchant(refundReviewRequest: any) {
    const { photoDataUrlsJson: _photos, consumerReason: _consumerReason, photoDataUrls: _photoDataUrls, ...rest } = refundReviewRequest;
    return rest;
  }

  private async autoFinishEligibleMonthlyEntries(business: any): Promise<{ count: number; amount: number }> {
    const nowMs = Date.now();
    const nowRipple = Math.floor(nowMs / 1000) - 946684800;
    const businessWallet = safeWalletFromSeed(this.crypto.decrypt(business.xrplSecret));
    let count = 0;
    let amount = 0;

    for (const escrow of business.escrows ?? []) {
      if (escrow.status !== 'active' || escrow.escrowType === 'prepaid') continue;
      const hasBlockingRefundReview = (escrow.refundReviewRequests ?? [])
        .some((request: any) => request.status !== 'refunded' && request.status !== 'rejected');
      if (hasBlockingRefundReview) continue;

      for (const entry of escrow.entries ?? []) {
        const finishAfter = Number(entry.finishAfter);
        if (entry.status !== 'pending' || !Number.isFinite(finishAfter) || finishAfter > nowRipple) continue;
        const retryKey = `${escrow.id}:${entry.id ?? entry.sequence}`;
        const retryAfter = this.autoSettlementRetryAfterByEntryId.get(retryKey) ?? 0;
        if (retryAfter > nowMs) continue;
        try {
          const txHash = await this.xrplService.finishEscrow(businessWallet, escrow.consumerAddress, entry.sequence);
          await this.prisma.escrowEntry.update({
            where: { id: entry.id },
            data: { status: 'released', txHash },
          });
          this.autoSettlementRetryAfterByEntryId.delete(retryKey);
          entry.status = 'released';
          entry.txHash = txHash;
          count += 1;
          amount += Number(entry.amount ?? escrow.monthlyAmount ?? 0);
        } catch (err) {
          this.autoSettlementRetryAfterByEntryId.set(retryKey, nowMs + AUTO_SETTLEMENT_RETRY_DELAY_MS);
          this.logger.warn(`Failed to auto-finish escrow entry ${entry.id}: ${err}`);
        }
      }

      const allReleased = (escrow.entries ?? []).length > 0
        && escrow.entries.every((entry: any) => entry.status === 'released');
      if (allReleased && escrow.status !== 'completed') {
        await this.prisma.escrow.update({
          where: { id: escrow.id },
          data: { status: 'completed' },
        });
        escrow.status = 'completed';
      }
    }

    return { count, amount };
  }

  private buildDashboardSummary(
    escrows: any[],
    pendingPaymentRequests: any[],
    totalReceived: number,
    totalPending: number,
    autoSettled: { count: number; amount: number },
  ) {
    const visibleRefundRequests = escrows.flatMap((escrow) => escrow.refundReviewRequests ?? [])
      .filter((request: any) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status));
    const nowRipple = getRippleNow();
    const dueSettlementEntries = escrows.flatMap((escrow) => {
      if (escrow.status !== 'active' || escrow.escrowType === 'prepaid') return [];
      const hasBlockingRefundReview = (escrow.refundReviewRequests ?? [])
        .some((request: any) => request.status !== 'refunded' && request.status !== 'rejected');
      if (hasBlockingRefundReview) return [];
      return (escrow.entries ?? [])
        .filter((entry: any) => {
          const finishAfter = Number(entry.finishAfter);
          return entry.status === 'pending' && Number.isFinite(finishAfter) && finishAfter <= nowRipple;
        })
        .map((entry: any) => Number(entry.amount ?? escrow.monthlyAmount ?? 0));
    });

    return {
      receivedAmount: totalReceived,
      protectedPendingAmount: totalPending,
      pendingApprovalAmount: pendingPaymentRequests.reduce(
        (sum, request) => sum + Number(request.paymentAmount ?? request.totalAmount ?? 0),
        0,
      ),
      activeEscrowCount: escrows.filter((escrow) => escrow.status === 'active').length,
      refundActionRequiredCount: visibleRefundRequests.filter((request: any) => REFUND_REVIEW_ACTION_REQUIRED_STATUSES.has(request.status)).length,
      refundMonitoringCount: visibleRefundRequests.filter((request: any) => REFUND_REVIEW_MONITORING_STATUSES.has(request.status)).length,
      refundCompletedCount: visibleRefundRequests.filter((request: any) => REFUND_REVIEW_COMPLETED_STATUSES.has(request.status)).length,
      dueSettlementCount: dueSettlementEntries.length,
      dueSettlementAmount: dueSettlementEntries.reduce((sum, entryAmount) => sum + entryAmount, 0),
      autoSettledCount: autoSettled.count,
      autoSettledAmount: autoSettled.amount,
    };
  }
}
