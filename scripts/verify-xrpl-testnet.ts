#!/usr/bin/env npx tsx
/**
 * XRPL Testnet 연동 검증 스크립트
 *
 * 실행:
 *  pnpm exec tsx scripts/verify-xrpl-testnet.ts --help
 *  pnpm exec tsx scripts/verify-xrpl-testnet.ts
 *
 * 테스트 항목:
 *  1. Testnet 연결
 *  2. 지갑 2개 생성 (소비자, 사업자)
 *  3. Trust Line 설정 (RLUSD)
 *  4. Token Escrow 생성 (데모 모드: 월 = 2분)
 *  5. Escrow Finish (릴리즈) — FinishAfter 대기 후
 *  6. Escrow Cancel (취소) — CancelAfter 대기 후
 *
 * 주의: Testnet 네트워크 상태에 따라 1~5분 소요될 수 있음
 * 출력 정책: address와 tx hash만 출력하고 seed/private key는 출력하지 않음
 */

import { Client, Wallet } from 'xrpl';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';
// RLUSD: 5-char currency → 40-char hex (XRPL non-standard currency encoding)
const RLUSD_CURRENCY = Buffer.from('RLUSD', 'ascii').toString('hex').toUpperCase().padEnd(40, '0');
const RIPPLE_EPOCH = 946684800;

interface TxEvidence {
  label: string;
  hash: string;
}

function shouldPrintHelp(): boolean {
  return process.argv.includes('--help') || process.argv.includes('-h');
}

function printHelp() {
  console.log(`
TrustPay XRPL Testnet 직접 검증 스크립트

Usage:
  pnpm exec tsx scripts/verify-xrpl-testnet.ts --help
  pnpm exec tsx scripts/verify-xrpl-testnet.ts

What it proves:
  1. XRPL Testnet websocket 연결
  2. 소비자, 사업자, RLUSD 발행자 Testnet 지갑 생성
  3. 발행자 AccountSet으로 asfAllowTrustLineLocking 활성화
  4. 소비자/사업자 TrustSet으로 RLUSD Trust Line 설정
  5. 발행자 Payment로 소비자에게 RLUSD 지급
  6. XLS-85 Token EscrowCreate로 월별 RLUSD 에스크로 생성
  7. EscrowFinish로 도래한 월차를 사업자에게 릴리즈
  8. EscrowCancel로 미이용 월차를 소비자에게 환불

Expected evidence:
  - Testnet address: consumer, business, issuer
  - Transaction hash: AccountSet, TrustSet, Payment, EscrowCreate, EscrowFinish, EscrowCancel

Secret policy:
  - 이 스크립트는 임시 Testnet 지갑을 생성합니다.
  - 제출 문서에는 address와 tx hash만 기록합니다.
  - seed/private key는 출력하지 않습니다.
`);
}

if (shouldPrintHelp()) {
  printHelp();
  process.exit(0);
}

// ─── Helpers ───
function log(step: string, msg: string) {
  const ts = new Date().toLocaleTimeString('ko-KR');
  console.log(`[${ts}] ✅ ${step}: ${msg}`);
}

function fail(step: string, msg: string) {
  const ts = new Date().toLocaleTimeString('ko-KR');
  console.error(`[${ts}] ❌ ${step}: ${msg}`);
}

