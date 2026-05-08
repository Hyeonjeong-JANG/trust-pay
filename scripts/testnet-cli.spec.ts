import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function runHelp(script: string): string {
  return execFileSync('pnpm', ['exec', 'tsx', script, '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 2_000,
  });
}

describe('Testnet verification script help', () => {
  it('explains direct XRPL proof steps without exposing secrets', () => {
    const output = runHelp('scripts/verify-xrpl-testnet.ts');

    assert.match(output, /XLS-85 Token EscrowCreate/);
    assert.match(output, /EscrowFinish/);
    assert.match(output, /EscrowCancel/);
    assert.match(output, /seed\/private key는 출력하지 않습니다/);
  });

  it('explains API-backed Testnet E2E prerequisites', () => {
    const output = runHelp('scripts/testnet-e2e-flow.ts');

    assert.match(output, /DEMO_MODE=false/);
    assert.match(output, /AUTH_DEMO_OTP=true/);
    assert.match(output, /ESCROW_FAST_MODE=true/);
    assert.match(output, /API_URL/);
    assert.match(output, /EscrowFinish/);
  });
});
