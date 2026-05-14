import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminTabs, buildAdminAuthHeaders, buildReviewTimeline, escapeHtml, getAdminRequestErrorMessage, getApiBase, getQueueFetchStatuses, getReviewActionMode, getStatusLabel, getTabMeta, safeDataImageSrc, sortReviewsForQueue, summarizeDashboard, summarizeEscrow, summarizeReview, visibleQueueStatuses } from './admin-state.js';

test('getApiBase resolves local and deployed admin API roots', () => {
  assert.equal(getApiBase('/api', 'localhost'), 'http://localhost:3000');
  assert.equal(getApiBase('/api', 'xrpl-tawny.vercel.app'), '/api');
  assert.equal(getApiBase('http://192.168.35.19:3000', 'localhost'), 'http://localhost:3000');
});

test('getStatusLabel describes platform-first refund review states', () => {
  assert.equal(getStatusLabel('platform_review'), 'TrustPay 검토');
  assert.equal(getStatusLabel('merchant_response_requested'), '사업자 소명 요청');
  assert.equal(getStatusLabel('platform_approved'), '환불 승인');
});

test('visibleQueueStatuses prioritizes operational refund review work', () => {
  assert.deepEqual(visibleQueueStatuses, [
    'all',
    'needs_action',
    'waiting_merchant',
    'resolved',
  ]);
  assert.equal(getStatusLabel('all'), '전체');
  assert.equal(getStatusLabel('needs_action'), '처리 필요');
  assert.equal(getStatusLabel('waiting_merchant'), '사업자 대기');
  assert.equal(getStatusLabel('resolved'), '완료');
});

test('admin refund queue defaults to the actionable work view', () => {
  const js = readFileSync(new URL('./main.js', import.meta.url), 'utf8');

  assert.match(js, /status: 'needs_action'/);
  assert.match(js, /fetchReviewsForFilter/);
});

test('queue filters collapse detailed statuses into operator decisions', () => {
  assert.deepEqual(getQueueFetchStatuses('needs_action'), [
    'platform_review',
    'merchant_responded',
    'merchant_review',
    'platform_investigation',
  ]);
  assert.deepEqual(getQueueFetchStatuses('waiting_merchant'), ['merchant_response_requested']);
  assert.deepEqual(getQueueFetchStatuses('resolved'), ['platform_approved', 'rejected', 'refunded']);
});

test('sortReviewsForQueue puts oldest unprocessed incoming work first', () => {
  const reviews = sortReviewsForQueue([
    { id: 'terminal', status: 'platform_approved', requestedAt: '2026-05-13T00:00:00.000Z' },
    { id: 'new-consumer', status: 'platform_review', requestedAt: '2026-05-15T00:00:00.000Z' },
    { id: 'waiting-merchant', status: 'merchant_response_requested', requestedAt: '2026-05-12T00:00:00.000Z' },
    { id: 'old-merchant-response', status: 'merchant_responded', requestedAt: '2026-05-10T00:00:00.000Z', merchantRespondedAt: '2026-05-14T00:00:00.000Z' },
  ], 'needs_action');

  assert.deepEqual(reviews.map((review) => review.id), ['old-merchant-response', 'new-consumer']);
});

test('summarizeReview exposes the queue ordering date shown on case cards', () => {
  const summary = summarizeReview({
    id: 'review-responded',
    status: 'merchant_responded',
    refundableAmount: 300,
    requestedAt: '2026-05-10T00:00:00.000Z',
    merchantRespondedAt: '2026-05-14T08:30:00.000Z',
    merchantResponse: '사업자 응답입니다.',
    escrow: { business: { name: '파워짐' }, consumer: { name: '김민수' }, entries: [], chargeRequests: [] },
  });

  assert.equal(summary.queueDateLabel, '사업자 응답');
  assert.match(summary.queueDate, /2026\. 5\. 14\./);
});

