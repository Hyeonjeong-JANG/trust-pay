# TrustPay KFIP Demo Scenario (3min)

## Setup
```bash
cd apps/api
DATABASE_URL="file:./dev.db" npx prisma db push
DATABASE_URL="file:./dev.db" npm run seed
DATABASE_URL="file:./dev.db" npm run dev
# (separate terminal)
cd apps/mobile && npm start
```

## Demo Flow (3 minutes)

### Act 1: Problem Statement (30s)
- Open the app -> Onboarding slides
- Slide 1: "Shield logo" — consumer protection
- Slide 2: XRPL Token Escrow (XLS-85) technology
- Slide 3: RLUSD stablecoin — no volatility
- Slide 4: Tap "Start" -> Login screen

### Act 2: Consumer Journey (1m 30s)
1. **Login as Consumer**
   - Phone: `010-2000-0001`, Role: consumer
   - Show: auto-wallet creation + RLUSD trust line

2. **Dashboard Overview**
   - RLUSD balance card
   - 3 escrow cards (active/completed/cancelled)
   - Point out: real-time balance from XRPL Testnet

3. **Escrow Detail** (tap active escrow — Power Gym Fitness)
   - 6 monthly entries: 3 released, 3 pending
   - Progress bar showing 50%
   - Each entry has Ripple time, amount, TX hash
   - "This is XLS-85 Token Escrow on XRPL"

4. **Create New Escrow**
   - Tap "+" -> Select business -> Jungsan Academy
   - Enter 300 RLUSD, 3 months
   - Show monthly breakdown: 100 RLUSD/month
   - Submit -> TX hash confirmation
   - "Each monthly payment locked in separate escrow on-chain"

5. **Schedule Tab**
   - Timeline view of upcoming releases
   - "Consumer can see exactly when each payment releases"

### Act 3: Business Journey (1m)
1. **Switch to Business**
   - Logout -> Login as business
   - Phone: `010-1000-0002` (Power Gym Fitness)

2. **Business Dashboard**
   - Total received / pending amounts
   - Active escrow list with consumer names
   - Tap "Release" on pending entry (Month 4)
   - Show TX hash -> funds received

3. **Key Differentiators** (wrap-up)
   - "XLS-85 Token Escrow — latest XRPL feature (activated Feb 2026)"
   - "RLUSD stablecoin — no crypto volatility for consumers"
   - "Monthly release protects both parties"
   - "If business closes, remaining escrows can be refunded"

## Seed Data Summary

| Entity | ID | Details |
|--------|-----|---------|
| Consumer | 김민수 | 010-2000-0001 |
| Consumer | 이서연 | 010-2000-0002 |
| Business | 강남 블루보틀 | 010-1000-0001, Cafe |
| Business | 파워짐 피트니스 | 010-1000-0002, Gym |
| Business | 헤어살롱 루나 | 010-1000-0003, Salon |
| Business | 크린토피아 역삼점 | 010-1000-0004, Laundry |
| Business | 정상어학원 | 010-1000-0005, Academy |
| Escrow (active) | 김민수 → 파워짐 피트니스 | 600 RLUSD, 6mo, 3 released |
| Escrow (completed) | 김민수 → 강남 블루보틀 | 450 RLUSD, 3mo, all released |
| Escrow (cancelled) | 김민수 → 헤어살롱 루나 | 400 RLUSD, 4mo, 1 released + 3 refunded |

## Key Talking Points for Judges
- **"How did you use digital assets?"** → RLUSD stablecoin for consumer prepayment protection
- **"How did you use XRP Ledger?"** → XLS-85 Token Escrow (latest feature, activated 2026-02-12) + Trust Lines
- **Technical depth**: Each monthly payment = separate on-chain escrow with finishAfter/cancelAfter conditions
- **Real-world problem**: Korean prepaid service market — gym/academy closures leaving consumers with no recourse
