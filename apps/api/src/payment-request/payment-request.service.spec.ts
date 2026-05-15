import { PaymentRequestService } from './payment-request.service';

describe('PaymentRequestService', () => {
  it('should list only pending business payment requests and hide them after use', async () => {
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

    expect(service.listForBusiness('biz-1')).toEqual([request]);

    service.markUsedByCode(request.code, 'biz-1');

    expect(service.findByCode(request.code)).toMatchObject({ status: 'used' });
    expect(service.listForBusiness('biz-1')).toEqual([]);
  });

  it('should cancel a pending business payment request and prevent later use', async () => {
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
    } as any;
    const service = new PaymentRequestService(prisma);
    const request = await service.create({
      businessId: 'biz-1',
      totalAmount: 100,
      monthlyAmount: 50,
      months: 2,
      escrowType: 'monthly',
    }, { userId: 'biz-1', role: 'business', name: '테스트카페' });

    const cancelled = service.cancel(request.id, { userId: 'biz-1', role: 'business', name: '테스트카페' });

    expect(cancelled).toMatchObject({ id: request.id, status: 'cancelled' });
    expect(service.listForBusiness('biz-1')).toEqual([]);
    expect(() => service.markUsedByCode(request.code, 'biz-1')).toThrow('이미 처리된 결제 QR입니다');
  });
});
