import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAdminAuthHeaders, escapeHtml, getAdminRequestErrorMessage, getApiBase, getStatusLabel, safeDataImageSrc, summarizeReview, visibleQueueStatuses } from './admin-state.js';

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
    'platform_review',
    'merchant_response_requested',
    'merchant_responded',
    'platform_investigation',
    'platform_approved',
    'rejected',
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

test('escapeHtml neutralizes consumer-provided markup before admin rendering', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('safeDataImageSrc only permits plain base64 image data URLs', () => {
  assert.equal(safeDataImageSrc('data:image/png;base64,ZmFrZQ=='), 'data:image/png;base64,ZmFrZQ==');
  assert.equal(safeDataImageSrc('data:image/svg+xml,<svg onload=alert(1)>'), '');
  assert.equal(safeDataImageSrc('data:image/png;base64,AAA" onerror="alert(1)'), '');
});

test('admin shell uses standard console copy and demo admin credentials', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /환불 검토 관리/);
  assert.match(html, /관리자 아이디/);
  assert.match(html, /placeholder="admin"/);
  assert.match(html, /admin1234/);
  assert.doesNotMatch(html, /분쟁은 가게보다 먼저 운영자에게 온다/);
  assert.doesNotMatch(html, /Refund Operations/);
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
