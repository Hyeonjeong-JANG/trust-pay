import { createEscrowSchema } from '@prepaid-shield/validators';

const baseRequest = {
  consumerId: '00000000-0000-4000-a000-000000000001',
  businessId: '00000000-0000-4000-a000-000000000010',
  totalAmount: 150,
};

describe('createEscrowSchema', () => {
  it('defaults escrowType to monthly for existing monthly requests', () => {
    const parsed = createEscrowSchema.parse({ ...baseRequest, months: 3 });

    expect(parsed.escrowType).toBe('monthly');
    expect(parsed.months).toBe(3);
  });

  it('accepts prepaid requests without monthly months', () => {
    const parsed = createEscrowSchema.parse({
      ...baseRequest,
      escrowType: 'prepaid',
      unitPrice: 5,
      validityMonths: 3,
    });

    expect(parsed).toMatchObject({
      escrowType: 'prepaid',
      unitPrice: 5,
      validityMonths: 3,
    });
  });

  it('requires unit price and validity for prepaid requests', () => {
    expect(() => createEscrowSchema.parse({
      ...baseRequest,
      escrowType: 'prepaid',
    })).toThrow();
  });

  it('requires prepaid total amount to divide evenly by unit price', () => {
    expect(() => createEscrowSchema.parse({
      ...baseRequest,
      totalAmount: 151,
      escrowType: 'prepaid',
      unitPrice: 5,
      validityMonths: 3,
    })).toThrow();
  });

  it('limits prepaid requests to 50 ledger entries', () => {
    expect(() => createEscrowSchema.parse({
      ...baseRequest,
      totalAmount: 255,
      escrowType: 'prepaid',
      unitPrice: 5,
      validityMonths: 3,
    })).toThrow();
  });
});
