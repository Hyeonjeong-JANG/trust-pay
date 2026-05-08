# XRPL Integration Guide

> TrustPay가 일반 결제 앱이 아니라 XRPL의 issued currency와 XLS-85 Token Escrow를 핵심 흐름으로 사용하는 이유와 검증 방법을 정리한 문서입니다. seed/private key는 이 문서와 git tracked 파일에 기록하지 않습니다.

## 한 줄 답변

TrustPay는 소비자의 선불금을 RLUSD issued currency로 표현하고, 월별 금액을 XLS-85 Token Escrow에 각각 잠근 뒤, 도래한 월차만 `EscrowFinish`로 사업자에게 정산하고 미이용 월차는 `EscrowCancel`로 환불하는 흐름을 구현합니다.

## Demo Mode와 Testnet Mode

| 모드 | 목적 | 네트워크 사용 | 증거 |
|:---|:---|:---:|:---|
| Demo Mode | 데모 영상에서 전체 UX를 빠르게 시연 | 없음 | `DEMO_ESCROW_*`, `DEMO_FINISH_*`, `DEMO_CANCEL_*` 형식의 synthetic tx hash |
| Testnet Mode | 실제 XRPL 트랜잭션 흐름 검증 | XRPL Testnet | Testnet address, AccountSet/TrustSet/Payment/Escrow tx hash |

Demo Mode는 심사위원에게 제품 흐름을 보여주기 위한 안정적인 로컬 모드입니다. Testnet Mode는 “XRPL을 어디에 썼는가?”를 증명하기 위한 검증 모드이며, 실행 시간이 길고 Testnet 상태에 영향을 받습니다.

## XRPL Ledger Flow

### 1. RLUSD 발행자 준비

Token Escrow로 issued currency를 잠그려면 발행자 계정에서 TrustLine Locking을 허용해야 합니다.

| XRPL transaction | 핵심 필드 | TrustPay 의미 |
|:---|:---|:---|
| `AccountSet` | `SetFlag: 17` | `asfAllowTrustLineLocking` 활성화 |

코드 경로:

- `packages/xrpl-client/src/escrow-client.ts`의 `enableTokenEscrow`
- `scripts/testnet-bootstrap.ts`
- `scripts/verify-xrpl-testnet.ts`

### 2. 소비자/사업자 Trust Line 설정

소비자와 사업자 지갑은 RLUSD issued currency를 보유하거나 받을 수 있도록 Trust Line을 설정합니다.

| XRPL transaction | 핵심 필드 | TrustPay 의미 |
|:---|:---|:---|
| `TrustSet` | `LimitAmount.currency`, `LimitAmount.issuer`, `LimitAmount.value` | 소비자/사업자 RLUSD 수취 준비 |

코드 경로:

- `packages/xrpl-client/src/escrow-client.ts`의 `setTrustLine`
- `apps/api/src/xrpl/xrpl.service.ts`의 `setTrustLine`
- `apps/api/src/auth/auth.service.ts`: 신규 소비자 로그인 시 지갑과 Trust Line 준비
- `apps/api/src/business/business.service.ts`: 사업자 등록 시 지갑과 Trust Line 준비

### 3. 소비자 RLUSD 지급

Testnet Mode에서는 발행자 지갑이 소비자 지갑으로 데모용 RLUSD를 지급합니다. 이 값은 실제 제출 문서에 seed 없이 address와 tx hash만 기록해야 합니다.

| XRPL transaction | 핵심 필드 | TrustPay 의미 |
|:---|:---|:---|
| `Payment` | `Account`, `Destination`, `Amount` | 소비자가 에스크로 생성에 사용할 RLUSD 확보 |

코드 경로:

- `apps/api/src/xrpl/xrpl.service.ts`의 `issueRLUSD`
- `scripts/verify-xrpl-testnet.ts`

### 4. 월별 Token Escrow 생성

예를 들어 600 RLUSD, 6개월 이용권은 100 RLUSD씩 6개의 Token Escrow로 생성됩니다. 각 월차는 독립적인 `EscrowCreate` transaction이고, DB에는 `sequence`, `finishAfter`, `cancelAfter`, `txHash`가 저장됩니다.

| XRPL transaction | 핵심 필드 | TrustPay 의미 |
|:---|:---|:---|
| `EscrowCreate` | `Account` | 소비자 지갑 |
| `EscrowCreate` | `Destination` | 사업자 지갑 |
| `EscrowCreate` | `Amount` | RLUSD issued currency amount |
| `EscrowCreate` | `FinishAfter` | 해당 월차가 정산 가능해지는 Ripple time |
| `EscrowCreate` | `CancelAfter` | 미이용분 환불 가능 기준 시간 |

코드 경로:

- `packages/xrpl-client/src/escrow-client.ts`의 `createMonthlyEscrows`
- `apps/api/src/xrpl/xrpl.service.ts`의 `createMonthlyEscrows`
- `apps/api/src/escrow/escrow.service.ts`의 `create`
- `apps/mobile/src/screens/consumer/PaymentScreen.tsx`: 월별 분할 에스크로 설명

### 5. 사업자 월별 정산

