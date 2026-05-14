import { adminTabs, buildAdminAuthHeaders, escapeHtml, getAdminRequestErrorMessage, getApiBase, getStatusLabel, getTabMeta, safeDataImageSrc, summarizeDashboard, summarizeEscrow, summarizeReview, visibleQueueStatuses } from './admin-state.js';

const state = {
  apiBase: getApiBase(window.TRUSTPAY_ADMIN_API_BASE || '/api', window.location.hostname),
  adminId: sessionStorage.getItem('trustpay-admin-id') || '',
  adminSecret: sessionStorage.getItem('trustpay-admin-secret') || '',
  reviews: [],
  dashboard: null,
  businesses: [],
  consumers: [],
  escrows: [],
  selectedId: null,
  status: 'platform_review',
  activeTab: sessionStorage.getItem('trustpay-admin-tab') || 'dashboard',
};

const $ = (selector) => document.querySelector(selector);

function authHeaders() {
  return buildAdminAuthHeaders(state.adminId, state.adminSecret);
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

function hasAdminCredentials() {
  return Boolean(state.adminId && state.adminSecret);
}

function renderTabs() {
  const nav = $('#admin-tabs');
  nav.innerHTML = '';
  for (const tab of adminTabs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = tab.id === state.activeTab ? 'nav-item nav-item-active' : 'nav-item';
    button.textContent = tab.label;
    button.addEventListener('click', () => setActiveTab(tab.id));
    nav.append(button);
  }
}

function renderTitle() {
  const meta = getTabMeta(state.activeTab);
  $('#content-title').textContent = meta.label;
  $('#content-desc').textContent = meta.description;
}

function renderLoading(message) {
  $('#content-body').innerHTML = `<div class="empty detail-empty">${escapeHtml(message)}</div>`;
}

function renderLoginRequired() {
  $('#content-body').innerHTML = '<div class="empty detail-empty">관리자 아이디와 비밀번호를 입력하세요.</div>';
  setStatus('로그인 대기', 'warn');
}

function setActiveTab(tabId) {
  state.activeTab = getTabMeta(tabId).id;
  sessionStorage.setItem('trustpay-admin-tab', state.activeTab);
  renderTabs();
  renderTitle();
  loadActiveTab();
}

async function loadActiveTab() {
  renderTitle();
  if (state.activeTab === 'settings') {
    renderSettings();
    return;
  }
  if (!hasAdminCredentials()) {
    renderLoginRequired();
    return;
  }
  try {
    if (state.activeTab === 'dashboard') await loadDashboard();
    if (state.activeTab === 'refunds') await loadReviews();
    if (state.activeTab === 'businesses') await loadBusinesses();
    if (state.activeTab === 'consumers') await loadConsumers();
    if (state.activeTab === 'escrows') await loadEscrows();
  } catch (err) {
    setStatus(getAdminRequestErrorMessage(err), 'error');
  }
}

function renderDashboard() {
  const cards = summarizeDashboard(state.dashboard)
    .map((card) => `
      <article class="metric-card" data-tone="${escapeHtml(card.tone)}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
      </article>
    `)
    .join('');
  $('#content-body').innerHTML = `
    <section class="metric-grid admin-metrics">${cards}</section>
    <section class="panel-card quick-panel">
      <h2>빠른 이동</h2>
      <div class="button-row">
        <button type="button" data-tab="refunds">환불/분쟁 처리</button>
        <button type="button" data-tab="businesses">가맹점 보기</button>
        <button type="button" data-tab="escrows">거래/에스크로 보기</button>
      </div>
    </section>
  `;
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  }
}

async function loadDashboard() {
  renderLoading('대시보드를 불러오는 중...');
  state.dashboard = await adminRequest('/admin/dashboard');
  renderDashboard();
  setStatus('대시보드 업데이트 완료', 'ok');
}

