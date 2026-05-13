export class CreateEscrowDto {
  consumerId!: string;
  businessId!: string;
  productId?: string;
  totalAmount!: number;
  months?: number;
  escrowType?: 'monthly' | 'prepaid';
  unitPrice?: number;
  validityMonths?: number;
  validFrom?: string;
  validUntil?: string;
}
