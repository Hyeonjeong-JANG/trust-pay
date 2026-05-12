# TrustPay

XRPL 기반 선불금 보호 플랫폼. 소비자의 선불 결제를 RLUSD Token Escrow로 월별 분할 예치하고, 사업자 폐업 또는 서비스 중단 시 미이용분 환불 흐름을 검증합니다.

## KFIP 2026 제출 요약

TrustPay는 헬스장, 학원, 미용실처럼 선불 결제가 흔한 업종에서 발생하는 폐업 피해를 줄이기 위한 모바일 프로토타입입니다. 소비자는 선불금을 한 번에 사업자에게 넘기지 않고 XRPL의 XLS-85 Token Escrow에 RLUSD로 분할 예치합니다. 사업자는 매월 서비스 제공분만 EscrowFinish로 정산받고, 소비자는 미이용분에 대한 EscrowCancel 환불 흐름을 확인할 수 있습니다.

## 문제

- 선불 이용권 구매 후 사업자가 폐업하면 소비자는 남은 금액을 회수하기 어렵습니다.
- 기존 중재나 소송은 느리고 비용이 크며, 소액 피해에는 실효성이 낮습니다.
- 소비자는 장기 선불 결제를 꺼리고, 성실한 사업자도 신뢰를 증명하기 어렵습니다.

## 솔루션

- **월별 분할 에스크로**: 전체 선불금을 월 단위 RLUSD Token Escrow로 나눠 잠급니다.
- **사업자 정산**: 서비스 제공 기간이 도래하면 사업자가 해당 월 금액만 정산받습니다.
- **소비자 보호**: 서비스 중단 또는 폐업 시 pending 상태의 미이용분 환불 처리 흐름을 시연합니다.
- **간편 UX**: 소비자와 사업자는 전화번호/이메일로 로그인하고, 서버가 데모용 커스토디얼 XRPL 지갑을 관리합니다.

## XRPL 사용 방식

| XRPL 기능 | 사용 목적 |
|:---|:---|
| RLUSD issued currency | 선불금 가치를 스테이블코인 단위로 표현 |
| Trust Line | 소비자/사업자 지갑이 RLUSD를 보유할 수 있도록 설정 |
| XLS-85 Token EscrowCreate | 월별 선불금을 개별 에스크로로 생성 |
| EscrowFinish | 서비스 제공 월이 도래하면 사업자가 정산 |
| EscrowCancel | 미이용분을 소비자에게 환불 |
| XRPL Testnet | 실제 XRPL 흐름 검증과 데모 실험 환경 |

Demo Mode에서는 네트워크 의존 없이 빠르게 전체 UX를 시연하고, Testnet 검증 스크립트에서는 실제 XRPL 트랜잭션 흐름을 확인합니다.

XRPL 통합 상세: [`docs/XRPL-INTEGRATION.md`](docs/XRPL-INTEGRATION.md)

## 데모 플로우

웹 데모: https://xrpl-tawny.vercel.app

수동 로그인용 테스트 계정은 아래와 같습니다. OTP는 `123456`입니다.

- Consumer: `010-2000-0001`
- Business: `010-1000-0002`

1. 소비자 `010-2000-0001`로 로그인합니다.
2. 대시보드에서 진행중, 완료, 환불된 에스크로를 확인합니다.
3. 파워짐 헬스장 에스크로 상세에서 6개월 중 3개월 released, 3개월 pending 상태를 확인합니다.
4. 정상어학원을 선택해 300 RLUSD, 3개월 에스크로를 생성합니다.
5. 사업자 `010-1000-0002`로 로그인해 pending 월 정산을 실행합니다.
6. 소비자 화면에서 pending 엔트리 환불 흐름을 설명합니다.

