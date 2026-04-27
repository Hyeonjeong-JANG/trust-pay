# PrepaidShield Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (Expo 52)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Login   │ │Dashboard │ │ Payment  │ │ EscrowDetail │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
│       └─────────────┴────────────┴──────────────┘           │
│              TanStack Query  +  Zustand                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API (JSON)
┌─────────────────────────┴───────────────────────────────────┐
│                   NestJS 11 Backend                          │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │  Auth  │ │ Consumer │ │ Business │ │    Escrow      │   │
│  │Service │ │ Service  │ │ Service  │ │   Service      │   │
│  └───┬────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘   │
│      └───────────┴────────────┴───────────────┘             │
│       ┌──────────────┐         ┌──────────────┐             │
│       │ PrismaService│         │  XrplService │             │
│       │  (SQLite)    │         │  (xrpl.js 4) │             │
│       └──────┬───────┘         └──────┬───────┘             │
└──────────────┼────────────────────────┼─────────────────────┘
               │                        │
        ┌──────┴──────┐         ┌───────┴──────┐
        │  SQLite DB  │         │  XRPL Ledger │
        │  (Prisma 6) │         │  (Testnet)   │
        └─────────────┘         └──────────────┘
```

## Token Escrow Flow (XLS-85)

```
소비자(Consumer)                    XRPL Ledger                   사업자(Business)
     │                                  │                              │
     │  1. 선불 결제 요청               │                              │
     │  (150,000 RLUSD / 3개월)         │                              │
     │─────────────────────────────────>│                              │
     │                                  │                              │
     │  2. EscrowCreate × 3             │                              │
     │  (50,000 RLUSD × 3 months)       │                              │
     │─────────────────────────────────>│                              │
     │                                  │  3. Month 1 FinishAfter 도래 │
     │                                  │  ──────────────────────────> │
     │                                  │                              │
     │                                  │  4. EscrowFinish (릴리즈)    │
     │                                  │ <────────────────────────────│
     │                                  │                              │
     │                                  │  5. 50,000 RLUSD 수령 ✓     │
     │                                  │  ──────────────────────────> │
     │                                  │                              │
     │  6. 폐업/서비스 중단 시          │                              │
     │  EscrowCancel (CancelAfter 이후) │                              │
     │─────────────────────────────────>│                              │
     │                                  │                              │
     │  7. 미릴리즈 RLUSD 환불 ✓       │                              │
     │ <─────────────────────────────── │                              │
```

## Why XLS-85 Token Escrow?

### 기존 선불 결제의 문제
| 문제 | 현재 방식 | PrepaidShield |
|------|-----------|---------------|
| 폐업 리스크 | 소비자 전액 손실 | **자동 환불** (CancelAfter) |
| 자금 투명성 | 사업자 계좌에 묶임 | **XRPL 온체인 확인** |
| 환불 절차 | 법적 분쟁 필요 | **스마트 에스크로 자동 실행** |
| 가치 변동 | 없음 (원화) | **RLUSD 스테이블코인** (1:1 USD) |

### XLS-85가 핵심인 이유
1. **Token Escrow** = XRPL의 최신 기능 (2026.02.12 활성화)
2. 기존 XRP Escrow는 XRP만 가능 → **XLS-85는 발행 토큰(RLUSD) 에스크로 지원**
3. 시간 기반 조건 (`FinishAfter` / `CancelAfter`)으로 **중재자 없이 자동 실행**
4. 온체인 투명성 → 누구나 에스크로 상태 조회 가능

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Mobile | React Native (Expo 52) | Cross-platform consumer/business app |
| State | Zustand 5 + TanStack Query 5 | Auth state + server cache |
| Backend | NestJS 11 | REST API with Zod validation |
| Database | Prisma 6 + SQLite | Local-first, zero-config DB |
| Blockchain | xrpl.js 4 | Token Escrow (XLS-85) + Trust Lines |
| Stablecoin | RLUSD | USD-pegged, no volatility risk |
| Validation | Zod | Shared schemas (backend + mobile) |
| Monorepo | pnpm + Turborepo | Shared packages, parallel builds |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | 소비자 자동등록 / 사업자 로그인 |
| POST | `/business` | 사업자 등록 (지갑 자동 생성) |
| GET | `/business` | 활성 사업자 목록 |
| GET | `/business/:id/dashboard` | 사업자 대시보드 (수령/대기 집계) |
| POST | `/escrow` | Token Escrow 생성 (월별 분할) |
| GET | `/escrow/:id` | 에스크로 상세 (엔트리 포함) |
| POST | `/escrow/:id/finish` | 월별 릴리즈 (사업자 청구) |
| POST | `/escrow/:id/cancel` | 에스크로 취소 (소비자 환불) |
| GET | `/escrow/consumer/:id` | 소비자별 에스크로 목록 |

## Test Coverage

| Category | Tests | Description |
|----------|-------|-------------|
| Unit (Backend) | 29 | AuthService, EscrowService, BusinessService |
| E2E (Backend) | 18 | Full API flow with Supertest |
| Unit (Mobile) | 17 | LoginScreen, DashboardScreen |
| **Total** | **64** | |
