# PrepaidShield - XRPL Prepaid Escrow Protection

KFIP 2026 Hackathon project: Protect prepaid payments (gym memberships, etc.) using XRPL Escrow.

Consumers deposit prepaid funds into XRPL Escrow, which releases monthly to the business.
If the business closes, remaining funds are automatically refunded.

## Architecture

```
apps/
  api/       - NestJS backend (REST API + XRPL integration)
  mobile/    - React Native (Expo) consumer & business app

packages/
  shared-types/  - TypeScript type definitions
  xrpl-client/   - XRPL connection & escrow operations
  validators/    - Zod schemas (shared frontend/backend validation)
```

## Getting Started

```bash
pnpm install
pnpm --filter api prisma:push    # Create SQLite DB
pnpm dev:api                     # Start API on :3000
pnpm dev:mobile                  # Start Expo dev server
```

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Backend**: NestJS + Prisma (SQLite → PostgreSQL)
- **Mobile**: React Native (Expo) + React Navigation + TanStack Query + Zustand
- **Blockchain**: XRPL Testnet (xrpl.js v4)

## XRPL Escrow Flow

1. Consumer pays 600 XRP for 6-month gym membership
2. Server creates 6 EscrowCreate transactions (100 XRP each)
3. Each escrow has FinishAfter (+N months) and CancelAfter (+N+1 months)
4. Business calls EscrowFinish monthly to claim payment
5. On business closure, consumer calls EscrowCancel for remaining funds
