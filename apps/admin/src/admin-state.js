export const visibleQueueStatuses = [
  'open',
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'merchant_review',
  'platform_investigation',
  'platform_approved',
  'rejected',
];

export const adminTabs = [
  { id: 'dashboard', label: '대시보드', description: '오늘 처리해야 할 운영 지표를 확인합니다.' },
  { id: 'refunds', label: '환불/분쟁', description: '소비자 환불 요청과 사업자 소명을 처리합니다.' },
  { id: 'businesses', label: '가맹점', description: '가입 가맹점과 인증 상태를 확인합니다.' },
  { id: 'consumers', label: '소비자', description: '소비자 계정과 이용 현황을 확인합니다.' },
  { id: 'escrows', label: '거래/에스크로', description: '전체 보호 결제와 정산 상태를 확인합니다.' },
  { id: 'settings', label: '설정', description: '관리자 로그인과 API 연결 상태를 확인합니다.' },
];

const STATUS_LABELS = {
  open: '열린 전체',
  platform_review: 'TrustPay 검토',
  merchant_response_requested: '사업자 소명 요청',
  merchant_responded: '사업자 응답 완료',
  merchant_review: '사업자 검토',
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

export function getTabMeta(tabId) {
  return adminTabs.find((tab) => tab.id === tabId) ?? adminTabs[0];
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

function formatCount(value, suffix) {
  return `${Number(value || 0).toLocaleString('ko-KR')}${suffix}`;
}

export function summarizeDashboard(dashboard = {}) {
  return [
    { label: '열린 환불/분쟁', value: formatCount(dashboard.refundReviews?.open, '건'), tone: 'warning' },
    { label: '사업자 소명 대기', value: formatCount(dashboard.refundReviews?.merchantResponseRequested, '건'), tone: 'primary' },
    { label: '사업자 응답 완료', value: formatCount(dashboard.refundReviews?.merchantResponded, '건'), tone: 'success' },
    { label: '활성 에스크로', value: formatCount(dashboard.escrows?.active, '건'), tone: 'neutral' },
    { label: '가맹점', value: formatCount(dashboard.businesses?.total, '곳'), tone: 'neutral' },
    { label: '소비자', value: formatCount(dashboard.consumers?.total, '명'), tone: 'neutral' },
  ];
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

export function summarizeEscrow(escrow) {
  const entries = escrow.entries ?? [];
  const releasedCount = entries.filter((entry) => entry.status === 'released').length;
  const refundCount = (escrow.refundReviewRequests ?? []).length;
  return {
    id: escrow.id,
    status: escrow.status,
    escrowType: escrow.escrowType,
    businessName: escrow.business?.name ?? '사업자 미확인',
    consumerName: escrow.consumer?.name ?? '소비자 미확인',
    totalKrw: formatKrwFromRlusd(escrow.totalAmount),
    progressText: `${releasedCount}/${entries.length} 정산`,
    refundText: `환불/분쟁 ${refundCount}건`,
  };
}
