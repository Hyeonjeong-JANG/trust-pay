/**
 * Testnet E2E Flow Verification
 *
 * Prerequisites:
 *   1. Run `npx tsx scripts/testnet-bootstrap.ts` and copy values to .env
 *   2. Set DEMO_MODE=false, ESCROW_FAST_MODE=true in .env
 *   3. Reset DB: rm apps/api/prisma/dev.db && pnpm --filter api exec prisma db push
 *   4. Start API: pnpm --filter api dev
 *
 * Usage: npx tsx scripts/testnet-e2e-flow.ts
 *
 * Flow (fast mode — 2-min escrow intervals):
 *   1. Register business (wallet + trust line)
 *   2. Login consumer (wallet + trust line + RLUSD auto-fund)
 *   3. Create 3-month escrow
 *   4. Wait 2 min → finish month 1
 *   5. Wait 8 min → cancel remaining (months 2-3)
 *   6. Verify balances and statuses
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

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

  // ─── Step 2: Login consumer (auto-registers with wallet + trust line + RLUSD) ───
  log('Step 2: Login consumer');
  const consumerRes = await request('POST', '/auth/login', {
    phone: '010-1111-0001',
    role: 'consumer',
    name: 'E2E 테스트 소비자',
  });

  let consumerId: string;
  if (consumerRes.status === 201 || consumerRes.status === 200) {
    consumerId = consumerRes.data.userId;
    pass('Consumer Login', `id=${consumerId}, name=${consumerRes.data.name}`);
  } else {
    fail('Consumer Login', `status=${consumerRes.status} ${JSON.stringify(consumerRes.data)}`);
    return printSummary();
  }

  // ─── Step 3: Create 3-month escrow (fast mode = 2-min intervals) ───
  log('Step 3: Create escrow (3 months, 300 RLUSD total)');
  const authHeaders = { 'x-user-id': consumerId, 'x-user-role': 'consumer' };
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

  // ─── Step 4: Wait 2 min, then finish month 1 ───
  log('Step 4: Wait for month 1 finishAfter (2 min)');
  await sleep(2 * 60 * 1000 + 10_000); // 2 min + 10s buffer

  const bizAuthHeaders = { 'x-user-id': businessId, 'x-user-role': 'business' };
  const finishRes = await request('POST', `/escrow/${escrowId}/finish`, {
    entryMonth: 1,
  }, bizAuthHeaders);

  if (finishRes.status === 201 || finishRes.status === 200) {
    pass('Finish Month 1', `txHash=${finishRes.data.txHash}`);
  } else {
    fail('Finish Month 1', `status=${finishRes.status} ${JSON.stringify(finishRes.data)}`);
  }

  // ─── Step 5: Wait 8 min, then cancel remaining ───
  log('Step 5: Wait for cancelAfter on remaining months (8 min)');
  await sleep(8 * 60 * 1000 + 10_000); // 8 min + 10s buffer

  const cancelRes = await request('POST', `/escrow/${escrowId}/cancel`, undefined, authHeaders);

  if (cancelRes.status === 201 || cancelRes.status === 200) {
    pass('Cancel Remaining', `cancelled=${cancelRes.data.cancelled} entries`);
  } else {
    fail('Cancel Remaining', `status=${cancelRes.status} ${JSON.stringify(cancelRes.data)}`);
  }

  // ─── Step 6: Verify final state ───
  log('Step 6: Verify final state');
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