test('admin refund detail renders a timeline and status-specific action modes', () => {
  const js = readFileSync(new URL('./main.js', import.meta.url), 'utf8');

  assert.match(js, /buildReviewTimeline/);
  assert.match(js, /getReviewActionMode/);
  assert.match(js, /class="review-timeline"/);
  assert.match(js, /case 'needs_decision'/);
  assert.match(js, /case 'awaiting_merchant'/);
});

test('adminTabs defines standard operations sections', () => {
  assert.deepEqual(adminTabs.map((tab) => tab.id), ['dashboard', 'refunds', 'businesses', 'consumers', 'escrows', 'settings']);
  assert.equal(getTabMeta('businesses').label, '가맹점');
  assert.equal(getTabMeta('unknown').label, '대시보드');
});

test('summarizeDashboard creates card-ready admin metrics', () => {
  assert.deepEqual(summarizeDashboard({
    refundReviews: { open: 4, merchantResponseRequested: 2, merchantResponded: 1, platformInvestigation: 1 },
    businesses: { total: 7 },
    consumers: { total: 11 },
    escrows: { active: 5 },
  }), [
    { label: '열린 환불/분쟁', value: '4건', tone: 'warning' },
    { label: '사업자 소명 대기', value: '2건', tone: 'primary' },
    { label: '사업자 응답 완료', value: '1건', tone: 'success' },
    { label: '활성 에스크로', value: '5건', tone: 'neutral' },
    { label: '가맹점', value: '7곳', tone: 'neutral' },
    { label: '소비자', value: '11명', tone: 'neutral' },
  ]);
});

test('summarizeReview creates an operator-readable queue item', () => {
  const summary = summarizeReview({
    id: 'review-1',
    status: 'platform_review',
    refundableAmount: 600,
    requestedAt: '2026-05-14T00:00:00.000Z',
    merchantRespondBy: '2026-05-19T00:00:00.000Z',
    consumerReason: '2주 넘게 안 열고 전화도 안 받아요ㅠㅠ',
    photoDataUrls: ['data:image/png;base64,ZmFrZQ=='],
    escrow: {
      id: 'escrow-1',
      business: { name: '파워짐' },
      consumer: { name: '김민수' },
      entries: [{ status: 'released', amount: '100' }, { status: 'pending', amount: '600' }],
      chargeRequests: [{ status: 'settled', amount: 100 }],
    },
  });

  assert.equal(summary.businessName, '파워짐');
  assert.equal(summary.consumerName, '김민수');
  assert.equal(summary.refundableKrw, '₩810,000');
  assert.equal(summary.usedKrw, '₩135,000');
  assert.equal(summary.photoCountText, '첨부 1장');
  assert.equal(summary.reasonPreview, '2주 넘게 안 열고 전화도 안 받아요ㅠㅠ');
});

test('buildReviewTimeline explains merchant response progress and next admin decision', () => {
  const timeline = buildReviewTimeline({
    status: 'merchant_responded',
    requestedAt: '2026-05-14T00:00:00.000Z',
    merchantNotice: '영업 여부와 미사용분 처리 방안을 답변해주세요.',
    merchantRespondBy: '2026-05-19T00:00:00.000Z',
    merchantResponse: '정상 영업 중이며 환불 가능 범위를 확인했습니다.',
    merchantRespondedAt: '2026-05-16T05:20:00.000Z',
  });

  assert.deepEqual(timeline.map((item) => [item.label, item.state]), [
    ['소비자 요청 접수', 'done'],
    ['TrustPay 1차 검토', 'done'],
    ['사업자 소명 요청', 'done'],
    ['사업자 응답 완료', 'done'],
    ['운영자 최종 결정', 'current'],
  ]);
  assert.match(timeline[3].description, /정상 영업 중/);
});

test('getReviewActionMode separates waiting, responded, terminal, and requestable states', () => {
  assert.equal(getReviewActionMode({ status: 'merchant_response_requested' }), 'awaiting_merchant');
  assert.equal(getReviewActionMode({ status: 'merchant_responded' }), 'needs_decision');
  assert.equal(getReviewActionMode({ status: 'platform_approved' }), 'terminal');
  assert.equal(getReviewActionMode({ status: 'platform_review' }), 'request_or_decide');
});