function wait(ms: number): Promise<void> {
  const secs = Math.round(ms / 1000);
  console.log(`⏳ ${secs}초 대기 중...`);
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ───
async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  PrepaidShield — XRPL Testnet 연동 검증');
  console.log('═══════════════════════════════════════════\n');

  // 1. Connect
  const client = new Client(TESTNET_URL);
  await client.connect();
  log('Step 1', `Testnet 연결 완료 (${TESTNET_URL})`);

  let consumerWallet: Wallet;
  let businessWallet: Wallet;
  let issuerWallet: Wallet;
  const evidence: TxEvidence[] = [];

  try {
    // 2. Create wallets
    console.log('\n--- 지갑 생성 ---');
    const [consumer, business, issuer] = await Promise.all([
      client.fundWallet(),
      client.fundWallet(),
      client.fundWallet(),
    ]);
    consumerWallet = consumer.wallet;
    businessWallet = business.wallet;
    issuerWallet = issuer.wallet;

    log('Step 2', `소비자 지갑: ${consumerWallet.address}`);
    log('Step 2', `사업자 지갑: ${businessWallet.address}`);
    log('Step 2', `발행자 지갑: ${issuerWallet.address}`);

    // 2.5. Enable TrustLine Locking on issuer (required for XLS-85 Token Escrow)
    console.log('\n--- 발행자 AccountSet (asfAllowTrustLineLocking) ---');
    const accountSetRes = await client.submitAndWait(
      {
        TransactionType: 'AccountSet',
        Account: issuerWallet.address,
        SetFlag: 17, // asfAllowTrustLineLocking
      },
      { wallet: issuerWallet },
    );
    const accountSetMeta = accountSetRes.result.meta as any;
    if (accountSetMeta?.TransactionResult === 'tesSUCCESS') {
      evidence.push({ label: 'issuer AccountSet asfAllowTrustLineLocking', hash: accountSetRes.result.hash });
      log('Step 2.5', '발행자 TrustLine Locking 활성화 완료');
    } else {
      fail('Step 2.5', `발행자 AccountSet 실패: ${accountSetMeta?.TransactionResult}`);
      throw new Error('AccountSet failed');
    }

    // 3. Trust Lines
    console.log('\n--- Trust Line 설정 ---');
    for (const [label, wallet] of [
      ['소비자', consumerWallet],
      ['사업자', businessWallet],
    ] as const) {
      const trustRes = await client.submitAndWait(
        {
          TransactionType: 'TrustSet',
          Account: wallet.address,
          LimitAmount: {
            currency: RLUSD_CURRENCY,
            issuer: issuerWallet.address,
            value: '1000000',
          },
        },
        { wallet },
      );
      const meta = trustRes.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        evidence.push({ label: `${label} TrustSet RLUSD`, hash: trustRes.result.hash });
        log('Step 3', `${label} Trust Line 설정 완료`);
      } else {
        fail('Step 3', `${label} Trust Line 실패: ${meta?.TransactionResult}`);
        throw new Error('Trust Line failed');
      }
    }

    // Issue RLUSD to consumer (issuer → consumer)
    console.log('\n--- RLUSD 발행 (소비자에게 전송) ---');
    const payRes = await client.submitAndWait(
      {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: consumerWallet.address,
        Amount: {
          currency: RLUSD_CURRENCY,
          issuer: issuerWallet.address,
          value: '10000', // 10,000 RLUSD
        },
      },
      { wallet: issuerWallet },
    );
    const payMeta = payRes.result.meta as any;
    if (payMeta?.TransactionResult === 'tesSUCCESS') {
      evidence.push({ label: 'issuer Payment 10000 RLUSD to consumer', hash: payRes.result.hash });
      log('Step 3+', `소비자에게 10,000 RLUSD 전송 완료`);
    } else {
      fail('Step 3+', `RLUSD 전송 실패: ${payMeta?.TransactionResult}`);
      throw new Error('Payment failed');
    }

    // 4. Token Escrow 생성 (데모 모드: 2분 간격)
    console.log('\n--- Token Escrow 생성 (3개월, 데모 모드) ---');
    const DEMO_MONTH_MS = 2 * 60 * 1000; // 2분
    const now = Date.now();
    const escrows: { month: number; sequence: number; finishAfter: number; cancelAfter: number; txHash: string }[] = [];
    const monthlyAmount = '1000';

    for (let month = 1; month <= 3; month++) {
      const finishAfter = Math.floor((now + month * DEMO_MONTH_MS) / 1000) - RIPPLE_EPOCH;
      const cancelAfter = Math.floor((now + (month + 1) * DEMO_MONTH_MS) / 1000) - RIPPLE_EPOCH;

      const tx = {
        TransactionType: 'EscrowCreate' as const,
        Account: consumerWallet.address,
        Destination: businessWallet.address,
        Amount: {
          currency: RLUSD_CURRENCY,
          issuer: issuerWallet.address,
          value: monthlyAmount,
        },
        FinishAfter: finishAfter,
        CancelAfter: cancelAfter,
      };

      const res = await client.submitAndWait(tx, { wallet: consumerWallet });
      const meta = res.result.meta as any;

      if (meta?.TransactionResult === 'tesSUCCESS') {
        const sequence = (res.result.tx_json as any).Sequence as number;
        escrows.push({ month, sequence, finishAfter, cancelAfter, txHash: res.result.hash });
        evidence.push({ label: `month ${month} XLS-85 Token EscrowCreate`, hash: res.result.hash });
        log('Step 4', `Month ${month} 에스크로 생성 (seq: ${sequence}, tx: ${res.result.hash})`);
      } else {
        fail('Step 4', `Month ${month} 에스크로 실패: ${meta?.TransactionResult}`);
        throw new Error('EscrowCreate failed');
      }
    }

    // 5. Escrow Finish — Month 1 (FinishAfter 대기)
    console.log('\n--- Escrow Finish (Month 1 릴리즈) ---');
    const finishTarget = escrows[0];
    const finishWaitMs = (finishTarget.finishAfter + 946684800) * 1000 - Date.now() + 5000; // +5s buffer
    if (finishWaitMs > 0) {
      await wait(finishWaitMs);
    }

    const finishRes = await client.submitAndWait(
      {
        TransactionType: 'EscrowFinish',
        Account: businessWallet.address,
        Owner: consumerWallet.address,
        OfferSequence: finishTarget.sequence,
      },
      { wallet: businessWallet },
    );
    const finishMeta = finishRes.result.meta as any;
    if (finishMeta?.TransactionResult === 'tesSUCCESS') {
      evidence.push({ label: 'month 1 EscrowFinish', hash: finishRes.result.hash });
      log('Step 5', `Month 1 릴리즈 성공 (tx: ${finishRes.result.hash})`);
    } else {
      fail('Step 5', `Month 1 릴리즈 실패: ${finishMeta?.TransactionResult}`);
      throw new Error('EscrowFinish failed');
    }

    // 6. Escrow Cancel — Month 3 (CancelAfter 대기)
    console.log('\n--- Escrow Cancel (Month 3 취소) ---');
    const cancelTarget = escrows[2]; // month 3
    const cancelWaitMs = (cancelTarget.cancelAfter + 946684800) * 1000 - Date.now() + 5000;
    if (cancelWaitMs > 0) {
      await wait(cancelWaitMs);
    }

    const cancelRes = await client.submitAndWait(
      {
        TransactionType: 'EscrowCancel',
        Account: consumerWallet.address,
        Owner: consumerWallet.address,
        OfferSequence: cancelTarget.sequence,
      },
      { wallet: consumerWallet },
    );
    const cancelMeta = cancelRes.result.meta as any;
    if (cancelMeta?.TransactionResult === 'tesSUCCESS') {
      evidence.push({ label: 'month 3 EscrowCancel', hash: cancelRes.result.hash });
      log('Step 6', `Month 3 취소 성공 (tx: ${cancelRes.result.hash})`);
    } else {
      fail('Step 6', `Month 3 취소 실패: ${cancelMeta?.TransactionResult}`);
      throw new Error('EscrowCancel failed');
    }

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('  검증 완료 — 모든 XRPL 기능 정상 동작');
    console.log('═══════════════════════════════════════════');
    console.log(`  소비자: ${consumerWallet.address}`);
    console.log(`  사업자: ${businessWallet.address}`);
    console.log(`  발행자: ${issuerWallet.address}`);
    console.log(`  에스크로 3개 생성, 1개 릴리즈, 1개 취소`);
    console.log('  검증 증거:');
    for (const item of evidence) {
      console.log(`  - ${item.label}: ${item.hash}`);
    }
    console.log('═══════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n💥 검증 중 오류 발생:', err);
    process.exitCode = 1;
  } finally {
    await client.disconnect();
    console.log('🔌 Testnet 연결 해제');
  }
}

main();
