# TrustPay (PrepaidShield)

XRPL 기반 선불금 보호 플랫폼 — 소비자의 선불 결제를 RLUSD Token Escrow로 안전하게 보호합니다.

## 문제 정의

헬스장, 학원 등 선불 결제 후 사업자 폐업 시 소비자가 환불받지 못하는 문제를 해결합니다.

## 솔루션

- **RLUSD** 스테이블코인으로 가격 변동 없이 결제
- **XLS-85 Token Escrow**로 월별 분할 예치 — 사업자 폐업 시 자동 환불
- 소비자/사업자 모두 **간편 로그인** (전화번호/이메일) + 서버 관리형 커스터디얼 지갑

## 기술 스택

| 영역 | 기술 |
|---|---|
| Monorepo | pnpm + Turborepo |
| Backend | NestJS 11 + Prisma 6 (SQLite) |
| Mobile | React Native (Expo 52) + React Navigation 7 |
| Blockchain | xrpl.js 4, XRPL Testnet, RLUSD, XLS-85 Token Escrow |
| Validation | Zod |
| State | Zustand 5 + TanStack Query 5 |

## 프로젝트 구조

```
├── apps/
│   ├── api/          # NestJS 백엔드
│   └── mobile/       # React Native (Expo) 모바일 앱
├── packages/
│   ├── shared-types/ # 공유 타입 정의
│   ├── validators/   # Zod 스키마 (API validation)
│   └── xrpl-client/  # XRPL 블록체인 클라이언트
└── docs/             # 프로젝트 문서 (5-Layer)
```

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/auth/login` | 간편 로그인 (전화번호/이메일) |
| POST | `/consumer` | 소비자 등록 |
| POST | `/business` | 사업자 등록 |
| GET | `/business` | 사업자 목록 |
| GET | `/business/:id` | 사업자 상세 |
| POST | `/escrow` | 에스크로 생성 (RLUSD Token Escrow) |
| GET | `/escrow/:id` | 에스크로 상세 |
| POST | `/escrow/:id/finish` | 월별 정산 실행 |
| POST | `/escrow/:id/cancel` | 에스크로 환불 |
| GET | `/escrow/consumer/:id` | 소비자별 에스크로 목록 |
| GET | `/business/:id/dashboard` | 사업자 대시보드 |

## 시작하기

### 사전 요구사항

- Node.js >= 20
- pnpm >= 10

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# Prisma DB 세팅
cd apps/api && npx prisma migrate dev

# API 서버 실행 (루트에서)
pnpm dev:api

# 모바일 앱 실행
pnpm dev:mobile
```

## XRPL 핵심 기능

### Token Escrow (XLS-85)

2026년 2월 활성화된 최신 XRPL 기능으로, RLUSD 같은 토큰을 시간 조건부로 에스크로에 예치할 수 있습니다.

1. 소비자가 600 RLUSD로 6개월 헬스장 이용권 구매
2. 서버가 6개의 Token EscrowCreate 트랜잭션 생성 (100 RLUSD x 6)
3. 각 에스크로에 `FinishAfter`(+N개월), `CancelAfter`(+N+1개월) 설정
4. 매월 사업자가 EscrowFinish로 정산
5. 사업자 폐업 시 소비자가 EscrowCancel로 잔여금 환불

### Trust Line

RLUSD를 주고받기 위해 각 지갑에 issuer에 대한 Trust Line을 자동 설정합니다.

## 라이선스

MIT
