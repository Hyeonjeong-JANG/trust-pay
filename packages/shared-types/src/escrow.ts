export type EscrowStatus = 'active' | 'completed' | 'cancelled';
export type EscrowEntryStatus = 'pending' | 'released' | 'refunded';
export type EscrowType = 'monthly' | 'prepaid';
export type ChargeRequestStatus = 'pending_approval' | 'settled' | 'rejected' | 'expired';
export type UserRole = 'consumer' | 'business';

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  xrplAddress: string;
  isActive: boolean;
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
  currency: string;
  issuer: string;
  status: EscrowStatus;
  entries: EscrowEntry[];
  product?: BusinessProduct | null;
  chargeRequests?: ChargeRequest[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEscrowRequest {
  consumerId: string;
  businessId: string;
  productId?: string;
  totalAmount: number;
  months?: number;
  escrowType?: EscrowType;
  unitPrice?: number;
  validityMonths?: number;
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
}

export interface BalanceResponse {
  xrplAddress: string;
  balance: string;
}
