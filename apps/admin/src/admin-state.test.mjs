import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, getApiBase, getStatusLabel, safeDataImageSrc, summarizeReview, visibleQueueStatuses } from './admin-state.js';

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