서비스 제공 월이 도래하면 사업자가 `EscrowFinish`를 제출합니다. 이때 `Owner`는 소비자 지갑이고 `OfferSequence`는 월별 `EscrowCreate`의 sequence입니다.

| XRPL transaction | 핵심 필드 | TrustPay 의미 |
|:---|:---|:---|
| `EscrowFinish` | `Account` | 사업자 지갑 |
| `EscrowFinish` | `Owner` | 소비자 지갑 |
| `EscrowFinish` | `OfferSequence` | 정산할 월차의 EscrowCreate sequence |

코드 경로:

- `packages/xrpl-client/src/escrow-client.ts`의 `finishEscrow`
- `apps/api/src/xrpl/xrpl.service.ts`의 `finishEscrow`
- `apps/api/src/escrow/escrow.service.ts`의 `finishEntry`
- `apps/mobile/src/screens/business/BusinessDashboardScreen.tsx`: `EscrowFinish` 정산 액션

### 6. 미이용 월차 환불

서비스 중단 또는 폐업 시 pending 월차는 `EscrowCancel`로 소비자에게 환불되는 흐름을 검증합니다. Demo Mode에서는 빠른 시연을 위해 synthetic hash를 사용하고, Testnet Mode에서는 실제 `EscrowCancel` tx hash를 확인합니다.

| XRPL transaction | 핵심 필드 | TrustPay 의미 |
|:---|:---|:---|
| `EscrowCancel` | `Account` | 취소를 제출하는 소비자 지갑 |
| `EscrowCancel` | `Owner` | 원래 EscrowCreate를 만든 소비자 지갑 |
| `EscrowCancel` | `OfferSequence` | 환불할 월차의 EscrowCreate sequence |

코드 경로:

- `packages/xrpl-client/src/escrow-client.ts`의 `cancelEscrow`
- `apps/api/src/xrpl/xrpl.service.ts`의 `cancelEscrow`
- `apps/api/src/escrow/escrow.service.ts`의 `cancelEscrow`
- `apps/mobile/src/screens/consumer/EscrowDetailScreen.tsx`: released, pending, refunded 상태와 tx hash 표시

## Testnet 검증 방법

### 직접 XRPL 검증

네트워크와 API 없이 XRPL Testnet transaction만 검증합니다.

```bash
pnpm exec tsx scripts/verify-xrpl-testnet.ts --help
pnpm exec tsx scripts/verify-xrpl-testnet.ts
```

예상 증거:

- Testnet websocket 연결 성공
- 소비자, 사업자, 발행자 Testnet address 출력
- `AccountSet`, `TrustSet`, `Payment`, `EscrowCreate`, `EscrowFinish`, `EscrowCancel` tx hash 출력
- seed/private key는 출력하지 않음

### API 통합 E2E 검증

앱/API 경로를 통해 실제 Testnet 흐름을 검증합니다. 실행 전 `scripts/testnet-bootstrap.ts`로 발행자 address와 seed를 만들고, seed는 `apps/api/.env`에만 둡니다.

```bash
pnpm exec tsx scripts/testnet-e2e-flow.ts --help
API_URL=http://localhost:3000 pnpm exec tsx scripts/testnet-e2e-flow.ts
```

필수 환경:

```bash
DEMO_MODE=false
ESCROW_FAST_MODE=true
RLUSD_ISSUER=<testnet issuer address>
RLUSD_ISSUER_SEED=<local .env only>
```

예상 증거:

- 사업자 등록 시 XRPL address 생성
- 소비자 로그인 시 XRPL address 생성과 RLUSD 지급
- 3개월 에스크로 생성 시 entry 3개 생성
- 1월차 `EscrowFinish` tx hash 반환
- 최종 상태가 `cancelled`, 1월차 `released`, 2~3월차 `refunded`

## 제출용 XRPL 주소 정책

- 구글폼에는 Testnet 검증에 사용한 address만 제출합니다.
- seed/private key는 구글폼, README, 영상 설명란, 문서, git tracked 파일에 기록하지 않습니다.
- `apps/api/.env`는 git tracked 파일이 아니어야 합니다.
- 제출 전 확인 명령:

```bash
git ls-files --error-unmatch apps/api/.env
```

이 명령은 실패해야 정상입니다.

## 심사 질문 대응

| 질문 | 답변 |
|:---|:---|
| XRPL을 어디에 썼나요? | RLUSD Trust Line, issued currency Payment, XLS-85 Token EscrowCreate, EscrowFinish, EscrowCancel에 사용했습니다. |
| 왜 스마트컨트랙트가 아니라 Token Escrow인가요? | 선불금 보호의 핵심은 월별 시간 조건 잠금과 조건 도래 후 정산/환불이므로 XRPL의 원장 내장 Escrow primitive가 목적에 직접 맞습니다. |
| 데모 tx hash는 실제인가요? | Demo Mode hash는 synthetic입니다. 실제 XRPL 증거는 Testnet Mode 스크립트가 출력하는 tx hash로 확인합니다. |
| RLUSD는 어떻게 다루나요? | Testnet에서는 발행자 Trust Line Locking, 소비자/사업자 TrustSet, 발행자 Payment 후 Token Escrow Amount에 RLUSD issued currency를 사용합니다. |