function renderFilters() {
  const container = $('#filters');
  if (!container) return;
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

function renderRefundLayout() {
  $('#content-body').innerHTML = `
    <nav id="filters" class="filters" aria-label="환불 검토 상태 필터"></nav>
    <section class="workbench">
      <aside id="case-list" class="queue" aria-label="환불 검토 목록"></aside>
      <article id="case-detail" class="detail" aria-label="환불 검토 상세">
        <div class="empty detail-empty">검토할 케이스를 선택하세요.</div>
      </article>
    </section>
  `;
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
  renderRefundLayout();
  setStatus('환불 검토 큐를 불러오는 중...');
  state.reviews = await adminRequest(`/admin/refund-reviews?status=${encodeURIComponent(state.status)}`);
  renderFilters();
  renderQueue();
  setStatus(`${getStatusLabel(state.status)} ${state.reviews.length}건`, 'ok');
}

function renderBusinessList() {
  const rows = state.businesses.map((business) => `
    <article class="list-card">
      <div>
        <strong>${escapeHtml(business.name)}</strong>
        <span>${escapeHtml(business.category)} · ${escapeHtml(business.registrationVerificationStatus)}</span>
      </div>
      <div class="list-meta">
        <span>상품 ${business._count?.products ?? 0}</span>
        <span>에스크로 ${business._count?.escrows ?? 0}</span>
        <span>분쟁 ${business._count?.refundReviewRequests ?? 0}</span>
      </div>
    </article>
  `).join('');
  $('#content-body').innerHTML = `<section class="list-panel">${rows || '<div class="empty">등록된 가맹점이 없습니다.</div>'}</section>`;
}

async function loadBusinesses() {
  renderLoading('가맹점 목록을 불러오는 중...');
  state.businesses = await adminRequest('/admin/businesses');
  renderBusinessList();
  setStatus(`가맹점 ${state.businesses.length}곳`, 'ok');
}

function renderConsumerList() {
  const rows = state.consumers.map((consumer) => `
    <article class="list-card">
      <div>
        <strong>${escapeHtml(consumer.name)}</strong>
        <span>${escapeHtml(consumer.phone || consumer.email || '연락처 없음')}</span>
      </div>
      <div class="list-meta">
        <span>에스크로 ${consumer._count?.escrows ?? 0}</span>
        <span>결제요청 ${consumer._count?.chargeRequests ?? 0}</span>
        <span>분쟁 ${consumer._count?.refundReviewRequests ?? 0}</span>
      </div>
    </article>
  `).join('');
  $('#content-body').innerHTML = `<section class="list-panel">${rows || '<div class="empty">등록된 소비자가 없습니다.</div>'}</section>`;
}

async function loadConsumers() {
  renderLoading('소비자 목록을 불러오는 중...');
  state.consumers = await adminRequest('/admin/consumers');
  renderConsumerList();
  setStatus(`소비자 ${state.consumers.length}명`, 'ok');
}

function renderEscrowList() {
  const rows = state.escrows.map((escrow) => {
    const summary = summarizeEscrow(escrow);
    return `
      <article class="list-card">
        <div>
          <span class="case-status">${escapeHtml(summary.status)}</span>
          <strong>${escapeHtml(summary.businessName)} · ${escapeHtml(summary.consumerName)}</strong>
          <span>${escapeHtml(summary.escrowType)} · ${escapeHtml(summary.totalKrw)}</span>
        </div>
        <div class="list-meta">
          <span>${escapeHtml(summary.progressText)}</span>
          <span>${escapeHtml(summary.refundText)}</span>
        </div>
      </article>
    `;
  }).join('');
  $('#content-body').innerHTML = `<section class="list-panel">${rows || '<div class="empty">표시할 에스크로가 없습니다.</div>'}</section>`;
}

async function loadEscrows() {
  renderLoading('거래/에스크로 목록을 불러오는 중...');
  state.escrows = await adminRequest('/admin/escrows');
  renderEscrowList();
  setStatus(`에스크로 ${state.escrows.length}건`, 'ok');
}

function renderSettings() {
  $('#content-body').innerHTML = `
    <section class="panel-card settings-panel">
      <h2>관리자 로그인</h2>
      <p>현재 관리자 아이디: <strong>${escapeHtml(state.adminId || '로그인 전')}</strong></p>
      <p>로컬 기본 계정은 <code>admin / admin1234</code>입니다. 운영 환경에서는 <code>ADMIN_ID</code>와 <code>ADMIN_API_SECRET</code>을 설정하세요.</p>
      <button id="logout-admin" type="button">로그아웃</button>
    </section>
  `;
  $('#logout-admin').addEventListener('click', () => {
    state.adminId = '';
    state.adminSecret = '';
    sessionStorage.removeItem('trustpay-admin-id');
    sessionStorage.removeItem('trustpay-admin-secret');
    $('#admin-id').value = '';
    $('#admin-secret').value = '';
    renderLoginRequired();
  });
  setStatus('설정 화면', 'neutral');
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
  renderTabs();
  renderTitle();
  $('#secret-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.adminId = $('#admin-id').value.trim();
    state.adminSecret = $('#admin-secret').value.trim();
    sessionStorage.setItem('trustpay-admin-id', state.adminId);
    sessionStorage.setItem('trustpay-admin-secret', state.adminSecret);
    loadActiveTab();
  });
  $('#admin-id').value = state.adminId;
  $('#admin-secret').value = state.adminSecret;
  loadActiveTab();
}

boot();
