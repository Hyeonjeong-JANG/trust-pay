/**
 * Testnet E2E Flow Verification
 *
 * Prerequisites:
 *   1. Run `npx tsx scripts/testnet-bootstrap.ts` and copy values to .env
 *   2. Set DEMO_MODE=false, AUTH_DEMO_OTP=true, ESCROW_FAST_MODE=true in .env
 *   3. Reset DB: rm apps/api/prisma/dev.db && pnpm --filter api exec prisma db push
 *   4. Start API: pnpm --filter api dev
 *
 * Usage: npx tsx scripts/testnet-e2e-flow.ts
 * Help:  npx tsx scripts/testnet-e2e-flow.ts --help
 *
 * Flow (fast mode — 2-min escrow intervals):
 *   1. Register business (wallet + trust line)
 *   2. Login business with OTP
 *   3. Login consumer with OTP (wallet + trust line + RLUSD auto-fund)
 *   4. Create 3-month escrow
 *   5. Wait 2 min → finish month 1
 *   6. Wait 8 min → cancel remaining (months 2-3)
 *   7. Verify balances and statuses
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const DEFAULT_OTP_CODE = process.env.TESTNET_E2E_OTP_CODE || '123456';

function shouldPrintHelp(): boolean {
  return process.argv.includes('--help') || process.argv.includes('-h');
}

function printHelp() {
  console.log(`
TrustPay API-backed XRPL Testnet E2E 검증 스크립트

Usage:
  pnpm exec tsx scripts/testnet-e2e-flow.ts --help
  API_URL=http://localhost:3000 pnpm exec tsx scripts/testnet-e2e-flow.ts

Prerequisites:
  1. pnpm exec tsx scripts/testnet-bootstrap.ts
  2. apps/api/.env에 RLUSD_ISSUER와 RLUSD_ISSUER_SEED 설정
  3. apps/api/.env에 DEMO_MODE=false 설정
  4. apps/api/.env에 AUTH_DEMO_OTP=true 설정 (XRPL은 Testnet, OTP만 고정 코드)
  5. apps/api/.env에 ESCROW_FAST_MODE=true 설정
  6. DATABASE_URL="file:./dev.db" pnpm --filter api exec prisma db push
  7. pnpm --filter api dev

What it proves through the API:
  1. 사업자 등록 시 Testnet 지갑과 RLUSD Trust Line 생성
  2. OTP 검증 후 서버 서명 세션 토큰 발급
  3. 소비자 로그인 시 Testnet 지갑, RLUSD Trust Line, RLUSD 자동 지급
  4. 3개월 에스크로 생성 시 3개 XLS-85 Token EscrowCreate 발생
  5. 1월차 EscrowFinish로 사업자 정산
  6. 남은 월차 EscrowCancel로 소비자 환불
  7. API DB 상태가 released/refunded로 반영됨

Expected evidence:
  - API 응답의 xrplAddress
  - EscrowFinish txHash
  - 최종 escrow.status=cancelled, month1=released, months2-3=refunded

Secret policy:
  - RLUSD_ISSUER_SEED는 apps/api/.env에만 둡니다.
  - 제출 문서에는 address와 tx hash만 기록합니다.
  - seed/private key는 출력하거나 커밋하지 않습니다.
`);
}

if (shouldPrintHelp()) {
  printHelp();
  process.exit(0);
}

interface StepResult {
  step: string;
  passed: boolean;
  detail: string;
}

const results: StepResult[] = [];

function log(msg: string) {
  console.log(`[E2E] ${msg}`);
}

function pass(step: string, detail: string) {
  results.push({ step, passed: true, detail });
  console.log(`  ✅ ${step}: ${detail}`);
}

function fail(step: string, detail: string) {
  results.push({ step, passed: false, detail });
  console.error(`  ❌ ${step}: ${detail}`);
}

async function request(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function loginWithOtp(payload: { phone?: string; email?: string; role: 'consumer' | 'business'; name?: string }) {
  const codeRes = await request('POST', '/auth/request-code', payload);
  if (codeRes.status !== 201 && codeRes.status !== 200) {
    return codeRes;
  }

  const code = codeRes.data?.code ?? DEFAULT_OTP_CODE;
  return request('POST', '/auth/verify-code', { ...payload, code });
}

function sleep(ms: number) {
  log(`Waiting ${Math.round(ms / 1000)}s...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  log('Starting Testnet E2E Flow Verification');
  log(`API: ${BASE_URL}\n`);

  // ─── Step 1: Register business ───
  log('Step 1: Register business');
  const bizRes = await request('POST', '/business', {
    name: 'E2E 테스트 사업자',
    category: '음식점',
    address: '서울시 강남구 테스트로 1',
    phone: '010-9999-0001',
  });

  let businessId: string;
  if (bizRes.status === 201 || bizRes.status === 200) {
    businessId = bizRes.data.id;
    pass('Business Registration', `id=${businessId}, address=${bizRes.data.xrplAddress}`);
  } else {
    fail('Business Registration', `status=${bizRes.status} ${JSON.stringify(bizRes.data)}`);
    return printSummary();
  }

  // ─── Step 2: Login business ───
  log('Step 2: Login business');
  const businessLoginRes = await loginWithOtp({
    phone: '010-9999-0001',
    role: 'business',
  });

  let businessToken: string;
  if (businessLoginRes.status === 201 || businessLoginRes.status === 200) {
    businessToken = businessLoginRes.data.token;
    pass('Business Login', `id=${businessLoginRes.data.userId}, name=${businessLoginRes.data.name}`);
  } else {
    fail('Business Login', `status=${businessLoginRes.status} ${JSON.stringify(businessLoginRes.data)}`);
    return printSummary();
  }

  // ─── Step 3: Login consumer (auto-registers with wallet + trust line + RLUSD) ───
  log('Step 3: Login consumer');
  const consumerRes = await loginWithOtp({
    phone: '010-1111-0001',
    role: 'consumer',
    name: 'E2E 테스트 소비자',
  });

  let consumerId: string;
  let consumerToken: string;
  if (consumerRes.status === 201 || consumerRes.status === 200) {
    consumerId = consumerRes.data.userId;
    consumerToken = consumerRes.data.token;
    pass('Consumer Login', `id=${consumerId}, name=${consumerRes.data.name}`);
  } else {
    fail('Consumer Login', `status=${consumerRes.status} ${JSON.stringify(consumerRes.data)}`);
    return printSummary();
  }

  // ─── Step 4: Create 3-month escrow (fast mode = 2-min intervals) ───
  log('Step 4: Create escrow (3 months, 300 RLUSD total)');
  const authHeaders = auth(consumerToken);
  const escrowRes = await request('POST', '/escrow', {
    consumerId,
    businessId,
    totalAmount: 300,
    months: 3,
  }, authHeaders);

  let escrowId: string;
  if (escrowRes.status === 201 || escrowRes.status === 200) {
    escrowId = escrowRes.data.id;
    const entryCount = escrowRes.data.entries?.length ?? 0;
    pass('Escrow Creation', `id=${escrowId}, entries=${entryCount}`);

    if (entryCount !== 3) {
      fail('Entry Count', `Expected 3, got ${entryCount}`);
      return printSummary();
    }
  } else {
    fail('Escrow Creation', `status=${escrowRes.status} ${JSON.stringify(escrowRes.data)}`);
    return printSummary();
  }

  // ─── Step 5: Wait 2 min, then finish month 1 ───
  log('Step 5: Wait for month 1 finishAfter (2 min)');
  await sleep(2 * 60 * 1000 + 10_000); // 2 min + 10s buffer

  const bizAuthHeaders = auth(businessToken);
  const finishRes = await request('POST', `/escrow/${escrowId}/finish`, {
    entryMonth: 1,
  }, bizAuthHeaders);

  if (finishRes.status === 201 || finishRes.status === 200) {
    pass('Finish Month 1', `txHash=${finishRes.data.txHash}`);
  } else {
    fail('Finish Month 1', `status=${finishRes.status} ${JSON.stringify(finishRes.data)}`);
  }

  // ─── Step 6: Wait 8 min, then cancel remaining ───
  log('Step 6: Wait for cancelAfter on remaining months (8 min)');
  await sleep(8 * 60 * 1000 + 10_000); // 8 min + 10s buffer

  const cancelRes = await request('POST', `/escrow/${escrowId}/cancel`, undefined, authHeaders);

  if (cancelRes.status === 201 || cancelRes.status === 200) {
    pass('Cancel Remaining', `cancelled=${cancelRes.data.cancelled} entries`);
  } else {
    fail('Cancel Remaining', `status=${cancelRes.status} ${JSON.stringify(cancelRes.data)}`);
  }

  // ─── Step 7: Verify final state ───
  log('Step 7: Verify final state');
  const finalEscrow = await request('GET', `/escrow/${escrowId}`, undefined, authHeaders);

  if (finalEscrow.status === 200) {
    const escrow = finalEscrow.data;
    const statuses = escrow.entries.map((e: any) => `month ${e.month}: ${e.status}`).join(', ');

    if (escrow.status === 'cancelled') {
      pass('Escrow Status', `status=${escrow.status}`);
    } else {
      fail('Escrow Status', `Expected 'cancelled', got '${escrow.status}'`);
    }

    const month1 = escrow.entries.find((e: any) => e.month === 1);
    if (month1?.status === 'released') {
      pass('Month 1 Status', 'released');
    } else {
      fail('Month 1 Status', `Expected 'released', got '${month1?.status}'`);
    }

    const refunded = escrow.entries.filter((e: any) => e.status === 'refunded');
    if (refunded.length === 2) {
      pass('Months 2-3 Status', 'refunded');
    } else {
      fail('Months 2-3 Status', `Expected 2 refunded, got ${refunded.length} — ${statuses}`);
    }
  } else {
    fail('Final State', `status=${finalEscrow.status}`);
  }

  // Balance check
  const bizBalance = await request('GET', `/business/${businessId}/balance`, undefined, bizAuthHeaders);
  if (bizBalance.status === 200) {
    pass('Business Balance', `${JSON.stringify(bizBalance.data)}`);
  } else {
    fail('Business Balance', `status=${bizBalance.status}`);
  }

  printSummary();
}

function printSummary() {
  console.log('\n════════════════════════════════════════');
  console.log('  E2E Flow Summary');
  console.log('════════════════════════════════════════');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.step}: ${r.detail}`);
  }
  console.log(`\n  Result: ${passed}/${total} passed`);
  console.log('════════════════════════════════════════\n');

  if (passed < total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('E2E flow failed:', err);
  process.exit(1);
});
