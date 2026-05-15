export type EscrowStatus = 'active' | 'completed' | 'cancelled';
export type EscrowEntryStatus = 'pending' | 'released' | 'refunded';
export type EscrowType = 'monthly' | 'prepaid';
export type ChargeRequestStatus = 'pending_approval' | 'settled' | 'rejected' | 'expired';
export type RefundReviewStatus =
  | 'platform_review'
  | 'merchant_response_requested'
  | 'merchant_responded'
  | 'merchant_review'
  | 'merchant_disputed'
  | 'platform_investigation'
  | 'closure_suspected'
  | 'closure_confirmed'
  | 'auto_approved'
  | 'platform_approved'
  | 'refunded'
  | 'rejected';
export type BusinessClosureStatus = 'active' | 'suspended' | 'closed' | 'not_configured' | 'unavailable';
export type BusinessRegistrationVerificationStatus = 'verified' | 'demo_verified' | 'unavailable';
export type UserRole = 'consumer' | 'business';

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  registrationNumber: string;
  registrationVerificationStatus?: BusinessRegistrationVerificationStatus | null;
  registrationVerificationSource?: 'nts' | 'demo' | 'internal' | null;
  registrationVerifiedAt?: Date | string | null;
  xrplAddress: string;
  isActive: boolean;
}

export interface BusinessRegistrationVerificationResponse {
  registrationNumber: string;
  status: BusinessRegistrationVerificationStatus;
  source: 'nts' | 'demo' | 'internal';
  checkedAt: Date | string;
  message: string;
}

export interface BusinessRegistrationRequest {
  name: string;
  category: string;
  address: string;
  phone?: string;
  email?: string;
  registrationNumber: string;
}

export interface Consumer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  xrplAddress: string;
}

export interface EscrowEntry {
  id: string;
  sequence: number;
  month: number;
  amount: string;
  finishAfter: number;
  cancelAfter: number;
  status: EscrowEntryStatus;
  txHash?: string | null;
}

export interface ProductMenuItem {
  id: string;
  productId: string;
  name: string;
  amount: number;
  isActive?: boolean;
}

export interface BusinessProduct {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  escrowType: EscrowType;
  totalAmount: number;
  monthlyAmount: number;
  months?: number | null;
  unitPrice?: number | null;
  validityMonths?: number | null;
  isActive?: boolean;
  menuItems?: ProductMenuItem[];
}

export interface ChargeRequest {
  id: string;
  escrowId: string;
  consumerId: string;
  businessId: string;
  productId?: string | null;
  menuItemId?: string | null;
  menuName: string;
  amount: number;
  status: ChargeRequestStatus;
  entryIds: string;
  requestedAt: Date | string;
  approvedAt?: Date | string | null;
  settledAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  txHash?: string | null;
  menuItem?: ProductMenuItem | null;
}

export interface EscrowRecord {
  id: string;
  consumerId: string;
  businessId: string;
  productId?: string | null;
  consumerAddress: string;
  businessAddress: string;
  totalAmount: number;
  monthlyAmount: number;
  months: number;
  escrowType?: EscrowType;
  unitPrice?: number | null;
  validityMonths?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  currency: string;
  issuer: string;
  status: EscrowStatus;
  entries: EscrowEntry[];
  product?: BusinessProduct | null;
  chargeRequests?: ChargeRequest[];
  refundReviewRequests?: RefundReviewRequest[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundReviewRequest {
  id: string;
  escrowId: string;
  consumerId: string;
  businessId: string;
  status: RefundReviewStatus;
  refundableAmount: number;
  merchantRespondBy: Date | string;
  businessClosureStatus: BusinessClosureStatus | 'not_checked';
  businessClosureSource?: string | null;
  businessClosureCheckedAt?: Date | string | null;
  investigationReason?: string | null;
  consumerReason?: string | null;
  merchantNotice?: string | null;
  merchantResponse?: string | null;
  merchantRespondedAt?: Date | string | null;
  adminResolutionReason?: string | null;
  photoDataUrls?: string[];
  requestedAt: Date | string;
  resolvedAt?: Date | string | null;
}

export interface CreateRefundReviewRequest {
  reason: string;
  photoDataUrls?: string[];
}

export interface CreateEscrowRequest {
  consumerId: string;
  businessId: string;
  paymentRequestCode?: string;
  productId?: string;
  totalAmount: number;
  months?: number;
  escrowType?: EscrowType;
  unitPrice?: number;
  validityMonths?: number;
  validFrom?: string;
  validUntil?: string;
}

export interface PaymentRequest {
  id: string;
  code: string;
  businessId: string;
  businessName: string;
  businessCategory?: string | null;
  productId?: string | null;
  productName?: string | null;
  paymentModel?: 'monthly' | 'voucher';
  paymentAmount?: number | null;
  totalAmount: number;
  monthlyAmount?: number | null;
  months?: number | null;
  escrowType: EscrowType;
  unitPrice?: number | null;
  validityMonths?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  status: 'pending' | 'used' | 'expired';
  createdAt: Date | string;
}

export interface CreatePaymentRequest {
  businessId: string;
  productId?: string;
  paymentModel?: 'monthly' | 'voucher';
  paymentAmount?: number;
  totalAmount: number;
  monthlyAmount?: number;
  months?: number;
  escrowType?: EscrowType;
  unitPrice?: number;
  validityMonths?: number;
  validFrom?: string;
  validUntil?: string;
}

export interface FinishEscrowRequest {
  entryMonth: number;
}

export type CreateChargeRequest =
  | { menuItemId: string }
  | { menuName: string; amount: number };

export interface CancelEscrowRequest {
  escrowId: string;
}

export interface EscrowSummary {
  id: string;
  businessName: string;
  totalAmount: number;
  releasedAmount: number;
  remainingAmount: number;
  status: EscrowStatus;
  nextReleaseDate: Date | null;
}

export interface LoginRequest {
  phone?: string;
  email?: string;
  role: UserRole;
  name?: string;
}

export interface LoginResponse {
  userId: string;
  role: UserRole;
  name: string;
  token: string;
  isNewUser?: boolean;
}

export interface RequestCodeResponse {
  delivery: 'demo' | 'sms' | 'email';
  code?: string;
  expiresInSeconds: number;
  isNewUser?: boolean;
}

export interface BusinessDashboard {
  business: { id: string; name: string };
  totalReceived: number;
  totalPending: number;
  activeEscrows: number;
  escrows: EscrowRecord[];
  pendingPaymentRequests?: PaymentRequest[];
}

export interface BalanceResponse {
  xrplAddress: string;
  balance: string;
}
