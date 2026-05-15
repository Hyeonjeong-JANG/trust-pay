import { PaymentRequestService } from './payment-request.service';

describe('PaymentRequestService', () => {
  it('should list only pending business payment requests and hide them after use', async () => {
    const createdAt = new Date('2026-05-13T00:00:00.000Z');
    const pendingRequest = {
      id: 'request-1',
      code: 'TP-ABC12345',
      businessId: 'biz-1',
      businessName: '테스트카페',
      businessCategory: '카페',
      productId: null,
      productName: null,
      paymentAmount: 222.222222,
      totalAmount: 244.444444,
      monthlyAmount: null,
      months: null,
      paymentModel: 'voucher',
      escrowType: 'prepaid',
      unitPrice: 7.407407,
      validityMonths: 3,
      validFrom: null,
      validUntil: null,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
    };
    const usedRequest = { ...pendingRequest, status: 'used' };
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-1',
          name: '테스트카페',
          category: '카페',
        }),
      },
      businessProduct: {
        findUnique: jest.fn(),
      },
      paymentRequest: {
        create: jest.fn().mockResolvedValue(pendingRequest),
        findMany: jest.fn()
          .mockResolvedValueOnce([pendingRequest])
          .mockResolvedValueOnce([]),
        findUnique: jest.fn().mockResolvedValue(pendingRequest),
        update: jest.fn().mockResolvedValue(usedRequest),
      },
    } as any;
    const service = new PaymentRequestService(prisma);

    const request = await service.create({
      businessId: 'biz-1',
      paymentAmount: 222.222222,
      totalAmount: 244.444444,
      paymentModel: 'voucher',
      escrowType: 'prepaid',
      unitPrice: 7.407407,
      validityMonths: 3,
    }, { userId: 'biz-1', role: 'business', name: '테스트카페' });

    expect(prisma.paymentRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: expect.stringMatching(/^TP-[A-F0-9]{8}$/),
        businessId: 'biz-1',
        businessName: '테스트카페',
        businessCategory: '카페',
        status: 'pending',
      }),
    });
    await expect(service.listForBusiness('biz-1')).resolves.toEqual([request]);

    await service.markUsedByCode(request.code, 'biz-1');

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: request.id },
      data: { status: 'used' },
    });
    await expect(service.listForBusiness('biz-1')).resolves.toEqual([]);
  });

  it('should cancel a pending business payment request and prevent later use', async () => {
    const createdAt = new Date('2026-05-13T00:00:00.000Z');
    const pendingRequest = {
      id: 'request-1',
      code: 'TP-ABC12345',
      businessId: 'biz-1',
      businessName: '테스트카페',
      businessCategory: '카페',
      productId: null,
      productName: null,
      paymentAmount: 100,
      totalAmount: 100,
      monthlyAmount: 50,
      months: 2,
      paymentModel: 'monthly',
      escrowType: 'monthly',
      unitPrice: null,
      validityMonths: null,
      validFrom: null,
      validUntil: null,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
    };
    const cancelledRequest = { ...pendingRequest, status: 'cancelled' };
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-1',
          name: '테스트카페',
          category: '카페',
        }),
      },
      businessProduct: {
        findUnique: jest.fn(),
      },
      paymentRequest: {
        create: jest.fn().mockResolvedValue(pendingRequest),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn()
          .mockResolvedValueOnce(pendingRequest)
          .mockResolvedValueOnce(cancelledRequest),
        update: jest.fn().mockResolvedValue(cancelledRequest),
      },
    } as any;
    const service = new PaymentRequestService(prisma);
    const request = await service.create({
      businessId: 'biz-1',
      totalAmount: 100,
      monthlyAmount: 50,
      months: 2,
      escrowType: 'monthly',
    }, { userId: 'biz-1', role: 'business', name: '테스트카페' });

    const cancelled = await service.cancel(request.id, { userId: 'biz-1', role: 'business', name: '테스트카페' });

    expect(cancelled).toMatchObject({ id: request.id, status: 'cancelled' });
    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: request.id },
      data: { status: 'cancelled' },
    });
    await expect(service.listForBusiness('biz-1')).resolves.toEqual([]);
    await expect(service.markUsedByCode(request.code, 'biz-1')).rejects.toThrow('이미 처리된 결제 QR입니다');
  });
});
