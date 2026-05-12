# XRPL Testnet Evidence

> Created: 2026-05-12
> Scope: KFIP 2026 submission proof for TrustPay XRPL usage.
> Secret policy: This file contains only public Testnet addresses and transaction hashes. No seed/private key is recorded.

## Verification Command

```bash
pnpm exec tsx scripts/verify-xrpl-testnet.ts
```

## Testnet Addresses

| Role | Address | Explorer |
|:---|:---|:---|
| Consumer | `r3mmH7k7tsShoMBxhyvjWxmJtKnbqrEYK6` | https://testnet.xrpl.org/accounts/r3mmH7k7tsShoMBxhyvjWxmJtKnbqrEYK6 |
| Business | `rwX7on8RojAX9uV3KqqENTWdmJKDwJe3aw` | https://testnet.xrpl.org/accounts/rwX7on8RojAX9uV3KqqENTWdmJKDwJe3aw |
| RLUSD Issuer | `rNabsmcozdd6jAjDQdBjTdGNomgxH3dySP` | https://testnet.xrpl.org/accounts/rNabsmcozdd6jAjDQdBjTdGNomgxH3dySP |

## Transaction Evidence

| Step | Transaction | Hash |
|:---|:---|:---|
| Enable token escrow issuer setting | AccountSet asfAllowTrustLineLocking | `2FBBC9153536C7AAD79E87ACC69BCFA4E217FFC79652879BEA8ABE8AB0E3A851` |
| Consumer RLUSD receiving setup | TrustSet | `D14C7FB925C1BD66A2E82ADBD209DA67D5DCAE514CAA8C5A56F4A3E2AB4775BB` |
| Business RLUSD receiving setup | TrustSet | `D2053A5B6E34729C77CC1B3D06A064E9DF9B4B6DC2CEC590C5DB843C2D4F5B76` |
| Fund consumer with demo RLUSD | Payment | `580EC194417491A9CF6769566BE1B282FB0E6AA47DC0D338420A736BE9900ABB` |
| Month 1 prepaid protection | XLS-85 Token EscrowCreate | `118BCECB78E9E578DBF9B7F35AD71D71870C0155B6D14012E19EEFEEC6A234AF` |
| Month 2 prepaid protection | XLS-85 Token EscrowCreate | `42F1C2E964885B5AB229787BC0B2F075E14120461F27F1DFA7FF84602496892E` |
| Month 3 prepaid protection | XLS-85 Token EscrowCreate | `C0A9D0F5226EC03C0B482D3BAC67F04FAFB3919FD112F6A787529ABD5AEC6846` |
| Month 1 business settlement | EscrowFinish | `7BFE416D1901B96EC00C83DFFE0EB26F90F2FA9D9609A594B89DFCF6B754A454` |
| Month 3 unused-month refund | EscrowCancel | `CB7D5578C618DC70B05FF36EE803267F3834C856F08CB2E55AE3B3A58B2929B8` |

## Submission Summary

The verification run proves the TrustPay ledger flow on XRPL Testnet:

1. A Testnet RLUSD issuer enables TrustLine Locking for XLS-85 Token Escrow.
2. Consumer and business wallets establish RLUSD Trust Lines.
3. The issuer sends demo RLUSD to the consumer wallet.
4. The consumer creates three monthly issued-currency Token Escrows.
5. The business finishes one matured escrow for monthly settlement.
6. The consumer cancels one unused-month escrow for refund protection.
