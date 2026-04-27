import type { LoginResponse, EscrowRecord, BusinessDashboard, Business } from '@prepaid-shield/shared-types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (data: { phone?: string; email?: string; role: 'consumer' | 'business'; name?: string }) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  // Escrow
  createEscrow: (data: { consumerId: string; businessId: string; totalAmount: number; months: number }) =>
    request<EscrowRecord>('/escrow', { method: 'POST', body: JSON.stringify(data) }),

  getEscrow: (id: string) => request<EscrowRecord>(`/escrow/${id}`),

  finishEscrow: (id: string, entryMonth: number) =>
    request<{ txHash: string }>(`/escrow/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify({ entryMonth }),
    }),

  cancelEscrow: (id: string) =>
    request<{ cancelled: number }>(`/escrow/${id}/cancel`, { method: 'POST' }),

  getConsumerEscrows: (consumerId: string) =>
    request<EscrowRecord[]>(`/escrow/consumer/${consumerId}`),

  // Business
  getBusinesses: () => request<Business[]>('/business'),
  getBusiness: (id: string) => request<Business>(`/business/${id}`),
  getBusinessDashboard: (id: string) => request<BusinessDashboard>(`/business/${id}/dashboard`),
};
