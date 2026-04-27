import type { LoginResponse, EscrowRecord, BusinessDashboard, Business } from '@prepaid-shield/shared-types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 30_000;

export type ApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'XRPL_TIMEOUT'
  | 'INSUFFICIENT_BALANCE'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'SERVER';

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  NETWORK: '네트워크에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.',
  TIMEOUT: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
  XRPL_TIMEOUT: 'XRPL 블록체인 응답 지연 중입니다. 잠시 후 다시 시도해주세요.',
  INSUFFICIENT_BALANCE: 'RLUSD 잔액이 부족합니다. 충전 후 다시 시도해주세요.',
  VALIDATION: '입력값을 확인해주세요.',
  NOT_FOUND: '요청한 정보를 찾을 수 없습니다.',
  SERVER: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

export class ApiError extends Error {
  code: ApiErrorCode;
  statusCode?: number;

  constructor(code: ApiErrorCode, message?: string, statusCode?: number) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }

  get userMessage(): string {
    return ERROR_MESSAGES[this.code];
  }

  get isRetryable(): boolean {
    return ['NETWORK', 'TIMEOUT', 'XRPL_TIMEOUT', 'SERVER'].includes(this.code);
  }
}

function classifyError(status: number, body: any): ApiError {
  const msg = body?.message || '';
  const msgLower = typeof msg === 'string' ? msg.toLowerCase() : '';

  if (status === 400) {
    if (msgLower.includes('insufficient') || msgLower.includes('balance') || msgLower.includes('잔액')) {
      return new ApiError('INSUFFICIENT_BALANCE', msg, status);
    }
    return new ApiError('VALIDATION', msg, status);
  }
  if (status === 404) return new ApiError('NOT_FOUND', msg, status);
  if (status === 408 || status === 504) {
    if (msgLower.includes('xrpl') || msgLower.includes('ledger') || msgLower.includes('escrow')) {
      return new ApiError('XRPL_TIMEOUT', msg, status);
    }
    return new ApiError('TIMEOUT', msg, status);
  }
  if (status >= 500) {
    if (msgLower.includes('xrpl') || msgLower.includes('timeout') || msgLower.includes('disconnected')) {
      return new ApiError('XRPL_TIMEOUT', msg, status);
    }
    return new ApiError('SERVER', msg, status);
  }
  return new ApiError('SERVER', msg, status);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') throw new ApiError('TIMEOUT');
    throw new ApiError('NETWORK');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw classifyError(res.status, body);
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
