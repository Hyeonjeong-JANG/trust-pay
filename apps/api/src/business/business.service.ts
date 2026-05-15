import { BadRequestException, Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import type { SessionUser } from '../common/session-token';
import { BusinessClosureService } from './business-closure.service';
import { PaymentRequestService } from '../payment-request/payment-request.service';

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

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

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
      escrows: business.escrows.map((e) => this.stripEscrowDashboardFields(e)),
      pendingPaymentRequests: this.paymentRequestService.listForBusiness(id),
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
}
