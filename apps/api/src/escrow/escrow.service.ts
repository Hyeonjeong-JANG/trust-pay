import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessClosureService } from '../business/business-closure.service';
import { PaymentRequestService } from '../payment-request/payment-request.service';
import { PartialPrepaidEscrowCreationError, XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import { Wallet } from 'xrpl';
import type { EscrowResult } from '@prepaid-shield/xrpl-client';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import type { SessionUser } from '../common/session-token';
import { requestRefundReviewSchema, type CreateChargeRequestInput, type MerchantRefundReviewResponseInput, type RequestRefundReviewInput } from '@prepaid-shield/validators';
import type { BusinessClosureStatus, PaymentRequest, RefundReviewStatus } from '@prepaid-shield/shared-types';

const MAX_PREPAID_ESCROW_ENTRIES = 50;
const RESERVED_CHARGE_STATUSES = new Set(['pending_approval']);
const INTEGER_RATIO_EPSILON = 1e-4;
const MAX_DECIMAL_ROUNDING_RATIO_EPSILON = 0.05;
const DECIMAL_ROUNDING_HALF_UNIT = 0.5e-6;
const RLUSD_DECIMAL_PLACES = 6;
const ACTIVE_REFUND_REVIEW_STATUSES = [
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'merchant_review',
  'merchant_disputed',
  'platform_investigation',
  'closure_suspected',
  'closure_confirmed',
  'auto_approved',
  'platform_approved',
];
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

function parseRefundReviewPhotoDataUrls(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function validateRefundReviewInput(input: RequestRefundReviewInput): RequestRefundReviewInput {
  const result = requestRefundReviewSchema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(result.error.issues[0]?.message ?? '환불 검토 요청 사유를 확인해주세요');
  }
  return result.data;
}

function getWholeRatio(total: number, unit: number): number | null {
  if (!Number.isFinite(total) || !Number.isFinite(unit) || unit <= 0) return null;
  const count = total / unit;
  const rounded = Math.round(count);
  const roundingTolerance = Math.min(
    ((rounded + 1) * DECIMAL_ROUNDING_HALF_UNIT) / unit,
    MAX_DECIMAL_ROUNDING_RATIO_EPSILON,
  );
  const tolerance = Math.max(INTEGER_RATIO_EPSILON, roundingTolerance);
  return Math.abs(count - rounded) <= tolerance ? rounded : null;
}

function roundRlusdAmount(amount: number): number {
  return Number(amount.toFixed(RLUSD_DECIMAL_PLACES));
}

function formatRlusdAmount(amount: number): string {
  return String(roundRlusdAmount(amount));
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

function selectEntriesCoveringAmount<T extends { id: string; amount: string | number }>(
  entries: T[],
  amount: number,
): string[] | null {
  const selectedIds: string[] = [];
  let coveredAmount = 0;
  for (const entry of entries) {
    selectedIds.push(entry.id);
    coveredAmount += Number(entry.amount);
    if (roundRlusdAmount(coveredAmount) + INTEGER_RATIO_EPSILON >= amount) {
      return selectedIds;
    }
  }
  return null;
}

function safeWalletFromSeed(secret: string, demoMode: boolean): Wallet {
  try {
    return Wallet.fromSeed(secret);
  } catch (err) {
    if (demoMode) {
      return Wallet.generate();
    }
    throw new Error(`Failed to restore wallet from seed: ${(err as Error).message}`);
  }
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
    private configService: ConfigService,
    private crypto: CryptoService,
    private businessClosureService: BusinessClosureService,
    private paymentRequestService: PaymentRequestService,
  ) {}

  async create(dto: CreateEscrowDto, user: SessionUser) {
    if (user.role !== 'consumer' || user.userId !== dto.consumerId) {
      throw new ForbiddenException('본인 소비자 계정으로만 보호 결제를 생성할 수 있습니다');
    }

    const consumer = await this.prisma.consumer.findUnique({
      where: { id: dto.consumerId },
    });
    if (!consumer) throw new NotFoundException('Consumer not found');

    const business = await this.prisma.business.findUnique({
      where: { id: dto.businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    const product = dto.productId
      ? await this.prisma.businessProduct.findUnique({
          where: { id: dto.productId },
        })
      : null;
    if (dto.productId && !product) throw new NotFoundException('Product not found');
    if (product && product.businessId !== business.id) {
      throw new BadRequestException('상품이 해당 사업자에 속하지 않습니다');
    }

    const escrowType = product?.escrowType ?? dto.escrowType ?? 'monthly';
    const totalAmount = product?.totalAmount ?? dto.totalAmount;
    let recordTotalAmount = totalAmount;
    const requestedMonths = product?.months ?? dto.months;
    const requestedUnitPrice = product?.unitPrice ?? dto.unitPrice;
    const requestedValidityMonths = product?.validityMonths ?? dto.validityMonths;
    const issuer = this.configService.get<string>('rlusd.issuer')!;

    const paymentRequest = dto.paymentRequestCode
      ? await this.paymentRequestService.findByCode(dto.paymentRequestCode)
      : null;
    if (paymentRequest) {
      this.assertPaymentRequestMatchesEscrow(paymentRequest, {
        businessId: business.id,
        productId: product?.id ?? null,
        totalAmount,
        months: requestedMonths ?? null,
        escrowType,
        unitPrice: requestedUnitPrice ?? null,
        validityMonths: requestedValidityMonths ?? null,
      });
    }

    // Reconstruct sender wallet from encrypted secret
    const isDemoMode = this.configService.get<boolean>('demoMode') ?? false;
    const senderWallet = safeWalletFromSeed(this.crypto.decrypt(consumer.xrplSecret), isDemoMode);

    let monthlyAmount: number;
    let entryMonths: number;
    let unitPrice: number | undefined;
    let validityMonths: number | undefined;
    let escrowResults: EscrowResult[];
    const initiallyReleasedMonths = new Set<number>();
    const releasedTxHashes = new Map<number, string>();

    const createEscrowRecord = (
      results: EscrowResult[],
      overrides: { totalAmount?: number; entryMonths?: number } = {},
    ) => this.prisma.escrow.create({
      data: {
        consumerId: consumer.id,
        businessId: business.id,
        productId: product?.id,
        consumerAddress: consumer.xrplAddress,
        businessAddress: business.xrplAddress,
        totalAmount: overrides.totalAmount ?? recordTotalAmount,
        monthlyAmount,
        months: overrides.entryMonths ?? entryMonths,
        escrowType,
        unitPrice,
        validityMonths,
        issuer,
        entries: {
          create: results.map((r) => ({
            month: r.month,
            sequence: r.sequence,
            amount: r.amount,
            finishAfter: r.finishAfter,
            cancelAfter: r.cancelAfter,
            txHash: releasedTxHashes.get(r.month) ?? r.txHash,
            ...(initiallyReleasedMonths.has(r.month) ? { status: 'released' } : {}),
          })),
        },
      },
      include: { entries: true },
    });

    if (escrowType === 'prepaid') {
      if (!requestedUnitPrice || !requestedValidityMonths) {
        throw new BadRequestException('이용권 보호 결제에는 1회 이용금액과 유효기간이 필요합니다');
      }
      const entryCount = getWholeRatio(totalAmount, requestedUnitPrice);
      if (entryCount === null) {
        throw new BadRequestException('총액은 1회 이용금액으로 나누어 떨어져야 합니다');
      }
      if (entryCount > MAX_PREPAID_ESCROW_ENTRIES) {
        throw new BadRequestException(`이용권은 최대 ${MAX_PREPAID_ESCROW_ENTRIES}회까지 생성할 수 있습니다`);
      }

      unitPrice = requestedUnitPrice;
      validityMonths = requestedValidityMonths;
      monthlyAmount = requestedUnitPrice;
      entryMonths = entryCount;
      recordTotalAmount = roundRlusdAmount(requestedUnitPrice * entryCount);
      try {
        const prepaidDateOptions = dto.validFrom || dto.validUntil
          ? { validFrom: dto.validFrom, validUntil: dto.validUntil }
          : undefined;
        escrowResults = await this.xrplService.createPrepaidEscrows(
          senderWallet,
          business.xrplAddress,
          formatRlusdAmount(requestedUnitPrice),
          entryCount,
          requestedValidityMonths,
          ...(prepaidDateOptions ? [prepaidDateOptions] as const : []),
        );
      } catch (err) {
        if (err instanceof PartialPrepaidEscrowCreationError) {
          const createdCount = err.escrowResults.length;
          await createEscrowRecord(err.escrowResults, {
            totalAmount: roundRlusdAmount(requestedUnitPrice * createdCount),
            entryMonths: createdCount,
          });
        }
        throw err;
      }
    } else {
      if (!requestedMonths) {
        throw new BadRequestException('월정액 보호 결제에는 기간이 필요합니다');
      }
      monthlyAmount = totalAmount / requestedMonths;
      entryMonths = requestedMonths;
      escrowResults = await this.xrplService.createMonthlyEscrows(
        senderWallet,
        business.xrplAddress,
        formatRlusdAmount(monthlyAmount),
        requestedMonths,
      );
      const firstEntry = escrowResults.find((result) => result.month === 1);
      if (firstEntry) {
        const businessWallet = safeWalletFromSeed(this.crypto.decrypt(business.xrplSecret), isDemoMode);
        const txHash = await this.xrplService.finishEscrow(
          businessWallet,
          consumer.xrplAddress,
          firstEntry.sequence,
        );
        initiallyReleasedMonths.add(firstEntry.month);
        releasedTxHashes.set(firstEntry.month, txHash);
      }
    }

    const escrow = await createEscrowRecord(escrowResults);
    if (dto.paymentRequestCode) {
      await this.paymentRequestService.markUsedByCode(dto.paymentRequestCode, business.id);
    }

    this.logger.log(`Created escrow ${escrow.id} with ${escrow.entries.length} entries`);
    return escrow;
  }

  private assertPaymentRequestMatchesEscrow(
    request: PaymentRequest,
    expected: {
      businessId: string;
      productId: string | null;
      totalAmount: number;
      months: number | null;
      escrowType: string;
      unitPrice: number | null;
      validityMonths: number | null;
    },
  ) {
    if (request.status !== 'pending') {
      throw new BadRequestException('이미 처리된 결제 QR입니다');
    }
    if (request.businessId !== expected.businessId) {
      throw new BadRequestException('결제 QR 사업자 정보가 일치하지 않습니다');
    }
    if ((request.productId ?? null) !== expected.productId) {
      throw new BadRequestException('결제 QR 상품 정보가 일치하지 않습니다');
    }
    if (roundRlusdAmount(request.totalAmount) !== roundRlusdAmount(expected.totalAmount)) {
      throw new BadRequestException('결제 QR 금액이 요청 내용과 일치하지 않습니다');
    }
    if (request.escrowType !== expected.escrowType) {
      throw new BadRequestException('결제 QR 결제 방식이 요청 내용과 일치하지 않습니다');
    }
    if (request.escrowType === 'monthly' && (request.months ?? null) !== expected.months) {
      throw new BadRequestException('결제 QR 기간이 요청 내용과 일치하지 않습니다');
    }
    if (request.escrowType === 'prepaid') {
      if (roundRlusdAmount(request.unitPrice ?? 0) !== roundRlusdAmount(expected.unitPrice ?? 0)) {
        throw new BadRequestException('결제 QR 차감 단위가 요청 내용과 일치하지 않습니다');
      }
      if ((request.validityMonths ?? null) !== expected.validityMonths) {
        throw new BadRequestException('결제 QR 유효기간이 요청 내용과 일치하지 않습니다');
      }
    }
  }

  async findById(id: string, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: {
        entries: true,
        business: true,
        consumer: true,
        product: { include: { menuItems: true } },
        chargeRequests: { include: { menuItem: true } },
        refundReviewRequests: { orderBy: { requestedAt: 'desc' } },
      },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    this.assertEscrowAccess(escrow, user);
    return this.stripSecrets(escrow, user);
  }

  async finishEntry(escrowId: string, entryMonth: number, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true, refundReviewRequests: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (user.role !== 'business' || user.userId !== escrow.businessId) {
      throw new ForbiddenException('해당 사업자만 보호 결제를 정산할 수 있습니다');
    }

    const entry = escrow.entries.find((e) => e.month === entryMonth);
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.status !== 'pending') {
      throw new BadRequestException(`Entry already ${entry.status}`);
    }
    const hasOpenRefundReview = (escrow.refundReviewRequests ?? [])
      .some((review) => ACTIVE_REFUND_REVIEW_STATUSES.includes(review.status));
    if (hasOpenRefundReview) {
      throw new BadRequestException('환불 검토가 진행 중인 보호 결제는 정산할 수 없습니다');
    }

    // Use business wallet for finish (business claims payment)
    const business = await this.prisma.business.findUnique({
      where: { id: escrow.businessId },
    });
    const isDemoMode = this.configService.get<boolean>('demoMode') ?? false;
    const wallet = safeWalletFromSeed(this.crypto.decrypt(business!.xrplSecret), isDemoMode);

    const txHash = await this.xrplService.finishEscrow(
      wallet,
      escrow.consumerAddress,
      entry.sequence,
    );

    await this.prisma.escrowEntry.update({
      where: { id: entry.id },
      data: { status: 'released', txHash },
    });

    const allReleased = escrow.entries.every(
      (e) => e.id === entry.id || e.status === 'released',
    );
    if (allReleased) {
      await this.prisma.escrow.update({
        where: { id: escrowId },
        data: { status: 'completed' },
      });
    }

    this.logger.log(`Finished escrow entry month ${entryMonth} for ${escrowId}`);
    return { txHash };
  }

  async createChargeRequest(
    escrowId: string,
    dto: CreateChargeRequestInput,
    user: SessionUser,
  ) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true, chargeRequests: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (user.role !== 'business' || user.userId !== escrow.businessId) {
      throw new ForbiddenException('해당 사업자만 차감 요청을 만들 수 있습니다');
    }
    if (escrow.status !== 'active' || escrow.escrowType !== 'prepaid') {
      throw new BadRequestException('진행 중인 이용권 보호 결제만 차감 요청을 만들 수 있습니다');
    }

    let menuItem: any = null;
    let requestedAmount: number;
    let menuName: string;

    if ('menuItemId' in dto) {
      menuItem = await this.prisma.productMenuItem.findUnique({
        where: { id: dto.menuItemId },
        include: { product: true },
      });
      if (!menuItem || !menuItem.isActive) throw new NotFoundException('Menu item not found');
      if (menuItem.product.businessId !== escrow.businessId || menuItem.productId !== escrow.productId) {
        throw new BadRequestException('메뉴가 해당 보호 결제 상품에 속하지 않습니다');
      }
      requestedAmount = Number(menuItem.amount);
      menuName = menuItem.name;
    } else {
      requestedAmount = Number(dto.amount);
      menuName = dto.menuName;
    }

    const reservedEntryIds = new Set(
      (escrow.chargeRequests ?? [])
        .filter((request) => RESERVED_CHARGE_STATUSES.has(request.status))
        .flatMap((request) => this.parseChargeEntryIds(request.entryIds)),
    );
    const availableEntries = escrow.entries
      .filter((entry) => entry.status === 'pending' && !reservedEntryIds.has(entry.id))
      .sort((a, b) => a.month - b.month);
    const selectedEntryIds = selectEntriesCoveringAmount(availableEntries, requestedAmount);
    if (!selectedEntryIds) {
      throw new BadRequestException('차감 가능한 이용권 잔액이 부족합니다');
    }

    const chargeRequest = await this.prisma.chargeRequest.create({
      data: {
        escrowId: escrow.id,
        consumerId: escrow.consumerId,
        businessId: escrow.businessId,
        productId: escrow.productId,
        menuItemId: menuItem?.id ?? null,
        menuName,
        amount: requestedAmount,
        status: 'pending_approval',
        entryIds: JSON.stringify(selectedEntryIds),
      },
      include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
    });

    return this.stripChargeRequestSecrets(chargeRequest);
  }

  async approveChargeRequest(requestId: string, user: SessionUser) {
    const chargeRequest = await this.prisma.chargeRequest.findUnique({
      where: { id: requestId },
      include: { menuItem: true, escrow: { include: { entries: true, business: true, consumer: true } } },
    });
    if (!chargeRequest) throw new NotFoundException('Charge request not found');
    if (user.role !== 'consumer' || user.userId !== chargeRequest.consumerId) {
      throw new ForbiddenException('해당 소비자만 차감 요청을 승인할 수 있습니다');
    }
    if (chargeRequest.status !== 'pending_approval') {
      throw new BadRequestException(`Charge request already ${chargeRequest.status}`);
    }

    const requestedEntryIds = this.parseChargeEntryIds(chargeRequest.entryIds);
    const entries = requestedEntryIds.map((entryId) => {
      const entry = chargeRequest.escrow.entries.find((candidate) => candidate.id === entryId);
      if (!entry) throw new NotFoundException('Reserved escrow entry not found');
      if (entry.status !== 'pending') throw new BadRequestException(`Entry already ${entry.status}`);
      return entry;
    });

    const business = await this.prisma.business.findUnique({
      where: { id: chargeRequest.businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    const isDemoMode = this.configService.get<boolean>('demoMode') ?? false;
    const wallet = safeWalletFromSeed(this.crypto.decrypt(business.xrplSecret), isDemoMode);
    const txHashes: string[] = [];
    for (const entry of entries) {
      const txHash = await this.xrplService.finishEscrow(
        wallet,
        chargeRequest.escrow.consumerAddress,
        entry.sequence,
      );
      txHashes.push(txHash);
      await this.prisma.escrowEntry.update({
        where: { id: entry.id },
        data: { status: 'released', txHash },
      });
    }

    const releasedEntryIds = new Set(requestedEntryIds);
    const allReleased = chargeRequest.escrow.entries.every(
      (entry) => releasedEntryIds.has(entry.id) || entry.status === 'released',
    );
    if (allReleased) {
      await this.prisma.escrow.update({
        where: { id: chargeRequest.escrowId },
        data: { status: 'completed' },
      });
    }

    const now = new Date();
    const updated = await this.prisma.chargeRequest.update({
      where: { id: requestId },
      data: {
        status: 'settled',
        approvedAt: now,
        settledAt: now,
        txHash: txHashes.join(','),
      },
      include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
    });

    return this.stripChargeRequestSecrets(updated);
  }

  async rejectChargeRequest(requestId: string, user: SessionUser) {
    const chargeRequest = await this.prisma.chargeRequest.findUnique({
      where: { id: requestId },
      include: { escrow: true },
    });
    if (!chargeRequest) throw new NotFoundException('Charge request not found');
    if (user.role !== 'consumer' || user.userId !== chargeRequest.consumerId) {
      throw new ForbiddenException('해당 소비자만 차감 요청을 거절할 수 있습니다');
    }
    if (chargeRequest.status !== 'pending_approval') {
      throw new BadRequestException(`Charge request already ${chargeRequest.status}`);
    }

    const updated = await this.prisma.chargeRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', rejectedAt: new Date() },
      include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
    });
    return this.stripChargeRequestSecrets(updated);
  }

  async cancelEscrow(escrowId: string, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (user.role !== 'consumer' || user.userId !== escrow.consumerId) {
      throw new ForbiddenException('해당 소비자만 보호 결제를 취소할 수 있습니다');
    }

    // Use consumer wallet for cancel (consumer reclaims funds)
    const consumer = await this.prisma.consumer.findUnique({
      where: { id: escrow.consumerId },
    });
    const isDemoMode = this.configService.get<boolean>('demoMode') ?? false;
    const wallet = safeWalletFromSeed(this.crypto.decrypt(consumer!.xrplSecret), isDemoMode);

    const pendingEntries = escrow.entries.filter((e) => e.status === 'pending');
    let cancelled = 0;
    let failed = 0;

    for (const entry of pendingEntries) {
      try {
        const txHash = await this.xrplService.cancelEscrow(
          wallet,
          escrow.consumerAddress,
          entry.sequence,
        );
        await this.prisma.escrowEntry.update({
          where: { id: entry.id },
          data: { status: 'refunded', txHash },
        });
        cancelled += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(`Failed to cancel entry ${entry.month}: ${err}`);
      }
    }

    await this.prisma.escrow.update({
      where: { id: escrowId },
      data: { status: failed > 0 ? 'cancel_failed' : 'cancelled' },
    });

    this.logger.log(`Cancelled escrow ${escrowId}`);
    return { cancelled, failed };
  }

  async requestRefundReview(escrowId: string, user: SessionUser, dto: RequestRefundReviewInput) {
    const input = validateRefundReviewInput(dto);
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true, business: true, consumer: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (user.role !== 'consumer' || user.userId !== escrow.consumerId) {
      throw new ForbiddenException('해당 소비자만 환불 검토를 요청할 수 있습니다');
    }
    if (escrow.status !== 'active') {
      throw new BadRequestException('진행 중인 보호 결제만 환불 검토를 요청할 수 있습니다');
    }

    const existing = await this.prisma.refundReviewRequest.findFirst({
      where: {
        escrowId,
        status: { in: ACTIVE_REFUND_REVIEW_STATUSES },
      },
      orderBy: { requestedAt: 'desc' },
      include: { escrow: { include: { business: true, consumer: true } } },
    });
    if (existing) return this.stripRefundReviewRequestSecrets(existing);

    const refundableAmount = roundRlusdAmount(
      escrow.entries
        .filter((entry) => entry.status === 'pending')
        .reduce((sum, entry) => sum + Number(entry.amount), 0),
    );
    if (refundableAmount <= 0) {
      throw new BadRequestException('환불 검토 가능한 미사용 잔액이 없습니다');
    }

    const closureCheck = await this.businessClosureService.checkBusinessStatus(escrow.business.registrationNumber);
    const policy = this.getRefundReviewPolicy(closureCheck.status);
    const now = new Date();
    const created = await this.prisma.refundReviewRequest.create({
      data: {
        escrowId,
        consumerId: escrow.consumerId,
        businessId: escrow.businessId,
        status: policy.status,
        refundableAmount,
        merchantRespondBy: addBusinessDays(now, policy.slaBusinessDays),
        businessClosureStatus: closureCheck.status,
        businessClosureSource: closureCheck.source,
        businessClosureCheckedAt: closureCheck.checkedAt,
        investigationReason: policy.reason,
        consumerReason: input.reason,
        photoDataUrlsJson: JSON.stringify(input.photoDataUrls),
      },
      include: { escrow: { include: { business: true, consumer: true } } },
    });

    return this.stripRefundReviewRequestSecrets(created);
  }

  async respondToRefundReviewRequest(requestId: string, user: SessionUser, dto: MerchantRefundReviewResponseInput) {
    const review = await this.prisma.refundReviewRequest.findUnique({ where: { id: requestId } });
    if (!review) throw new NotFoundException('Refund review not found');
    if (user.role !== 'business' || user.userId !== review.businessId) {
      throw new ForbiddenException('해당 사업자만 환불 검토 답변을 제출할 수 있습니다');
    }
    if (review.status !== 'merchant_response_requested') {
      throw new BadRequestException('사업자 답변 요청 상태에서만 응답할 수 있습니다');
    }

    const updated = await this.prisma.refundReviewRequest.update({
      where: { id: requestId },
      data: {
        status: 'merchant_responded',
        merchantResponse: dto.response,
        merchantRespondedAt: new Date(),
      },
      include: { escrow: { include: { business: true, consumer: true } } },
    });
    return this.stripRefundReviewRequestForMerchant(updated);
  }

  async findByConsumer(consumerId: string, user: SessionUser) {
    if (user.role !== 'consumer' || user.userId !== consumerId) {
      throw new ForbiddenException('본인 보호 결제 목록만 조회할 수 있습니다');
    }

    const escrows = await this.prisma.escrow.findMany({
      where: { consumerId },
      include: {
        entries: true,
        business: true,
        product: { include: { menuItems: true } },
        chargeRequests: { include: { menuItem: true } },
        refundReviewRequests: { orderBy: { requestedAt: 'desc' } },
      },
    });
    return escrows.map((e) => this.stripSecrets(e, user));
  }

  async findChargeRequestsByEscrow(escrowId: string, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    this.assertEscrowAccess(escrow, user);
    const requests = await this.prisma.chargeRequest.findMany({
      where: { escrowId },
      include: { menuItem: true, escrow: { include: { business: true, consumer: true } } },
      orderBy: { requestedAt: 'desc' },
    });
    return requests.map((request) => this.stripChargeRequestSecrets(request));
  }

  private assertEscrowAccess(escrow: { consumerId: string; businessId: string }, user: SessionUser) {
    const isConsumerOwner = user.role === 'consumer' && user.userId === escrow.consumerId;
    const isBusinessOwner = user.role === 'business' && user.userId === escrow.businessId;
    if (!isConsumerOwner && !isBusinessOwner) {
      throw new ForbiddenException('해당 보호 결제에 접근할 수 없습니다');
    }
  }

  private stripSecrets(escrow: any, user?: SessionUser) {
    if (escrow.business) {
      const { xrplSecret: _, ...business } = escrow.business;
      escrow = { ...escrow, business };
    }
    if (escrow.consumer) {
      const { xrplSecret: _, ...consumer } = escrow.consumer;
      escrow = { ...escrow, consumer };
    }
    if (escrow.refundReviewRequests) {
      const refundReviewRequests = user?.role === 'business'
        ? escrow.refundReviewRequests
          .filter((request: any) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status))
          .map((request: any) => this.stripRefundReviewRequestForMerchant(request))
        : escrow.refundReviewRequests.map((request: any) => this.stripRefundReviewRequestSecrets(request));
      escrow = { ...escrow, refundReviewRequests };
    }
    return escrow;
  }

  private stripChargeRequestSecrets(chargeRequest: any) {
    if (chargeRequest.escrow) {
      return { ...chargeRequest, escrow: this.stripSecrets(chargeRequest.escrow) };
    }
    return chargeRequest;
  }

  private stripRefundReviewRequestSecrets(refundReviewRequest: any) {
    if ('photoDataUrlsJson' in refundReviewRequest) {
      const { photoDataUrlsJson, ...rest } = refundReviewRequest;
      refundReviewRequest = { ...rest, photoDataUrls: parseRefundReviewPhotoDataUrls(photoDataUrlsJson) };
    }
    if (refundReviewRequest.escrow) {
      return { ...refundReviewRequest, escrow: this.stripSecrets(refundReviewRequest.escrow) };
    }
    return refundReviewRequest;
  }

  private stripRefundReviewRequestForMerchant(refundReviewRequest: any) {
    const { photoDataUrlsJson: _photos, consumerReason: _consumerReason, photoDataUrls: _photoDataUrls, ...rest } = refundReviewRequest;
    return rest;
  }

  private getRefundReviewPolicy(closureStatus: BusinessClosureStatus): {
    status: RefundReviewStatus;
    slaBusinessDays: number;
    reason: string;
  } {
    if (closureStatus === 'closed') {
      return {
        status: 'platform_review',
        slaBusinessDays: 0,
        reason: '국세청 사업자 상태가 폐업으로 확인되어 TrustPay 확인 절차로 전환합니다.',
      };
    }
    if (closureStatus === 'suspended') {
      return {
        status: 'platform_review',
        slaBusinessDays: 1,
        reason: '국세청 사업자 상태가 휴업으로 확인되어 TrustPay 추가 확인 대상입니다.',
      };
    }
    if (closureStatus === 'not_configured') {
      return {
        status: 'platform_review',
        slaBusinessDays: 3,
        reason: '사업자 인증 정보 재확인이 필요해 TrustPay 자체 확인과 사업자 답변 기한으로 진행합니다.',
      };
    }
    if (closureStatus === 'unavailable') {
      return {
        status: 'platform_review',
        slaBusinessDays: 3,
        reason: '국세청 사업자등록번호 인증은 데모 환경에서 제한되어 TrustPay 자체 검토와 사업자 답변 기한으로 진행합니다.',
      };
    }
    return {
      status: 'platform_review',
      slaBusinessDays: 3,
      reason: 'TrustPay가 요청 내용을 먼저 검토한 뒤 필요한 경우 사업자 답변을 요청합니다.',
    };
  }

  private parseChargeEntryIds(entryIds: string): string[] {
    try {
      const parsed = JSON.parse(entryIds);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }
}
