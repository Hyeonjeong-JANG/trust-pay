export type EscrowStatus = 'active' | 'completed' | 'cancelled';
export type EscrowEntryStatus = 'pending' | 'released' | 'refunded';
export type UserRole = 'consumer' | 'business';

export interface EscrowRecord {
  id: string;
  consumerAddress: string;
  businessAddress: string;
  totalAmount: number;
  monthlyAmount: number;
  months: number;
  status: EscrowStatus;
  escrowEntries: EscrowEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EscrowEntry {
  sequence: number;
  month: number;
  amount: string;
  finishAfter: number;
  cancelAfter: number;
  status: EscrowEntryStatus;
}

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  xrplAddress: string;
  isActive: boolean;
}

export interface Consumer {
  id: string;
  name: string;
  xrplAddress: string;
}

export interface CreateEscrowRequest {
  consumerAddress: string;
  businessAddress: string;
  totalAmount: number;
  months: number;
}

export interface FinishEscrowRequest {
  escrowId: string;
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
