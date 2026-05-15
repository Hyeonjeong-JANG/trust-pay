import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CreatePaymentRequest, EscrowType, PaymentRequest } from '@prepaid-shield/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../common/session-token';

const RLUSD_DECIMAL_PLACES = 6;

function roundRlusd(amount: number): number {
  return Number(amount.toFixed(RLUSD_DECIMAL_PLACES));
}

@Injectable()
export class PaymentRequestService {
  private paymentRequests: PaymentRequest[] = [];
  private nextCode = 1;

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentRequest, user: SessionUser): Promise<PaymentRequest> {
    if (user.role !== 'business' || user.userId !== dto.businessId) {
      throw new ForbiddenException('해당 사업자만 결제 QR을 만들 수 있습니다');
    }

    const business = await this.prisma.business.findUnique({ where: { id: dto.businessId } });
    if (!business) throw new NotFoundException('Business not found');

    const product = dto.productId
      ? await this.prisma.businessProduct.findUnique({ where: { id: dto.productId } })
      : null;
    if (dto.productId && !product) throw new NotFoundException('Product not found');
    if (product && product.businessId !== business.id) {
      throw new BadRequestException('상품이 해당 사업자에 속하지 않습니다');
    }

    const escrowType = (product?.escrowType ?? dto.escrowType ?? 'monthly') as EscrowType;
    const totalAmount = product?.totalAmount ?? Number(dto.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException('결제 QR 요청 금액을 확인해주세요');
    }

    const months = product?.months ?? dto.months ?? null;
    const monthlyAmount = product?.monthlyAmount ?? dto.monthlyAmount ?? (
      escrowType === 'monthly' && Number(months) > 0 ? roundRlusd(totalAmount / Number(months)) : null
    );
    if (escrowType === 'monthly' && (!months || !monthlyAmount)) {
      throw new BadRequestException('월정액 결제 QR에는 개월 수가 필요합니다');
    }

    const unitPrice = product?.unitPrice ?? dto.unitPrice ?? null;
    const validityMonths = product?.validityMonths ?? dto.validityMonths ?? null;
    if (escrowType === 'prepaid' && (!unitPrice || !validityMonths)) {
      throw new BadRequestException('기간 금액권 결제 QR에는 차감 단위와 사용 기간이 필요합니다');
    }

    const request: PaymentRequest = {
      id: randomUUID(),
      code: `TP-${String(this.nextCode++).padStart(6, '0')}`,
      businessId: business.id,
      businessName: business.name,
      businessCategory: business.category,
      productId: product?.id ?? null,
      productName: product?.name ?? null,
      paymentModel: dto.paymentModel ?? (escrowType === 'prepaid' ? 'voucher' : 'monthly'),
      paymentAmount: product?.totalAmount ?? dto.paymentAmount ?? totalAmount,
      totalAmount,
      monthlyAmount,
      months,
      escrowType,
      unitPrice,
      validityMonths,
      validFrom: dto.validFrom ?? null,
      validUntil: dto.validUntil ?? null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.paymentRequests = [request, ...this.paymentRequests];
    return request;
  }

  findByCode(code: string): PaymentRequest {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) throw new BadRequestException('결제 QR 코드가 필요합니다');
    const request = this.paymentRequests.find((item) => item.code === normalizedCode);
    if (!request) throw new NotFoundException('Payment request not found');
    return request;
  }

  listForBusiness(businessId: string): PaymentRequest[] {
    return this.paymentRequests.filter((item) => item.businessId === businessId && item.status === 'pending');
  }

  cancel(id: string, user: SessionUser): PaymentRequest {
    const request = this.paymentRequests.find((item) => item.id === id);
    if (!request) throw new NotFoundException('Payment request not found');
    if (user.role !== 'business' || user.userId !== request.businessId) {
      throw new ForbiddenException('해당 사업자만 결제 QR을 취소할 수 있습니다');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('이미 처리된 결제 QR입니다');
    }
    request.status = 'cancelled';
    return request;
  }

  markUsedByCode(code: string, businessId: string): PaymentRequest {
    const request = this.findByCode(code);
    if (request.businessId !== businessId) {
      throw new BadRequestException('결제 QR 사업자 정보가 일치하지 않습니다');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('이미 처리된 결제 QR입니다');
    }
    request.status = 'used';
    return request;
  }
}
