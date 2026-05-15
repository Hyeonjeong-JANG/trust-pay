export const visibleQueueStatuses = [
  'all',
  'needs_action',
  'waiting_merchant',
  'resolved',
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
  needs_action: '처리 필요',
  waiting_merchant: '사업자 대기',
  resolved: '완료',
  all: '전체',
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
const TERMINAL_REFUND_REVIEW_STATUSES = new Set(['platform_approved', 'rejected', 'refunded']);
const NEEDS_ACTION_STATUSES = ['platform_review', 'merchant_responded', 'platform_investigation'];
const WAITING_MERCHANT_STATUSES = ['merchant_response_requested', 'merchant_review'];
const RESOLVED_STATUSES = ['platform_approved', 'rejected', 'refunded'];
const REFUND_DECISION_META = {
  approve: { label: '환불 승인', reasonRequired: false, minLength: 0 },
  reject: { label: '환불 거절', reasonRequired: true, minLength: 5 },
  investigate: { label: '추가 조사', reasonRequired: true, minLength: 5 },
};

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

export function getRefundDecisionMeta(decision) {
  return REFUND_DECISION_META[decision] ?? REFUND_DECISION_META.investigate;
}

export function validateRefundDecisionReason(decision, reason = '') {
  const meta = getRefundDecisionMeta(decision);
  const trimmed = String(reason ?? '').trim();
  if (meta.reasonRequired && trimmed.length < meta.minLength) {
    return `결정 사유는 ${meta.minLength}자 이상 입력해야 합니다.`;
  }
  return '';
}

export function buildRefundDecisionPayload(decision, reason = '') {
  const trimmed = String(reason ?? '').trim();
  return trimmed ? { decision, reason: trimmed } : { decision };
}

export function getQueueFetchStatuses(status) {
  if (status === 'needs_action') return NEEDS_ACTION_STATUSES;
  if (status === 'waiting_merchant') return WAITING_MERCHANT_STATUSES;
  if (status === 'resolved') return RESOLVED_STATUSES;
  if (status === 'all') return [...NEEDS_ACTION_STATUSES, ...WAITING_MERCHANT_STATUSES, ...RESOLVED_STATUSES];
  return [status];
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('ko-KR') : '';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('ko-KR') : '';
}

export function getReviewActionMode(review = {}) {
  if (TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)) return 'terminal';
  if (['merchant_response_requested', 'merchant_review'].includes(review.status)) return 'awaiting_merchant';
  if (review.status === 'merchant_responded') return 'needs_decision';
  return 'request_or_decide';
}

function getQueueTimestamp(review = {}) {
  if (review.status === 'merchant_responded' && review.merchantRespondedAt) return review.merchantRespondedAt;
  if (TERMINAL_REFUND_REVIEW_STATUSES.has(review.status) && review.resolvedAt) return review.resolvedAt;
  return review.requestedAt || review.merchantRespondedAt || review.resolvedAt || '';
}

function getQueueDateLabel(review = {}) {
  if (review.status === 'merchant_responded' && review.merchantRespondedAt) return '사업자 응답';
  if (TERMINAL_REFUND_REVIEW_STATUSES.has(review.status) && review.resolvedAt) return '종료';
  return '접수';
}

export function sortReviewsForQueue(reviews = [], status = 'needs_action') {
  const allowed = new Set(getQueueFetchStatuses(status));
  return reviews
    .filter((review) => status === 'all' || allowed.has(review.status))
    .sort((a, b) => {
      const aTime = new Date(getQueueTimestamp(a)).getTime() || 0;
      const bTime = new Date(getQueueTimestamp(b)).getTime() || 0;
      return aTime - bTime;
    });
}

export function buildReviewTimeline(review = {}) {
  const events = [
    {
      label: '소비자 요청 접수',
      description: review.consumerReason || '환불 검토 요청이 접수되었습니다.',
      timestamp: formatDateTime(review.requestedAt),
      state: 'done',
    },
    {
      label: 'TrustPay 1차 검토',
      description: review.investigationReason || '요청 내용과 에스크로 상태를 확인합니다.',
      timestamp: formatDateTime(review.businessClosureCheckedAt),
      state: review.status === 'platform_review' ? 'current' : 'done',
    },
  ];

  if (review.merchantNotice || ['merchant_response_requested', 'merchant_review', 'merchant_responded'].includes(review.status) || TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)) {
    events.push({
      label: '사업자 소명 요청',
      description: review.merchantNotice || '사업자에게 소명 요청을 보냈습니다.',
      timestamp: review.merchantRespondBy ? `기한 ${formatDate(review.merchantRespondBy)}` : '',
      state: ['merchant_response_requested', 'merchant_review'].includes(review.status) ? 'current' : 'done',
    });
  }

  if (review.merchantResponse || review.status === 'merchant_responded' || TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)) {
    events.push({
      label: '사업자 응답 완료',
      description: review.merchantResponse || '사업자 응답이 접수되었습니다.',
      timestamp: formatDateTime(review.merchantRespondedAt),
      state: 'done',
    });
  }

  if (TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)) {
    events.push({
      label: getStatusLabel(review.status),
      description: review.adminResolutionReason || '운영자 결정이 완료되었습니다.',
      timestamp: formatDateTime(review.resolvedAt),
      state: 'done',
    });
  } else if (review.status === 'merchant_responded') {
    events.push({
      label: '운영자 최종 결정',
      description: '사업자 응답을 확인한 뒤 승인, 거절, 추가 조사 중 하나를 선택하세요.',
      timestamp: '',
      state: 'current',
    });
  }

  return events;
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
    { label: '열린 환불/분쟁', value: formatCount(dashboard.refundReviews?.open, '건'), tone: 'warning', tab: 'refunds', status: 'all', helper: '전체 큐 보기' },
    { label: '사업자 소명 대기', value: formatCount(dashboard.refundReviews?.merchantResponseRequested, '건'), tone: 'primary', tab: 'refunds', status: 'waiting_merchant', helper: '사업자 대기 보기' },
    { label: '사업자 응답 완료', value: formatCount(dashboard.refundReviews?.merchantResponded, '건'), tone: 'success', tab: 'refunds', status: 'needs_action', helper: '응답 검토하기' },
    { label: '활성 에스크로', value: formatCount(dashboard.escrows?.active, '건'), tone: 'neutral', tab: 'escrows', helper: '거래/에스크로 보기' },
    { label: '가맹점', value: formatCount(dashboard.businesses?.total, '곳'), tone: 'neutral', tab: 'businesses', helper: '가맹점 보기' },
    { label: '소비자', value: formatCount(dashboard.consumers?.total, '명'), tone: 'neutral', tab: 'consumers', helper: '소비자 보기' },
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
    requestedAt: formatDateTime(review.requestedAt) || '-',
    respondBy: formatDate(review.merchantRespondBy) || '-',
    queueDate: formatDateTime(getQueueTimestamp(review)) || '-',
    queueDateLabel: getQueueDateLabel(review),
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
