import { escapeHtml, getApiBase, getStatusLabel, safeDataImageSrc, summarizeReview, visibleQueueStatuses } from './admin-state.js';

const state = {
  apiBase: getApiBase(window.TRUSTPAY_ADMIN_API_BASE || '/api', window.location.hostname),
  adminSecret: sessionStorage.getItem('trustpay-admin-secret') || '',
  reviews: [],
  selectedId: null,
  status: 'platform_review',
};

const $ = (selector) => document.querySelector(selector);

function authHeaders() {
  return { 'Content-Type': 'application/json', 'X-Admin-Secret': state.adminSecret };
}

async function adminRequest(path, options = {}) {
  const res = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || '관리자 API 요청에 실패했습니다.');
  }
  return res.json();
}

function setStatus(message, tone = 'neutral') {
  const el = $('#status-line');
  el.textContent = message;
  el.dataset.tone = tone;
}

function renderFilters() {
  const container = $('#filters');
  container.innerHTML = '';
  for (const status of visibleQueueStatuses) {
    const button = document.createElement('button');
    button.className = status === state.status ? 'chip chip-active' : 'chip';
    button.textContent = getStatusLabel(status);
    button.type = 'button';
    button.addEventListener('click', () => {
      state.status = status;
      loadReviews();
    });
    container.append(button);
  }
}

function renderQueue() {
  const list = $('#case-list');
  list.innerHTML = '';
  if (state.reviews.length === 0) {
    list.innerHTML = '<div class="empty">이 상태의 환불 검토 케이스가 없습니다.</div>';
    renderDetail(null);
    return;
  }
  for (const review of state.reviews) {
    const summary = summarizeReview(review);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = summary.id === state.selectedId ? 'case-card selected' : 'case-card';
    card.innerHTML = `
      <span class="case-status">${summary.statusLabel}</span>
      <strong>${escapeHtml(summary.businessName)}</strong>
      <span>${escapeHtml(summary.consumerName)} · ${summary.refundableKrw}</span>
      <small>${escapeHtml(summary.reasonPreview || '요청 사유 없음')}</small>
    `;
    card.addEventListener('click', () => {
      state.selectedId = review.id;
      renderQueue();
      renderDetail(review);
    });
    list.append(card);
  }
  const selected = state.reviews.find((review) => review.id === state.selectedId) || state.reviews[0];
  state.selectedId = selected.id;
  renderDetail(selected);
}

function renderDetail(review) {
  const detail = $('#case-detail');
  if (!review) {
    detail.innerHTML = '<div class="empty detail-empty">검토할 케이스를 선택하세요.</div>';
    return;
  }

  const summary = summarizeReview(review);
  const photos = (review.photoDataUrls || [])
    .map(safeDataImageSrc)
    .filter(Boolean)
    .map((src) => `<img src="${src}" alt="환불 증빙 사진" />`)
    .join('');
  detail.innerHTML = `
    <div class="detail-head">
      <span class="case-status">${summary.statusLabel}</span>
      <h2>${escapeHtml(summary.businessName)}</h2>
      <p>${escapeHtml(summary.consumerName)} · 요청 ${summary.requestedAt}</p>
    </div>
    <div class="metric-grid">
      <div><span>환불 검토 금액</span><strong>${summary.refundableKrw}</strong></div>
      <div><span>사용/정산 금액</span><strong>${summary.usedKrw}</strong></div>
      <div><span>사업자 응답 기한</span><strong>${summary.respondBy}</strong></div>
      <div><span>증빙</span><strong>${summary.photoCountText}</strong></div>
    </div>
    <section class="evidence-panel">
      <h3>소비자 요청 사유</h3>
      <p>${escapeHtml(review.consumerReason || '기록된 사유가 없습니다.')}</p>
      <div class="photo-grid">${photos}</div>
    </section>
    <section class="action-panel">
      <label>사업자에게 보낼 소명 요청</label>
      <textarea id="merchant-notice" maxlength="500">${escapeHtml(review.merchantNotice || '고객이 장기 휴업 또는 이용 불가를 주장했습니다. 영업 가능 여부와 미사용분 처리 방안을 답변해주세요.')}</textarea>
      <div class="button-row">
        <button id="request-merchant" class="primary" type="button">사업자 소명 요청</button>
        <button id="approve-review" type="button">환불 승인</button>
        <button id="reject-review" type="button">환불 거절</button>
        <button id="investigate-review" type="button">추가 조사</button>
      </div>
    </section>
  `;

  $('#request-merchant').addEventListener('click', () => requestMerchant(review.id));
  $('#approve-review').addEventListener('click', () => resolveReview(review.id, 'approve'));
  $('#reject-review').addEventListener('click', () => resolveReview(review.id, 'reject'));
  $('#investigate-review').addEventListener('click', () => resolveReview(review.id, 'investigate'));
}

async function loadReviews() {
  if (!state.adminSecret) {
    setStatus('관리자 비밀번호를 입력하세요.', 'warn');
    return;
  }
  try {
    setStatus('환불 검토 큐를 불러오는 중...');
    state.reviews = await adminRequest(`/admin/refund-reviews?status=${encodeURIComponent(state.status)}`);
    renderFilters();
    renderQueue();
    setStatus(`${getStatusLabel(state.status)} ${state.reviews.length}건`, 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function requestMerchant(id) {
  const merchantNotice = $('#merchant-notice').value.trim();
  if (merchantNotice.length < 10) {
    setStatus('사업자 소명 요청은 10자 이상 입력해야 합니다.', 'warn');
    return;
  }
  await adminRequest(`/admin/refund-reviews/${id}/request-merchant-response`, {
    method: 'POST',
    body: JSON.stringify({ merchantNotice }),
  });
  setStatus('사업자 소명 요청을 보냈습니다.', 'ok');
  state.status = 'merchant_response_requested';
  await loadReviews();
}

async function resolveReview(id, decision) {
  const labels = { approve: '환불 승인', reject: '환불 거절', investigate: '추가 조사' };
  const reason = window.prompt(`${labels[decision]} 사유를 입력하세요.`);
  if (!reason || reason.trim().length < 5) {
    setStatus('결정 사유는 5자 이상 입력해야 합니다.', 'warn');
    return;
  }
  await adminRequest(`/admin/refund-reviews/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason: reason.trim() }),
  });
  setStatus(`${labels[decision]} 처리했습니다.`, 'ok');
  await loadReviews();
}

function boot() {
  renderFilters();
  $('#secret-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.adminSecret = $('#admin-secret').value.trim();
    sessionStorage.setItem('trustpay-admin-secret', state.adminSecret);
    loadReviews();
  });
  $('#admin-secret').value = state.adminSecret;
  if (state.adminSecret) loadReviews();
}

boot();
