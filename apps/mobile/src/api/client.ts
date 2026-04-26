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
  // Escrow
  createEscrow: (data: {
    consumerAddress: string;
    businessAddress: string;
    totalAmount: number;
    months: number;
  }) => request('/escrow', { method: 'POST', body: JSON.stringify(data) }),

  getEscrow: (id: string) => request(`/escrow/${id}`),

  finishEscrow: (id: string, entryMonth: number) =>
    request(`/escrow/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify({ entryMonth }),
    }),

  cancelEscrow: (id: string) =>
    request(`/escrow/${id}/cancel`, { method: 'POST' }),

  getConsumerEscrows: (address: string) =>
    request(`/escrow/consumer/${address}`),

  // Business
  getBusinesses: () => request('/business'),
  getBusiness: (id: string) => request(`/business/${id}`),
  getBusinessDashboard: (id: string) => request(`/business/${id}/dashboard`),
  registerBusiness: (data: {
    name: string;
    category: string;
    address: string;
    xrplAddress: string;
  }) => request('/business', { method: 'POST', body: JSON.stringify(data) }),
};