test('summarizeEscrow creates compact transaction rows', () => {
  const summary = summarizeEscrow({
    id: 'escrow-1',
    status: 'active',
    escrowType: 'prepaid',
    totalAmount: 150,
    business: { name: '강남 블루보틀' },
    consumer: { name: '이서연' },
    entries: [{ status: 'pending' }, { status: 'released' }],
    refundReviewRequests: [{ status: 'platform_review' }],
  });

  assert.equal(summary.businessName, '강남 블루보틀');
  assert.equal(summary.consumerName, '이서연');
  assert.equal(summary.totalKrw, '₩202,500');
  assert.equal(summary.progressText, '1/2 정산');
  assert.equal(summary.refundText, '환불/분쟁 1건');
});

test('escapeHtml neutralizes consumer-provided markup before admin rendering', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('safeDataImageSrc only permits plain base64 image data URLs', () => {
  assert.equal(safeDataImageSrc('data:image/png;base64,ZmFrZQ=='), 'data:image/png;base64,ZmFrZQ==');
  assert.equal(safeDataImageSrc('data:image/svg+xml,<svg onload=alert(1)>'), '');
  assert.equal(safeDataImageSrc('data:image/png;base64,AAA" onerror="alert(1)'), '');
});

test('admin shell starts with a dedicated centered login view', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="login-view"/);
  assert.match(html, /class="login-view"/);
  assert.match(html, /id="admin-view"/);
  assert.match(html, /hidden/);
  assert.match(html, /관리자 콘솔 로그인/);
  assert.match(html, /관리자 아이디/);
  assert.match(html, /placeholder="admin"/);
  assert.match(html, /admin1234/);
});

test('admin app shell keeps navigation separate from login form', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /대시보드/);
  assert.match(html, /id="admin-tabs"/);
  assert.doesNotMatch(html, /<aside class="sidebar">[\s\S]*<form id="secret-form"/);
  assert.doesNotMatch(html, /분쟁은 가게보다 먼저 운영자에게 온다/);
  assert.doesNotMatch(html, /Refund Operations/);
});

test('admin refund layout keeps the header compact and filters sticky', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.topbar\s*\{[\s\S]*min-height:\s*88px/);
  assert.match(css, /\.topbar h1\s*\{[\s\S]*font-size:\s*24px/);
  assert.match(css, /\.filters\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /\.filters\s*\{[\s\S]*top:\s*16px/);
});

test('admin login flow checks credentials before rendering any tab', () => {
  const js = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const loadActiveTab = js.slice(js.indexOf('async function loadActiveTab'), js.indexOf('function renderDashboard'));

  assert.ok(loadActiveTab.indexOf('if (!hasAdminCredentials())') < loadActiveTab.indexOf("state.activeTab === 'settings'"));
  assert.match(loadActiveTab, /renderAdminShell\(\);/);
});

test('admin login submit always enters the dashboard tab', () => {
  const js = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const submitHandler = js.slice(js.indexOf('function boot()'), js.indexOf('boot();'));

  assert.match(submitHandler, /state\.activeTab = 'dashboard';/);
  assert.match(submitHandler, /sessionStorage\.setItem\('trustpay-admin-tab', state\.activeTab\);/);
});

test('buildAdminAuthHeaders sends both admin id and password headers', () => {
  assert.deepEqual(buildAdminAuthHeaders('admin', 'admin1234'), {
    'Content-Type': 'application/json',
    'X-Admin-Id': 'admin',
    'X-Admin-Secret': 'admin1234',
  });
});

test('getAdminRequestErrorMessage explains fetch failures in operator terms', () => {
  assert.equal(
    getAdminRequestErrorMessage(new Error('Failed to fetch')),
    'API 서버에 연결할 수 없습니다. API 실행 상태와 CORS 설정을 확인하세요.',
  );
});
