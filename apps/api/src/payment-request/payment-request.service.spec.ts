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
});
