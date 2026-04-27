export type EscrowStatus = 'active' | 'completed' | 'cancelled';
export type EscrowEntryStatus = 'pending' | 'released' | 'refunded';
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

export interface EscrowRecord {
  id: string;
  consumerId: string;
  businessId: string;
  consumerAddress: string;
  businessAddress: string;
  totalAmount: number;
  monthlyAmount: number;
  months: number;
  currency: string;
  issuer: string;
  status: EscrowStatus;
  entries: EscrowEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEscrowRequest {
  consumerId: string;
  businessId: string;
  totalAmount: number;
  months: number;
}

export interface FinishEscrowRequest {
  entryMonth: number;
}

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
}

export interface BusinessDashboard {
  business: { id: string; name: string };
  totalReceived: number;
  totalPending: number;
  activeEscrows: number;
  escrows: EscrowRecord[];
}
