/**
 * Testnet Bootstrap Script
 *
 * Creates an RLUSD issuer wallet on XRPL Testnet and enables
 * TrustLine Locking (asfAllowTrustLineLocking, flag 17) for XLS-85 Token Escrow.
 *
 * Usage: npx tsx scripts/testnet-bootstrap.ts
 * Output: RLUSD_ISSUER and RLUSD_ISSUER_SEED values to copy into .env
 */

import { Client } from 'xrpl';
import { XrplEscrowClient } from '../packages/xrpl-client/src';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

async function main() {
  const client = new Client(TESTNET_URL);
  console.log('Connecting to XRPL Testnet...');
  await client.connect();

  const escrowClient = new XrplEscrowClient();

  // 1. Create and fund issuer wallet
  console.log('Creating issuer wallet (funding with testnet XRP)...');
  const { wallet: issuerWallet } = await escrowClient.createWallet(client);
  console.log(`Issuer address: ${issuerWallet.address}`);
  console.log(`Issuer seed:    ${issuerWallet.seed}`);

  // 2. Enable TrustLine Locking (flag 17) — required for XLS-85 Token Escrow
  console.log('Enabling TrustLine Locking (asfAllowTrustLineLocking)...');
  const txHash = await escrowClient.enableTokenEscrow(client, issuerWallet);
  console.log(`AccountSet tx: ${txHash}`);

  await client.disconnect();

  console.log('\n========================================');
  console.log('Copy these values into apps/api/.env:');
  console.log('========================================');
  console.log(`RLUSD_ISSUER=${issuerWallet.address}`);
  console.log(`RLUSD_ISSUER_SEED=${issuerWallet.seed}`);
  console.log('========================================');
}

main().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