상세 시나리오: [`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md)

발표 스크립트: [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md)

영상 shotlist: [`docs/DEMO-VIDEO-SHOTLIST.md`](docs/DEMO-VIDEO-SHOTLIST.md)

## 기술 스택

| 영역 | 기술 |
|:---|:---|
| Monorepo | pnpm 10 + Turborepo |
| Backend | NestJS 11 + Prisma 6 + SQLite |
| Mobile | React Native + Expo 52 + React Navigation 7 |
| Blockchain | xrpl.js 4, XRPL Testnet, RLUSD, XLS-85 Token Escrow |
| Validation | Zod |
| State | Zustand 5 + TanStack Query 5 |
| Test | Jest, Supertest, React Native Testing Library |

## 프로젝트 구조

```text
apps/
  api/              NestJS API, Prisma schema, XRPL service
  mobile/           Expo React Native app
packages/
  shared-types/     API and domain types
  validators/       Zod request schemas
  xrpl-client/      XRPL wallet, trust line, token escrow client
docs/               Product, technical, demo, and QA documents
scripts/            Testnet verification and demo support scripts
```

## 로컬 실행

### 요구사항

- Node.js >= 20
- pnpm >= 10

### 설치

```bash
pnpm install
```

### API 환경 파일

```bash
cp apps/api/.env.example apps/api/.env
```

Demo Mode로 실행할 때는 기본값으로 충분합니다. 실제 Testnet 트랜잭션을 검증하려면 `apps/api/.env`에 `DEMO_MODE=false`, `ESCROW_FAST_MODE=true`, `RLUSD_ISSUER`, `RLUSD_ISSUER_SEED`를 설정해야 합니다. seed/private key는 제출 문서나 git tracked 파일에 기록하지 않습니다.

### DB 준비와 시드 데이터 생성

```bash
pnpm demo:reset
```

`demo:reset`은 Prisma SQLite 스키마를 반영하고 canonical 데모 데이터를 다시 생성합니다. 데모 중 데이터가 꼬이면 이 명령을 다시 실행한 뒤 앱을 새로고침합니다.

### API 실행

```bash
pnpm demo:api
```

API 기본 주소: `http://localhost:3000`

### 모바일 앱 실행

```bash
pnpm demo:mobile
```

Expo에서 iOS Simulator, Android Emulator, 또는 Expo Go로 실행합니다.

## 주요 API

| Method | Path | 설명 |
|:---|:---|:---|
| POST | `/auth/request-code` | 전화번호/이메일 OTP 요청 |
| POST | `/auth/verify-code` | OTP 검증 및 서버 서명 세션 토큰 발급 |
| POST | `/consumer` | 소비자 등록 |
| POST | `/business` | 사업자 등록 |
| GET | `/business` | 사업자 목록 |
| GET | `/business/:id` | 사업자 상세 |
| GET | `/business/:id/dashboard` | 사업자 대시보드 |
| POST | `/escrow` | RLUSD Token Escrow 생성 |
| GET | `/escrow/:id` | 에스크로 상세 |
| POST | `/escrow/:id/finish` | 월별 정산 실행 |
| POST | `/escrow/:id/cancel` | pending 엔트리 환불 |
| GET | `/escrow/consumer/:id` | 소비자별 에스크로 목록 |

보호 API는 `Authorization: Bearer <token>` 세션 토큰을 사용합니다. Demo Mode에서는 심사용 OTP `123456`을 사용합니다.

## 검증 명령

```bash
pnpm build
pnpm turbo run test
pnpm --filter api test:e2e
pnpm --filter mobile exec tsc --noEmit
pnpm --filter mobile exec jest --runInBand
pnpm exec tsx --test scripts/testnet-cli.spec.ts
```

2026-05-12 제출 전 확인 결과:

| 검증 | 결과 |
|:---|:---:|
| Monorepo build | Pass |
| API unit tests | 46 passed |
| Mobile tests | 55 passed |
| API E2E tests | 41 passed |
| Mobile typecheck | Pass |
| Mobile Jest clean exit | Pass |
| Testnet CLI help tests | 2 passed |

## 주요 문서

- XRPL 통합 가이드: [`docs/XRPL-INTEGRATION.md`](docs/XRPL-INTEGRATION.md)
- XRPL Testnet 증빙: [`docs/XRPL-TESTNET-EVIDENCE.md`](docs/XRPL-TESTNET-EVIDENCE.md)
- 데모 시나리오: [`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md)
- 데모 발표 스크립트: [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md)
- 데모 영상 shotlist: [`docs/DEMO-VIDEO-SHOTLIST.md`](docs/DEMO-VIDEO-SHOTLIST.md)
- 제품 비전: [`docs/01_Concept_Design/01_VISION_CORE.md`](docs/01_Concept_Design/01_VISION_CORE.md)
- 제품 명세: [`docs/01_Concept_Design/03_PRODUCT_SPECS.md`](docs/01_Concept_Design/03_PRODUCT_SPECS.md)
- 기술 아키텍처: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 보안 참고

- `apps/api/.env`는 git에 포함하지 않습니다.
- XRPL seed/private key는 제출 문서, README, 데모 영상 설명란에 기록하지 않습니다.
- API 응답은 `xrplSecret`을 반환하지 않도록 테스트로 검증합니다.
- 현재 커스토디얼 지갑 구조는 MVP 데모용입니다. 프로덕션 전환 시 HSM/MPC 또는 비커스토디얼 지갑 구조가 필요합니다.

## 라이선스

MIT
