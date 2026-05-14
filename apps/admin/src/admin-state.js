export const visibleQueueStatuses = [
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'platform_investigation',
  'platform_approved',
  'rejected',
];

const STATUS_LABELS = {
  platform_review: 'TrustPay 검토',
  merchant_response_requested: '사업자 소명 요청',
  merchant_responded: '사업자 응답 완료',
  platform_investigation: '추가 조사',
  platform_approved: '환불 승인',
  rejected: '환불 거절',
  refunded: '환불 완료',
};

const KRW_PER_RLUSD = 1350;

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  return parts.length === 4
    && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168));
}

export function getApiBase(configuredBase = '/api', hostname = globalThis.location?.hostname) {
  if (configuredBase === '/api' && isLocalHost(hostname)) return 'http://localhost:3000';
  if (isLocalHost(hostname)) {
    try {
      const url = new URL(configuredBase);
      if (isPrivateIpv4(url.hostname)) {
        return `${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`;
      }
    } catch {
      return configuredBase;
    }
  }
  return configuredBase;
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

export function buildAdminAuthHeaders(adminId, adminSecret) {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Id': adminId,
    'X-Admin-Secret': adminSecret,
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeDataImageSrc(value) {
  const input = String(value ?? '');
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(input) ? input : '';
}

export function getAdminRequestErrorMessage(error) {
  const message = error?.message || String(error ?? '');
  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return 'API 서버에 연결할 수 없습니다. API 실행 상태와 CORS 설정을 확인하세요.';
  }
  return message || '관리자 API 요청에 실패했습니다.';
}

export function formatKrwFromRlusd(amount) {
  return `₩${Math.round(Number(amount || 0) * KRW_PER_RLUSD).toLocaleString('ko-KR')}`;
}

function sumAmount(items, status) {
  return (items ?? [])
    .filter((item) => item.status === status)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

export function summarizeReview(review) {
  const escrow = review.escrow ?? {};
  const settledCharges = sumAmount(escrow.chargeRequests, 'settled');
  const releasedEntries = sumAmount(escrow.entries, 'released');
  const usedAmount = settledCharges > 0 ? settledCharges : releasedEntries;
  const reason = review.consumerReason || review.merchantNotice || review.adminResolutionReason || '';

  return {
    id: review.id,
    status: review.status,
    statusLabel: getStatusLabel(review.status),
    businessName: escrow.business?.name ?? '사업자 미확인',
    consumerName: escrow.consumer?.name ?? '소비자 미확인',
    refundableKrw: formatKrwFromRlusd(review.refundableAmount),
    usedKrw: formatKrwFromRlusd(usedAmount),
    requestedAt: review.requestedAt ? new Date(review.requestedAt).toLocaleString('ko-KR') : '-',
    respondBy: review.merchantRespondBy ? new Date(review.merchantRespondBy).toLocaleDateString('ko-KR') : '-',
    photoCountText: `첨부 ${(review.photoDataUrls ?? []).length}장`,
    reasonPreview: reason.length > 80 ? `${reason.slice(0, 80)}...` : reason,
  };
}
