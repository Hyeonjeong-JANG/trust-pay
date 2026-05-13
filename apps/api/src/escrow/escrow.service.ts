import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PartialPrepaidEscrowCreationError, XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import { Wallet } from 'xrpl';
import type { EscrowResult } from '@prepaid-shield/xrpl-client';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import type { SessionUser } from '../common/session-token';
import type { CreateChargeRequestInput } from '@prepaid-shield/validators';

const MAX_PREPAID_ESCROW_ENTRIES = 50;
const RESERVED_CHARGE_STATUSES = new Set(['pending_approval']);
const INTEGER_RATIO_EPSILON = 1e-4;
const MAX_DECIMAL_ROUNDING_RATIO_EPSILON = 0.05;
const DECIMAL_ROUNDING_HALF_UNIT = 0.5e-6;
const RLUSD_DECIMAL_PLACES = 6;

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

function safeWalletFromSeed(secret: string): Wallet {
  try {
    return Wallet.fromSeed(secret);
  } catch {
    // Dummy/demo seed — generate a throwaway wallet for mock XRPL calls
    return Wallet.generate();
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
  ) {}

  async create(dto: CreateEscrowDto, user: SessionUser) {
    if (user.role !== 'consumer' || user.userId !== dto.consumerId) {
      throw new ForbiddenException('본인 소비자 계정으로만 에스크로를 생성할 수 있습니다');
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

    // Reconstruct sender wallet from encrypted secret
    const senderWallet = safeWalletFromSeed(this.crypto.decrypt(consumer.xrplSecret));

    let monthlyAmount: number;
    let entryMonths: number;
    let unitPrice: number | undefined;
    let validityMonths: number | undefined;
    let escrowResults: EscrowResult[];

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
            txHash: r.txHash,
          })),
        },
      },
      include: { entries: true },
    });

    if (escrowType === 'prepaid') {
      if (!requestedUnitPrice || !requestedValidityMonths) {
        throw new BadRequestException('이용권 에스크로에는 1회 이용금액과 유효기간이 필요합니다');
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
        escrowResults = await this.xrplService.createPrepaidEscrows(
          senderWallet,
          business.xrplAddress,
          formatRlusdAmount(requestedUnitPrice),
          entryCount,
          requestedValidityMonths,
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
        throw new BadRequestException('월정액 에스크로에는 기간이 필요합니다');
      }
      monthlyAmount = totalAmount / requestedMonths;
      entryMonths = requestedMonths;
      escrowResults = await this.xrplService.createMonthlyEscrows(
        senderWallet,
        business.xrplAddress,
        formatRlusdAmount(monthlyAmount),
        requestedMonths,
      );
    }

    const escrow = await createEscrowRecord(escrowResults);

    this.logger.log(`Created escrow ${escrow.id} with ${escrow.entries.length} entries`);
    return escrow;
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
      },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    this.assertEscrowAccess(escrow, user);
    return this.stripSecrets(escrow);
  }

  async finishEntry(escrowId: string, entryMonth: number, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (user.role !== 'business' || user.userId !== escrow.businessId) {
      throw new ForbiddenException('해당 사업자만 에스크로를 정산할 수 있습니다');
    }

    const entry = escrow.entries.find((e) => e.month === entryMonth);
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.status !== 'pending') {
      throw new BadRequestException(`Entry already ${entry.status}`);
    }

    // Use business wallet for finish (business claims payment)
    const business = await this.prisma.business.findUnique({
      where: { id: escrow.businessId },
    });
    const wallet = safeWalletFromSeed(this.crypto.decrypt(business!.xrplSecret));

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
      throw new BadRequestException('진행 중인 이용권 에스크로만 차감 요청을 만들 수 있습니다');
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
        throw new BadRequestException('메뉴가 해당 에스크로 상품에 속하지 않습니다');
      }
      requestedAmount = Number(menuItem.amount);
      menuName = menuItem.name;
    } else {
      requestedAmount = Number(dto.amount);
      menuName = dto.menuName;
    }

    const unitAmount = Number(escrow.unitPrice ?? escrow.monthlyAmount);
    const requiredEntryCount = getWholeRatio(requestedAmount, unitAmount);
    if (requiredEntryCount === null) {
      throw new BadRequestException(`메뉴 금액은 ${unitAmount} RLUSD 단위로 나누어 떨어져야 합니다`);
    }

    const reservedEntryIds = new Set(
      (escrow.chargeRequests ?? [])
        .filter((request) => RESERVED_CHARGE_STATUSES.has(request.status))
        .flatMap((request) => this.parseChargeEntryIds(request.entryIds)),
    );
    const availableEntries = escrow.entries
      .filter((entry) => entry.status === 'pending' && !reservedEntryIds.has(entry.id))
      .sort((a, b) => a.month - b.month);
    if (availableEntries.length < requiredEntryCount) {
      throw new BadRequestException('차감 가능한 이용권 잔액이 부족합니다');
    }

    const selectedEntryIds = availableEntries
      .slice(0, requiredEntryCount)
      .map((entry) => entry.id);

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

    const wallet = safeWalletFromSeed(this.crypto.decrypt(business.xrplSecret));
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
      throw new ForbiddenException('해당 소비자만 에스크로를 취소할 수 있습니다');
    }

    // Use consumer wallet for cancel (consumer reclaims funds)
    const consumer = await this.prisma.consumer.findUnique({
      where: { id: escrow.consumerId },
    });
    const wallet = safeWalletFromSeed(this.crypto.decrypt(consumer!.xrplSecret));

    const pendingEntries = escrow.entries.filter((e) => e.status === 'pending');

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
      } catch (err) {
        this.logger.warn(`Failed to cancel entry ${entry.month}: ${err}`);
      }
    }

    await this.prisma.escrow.update({
      where: { id: escrowId },
      data: { status: 'cancelled' },
    });

    this.logger.log(`Cancelled escrow ${escrowId}`);
    return { cancelled: pendingEntries.length };
  }

  async findByConsumer(consumerId: string, user: SessionUser) {
    if (user.role !== 'consumer' || user.userId !== consumerId) {
      throw new ForbiddenException('본인 에스크로 목록만 조회할 수 있습니다');
    }

    const escrows = await this.prisma.escrow.findMany({
      where: { consumerId },
      include: { entries: true, business: true, product: { include: { menuItems: true } }, chargeRequests: { include: { menuItem: true } } },
    });
    return escrows.map((e) => this.stripSecrets(e));
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
      throw new ForbiddenException('해당 에스크로에 접근할 수 없습니다');
    }
  }

  private stripSecrets(escrow: any) {
    if (escrow.business) {
      const { xrplSecret: _, ...business } = escrow.business;
      escrow = { ...escrow, business };
    }
    if (escrow.consumer) {
      const { xrplSecret: _, ...consumer } = escrow.consumer;
      escrow = { ...escrow, consumer };
    }
    return escrow;
  }

  private stripChargeRequestSecrets(chargeRequest: any) {
    if (chargeRequest.escrow) {
      return { ...chargeRequest, escrow: this.stripSecrets(chargeRequest.escrow) };
    }
    return chargeRequest;
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
