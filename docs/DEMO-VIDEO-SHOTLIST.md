# TrustPay Demo Video Shotlist

> Purpose: KFIP 2026 1차 제출용 3~5분 데모 영상을 빠르게 녹화하기 위한 화면 순서, 대사 포인트, 제출 전 체크리스트입니다.

## 1. 영상 목표

- 30초 안에 선불 결제 피해 문제를 설명합니다.
- 2분 안에 소비자가 미이용분 보호 상태를 확인하는 장면을 보여줍니다.
- 4분 안에 사업자 정산과 환불 보호 흐름을 모두 보여줍니다.
- 마지막에는 XRPL을 어디에 썼는지 `RLUSD`, `Trust Line`, `XLS-85 Token Escrow`, `EscrowFinish`, `EscrowCancel` 키워드로 정리합니다.

## 2. 녹화 전 준비

```bash
pnpm demo:reset
pnpm demo:api
pnpm demo:mobile
```

녹화 전 확인:

- 앱이 Consumer 로그인 화면까지 정상 진입합니다.
- API 서버가 `localhost:3000`에서 실행 중입니다.
- 화면에는 `.env`, seed/private key, 터미널 secret 값이 보이지 않습니다.
- 알림, 메신저, 브라우저 개인정보 노출 화면을 닫습니다.
- Demo Mode의 mock tx hash는 실제 Testnet tx hash라고 말하지 않습니다.

## 3. 권장 타임라인

| 시간 | 화면 | 핵심 메시지 |
|:---|:---|:---|
| 0:00-0:25 | 온보딩 | 선불 결제 후 폐업 시 미이용분 환불이 어렵다는 문제 제기 |
| 0:25-0:45 | 온보딩/XRPL 설명 | TrustPay는 RLUSD 선불금을 월별 Token Escrow로 나눠 잠급니다. |
| 0:45-1:30 | 소비자 로그인/대시보드 | 소비자는 active, completed, cancelled 에스크로 상태를 한눈에 확인합니다. |
| 1:30-2:15 | 에스크로 상세 | 600 RLUSD가 6개월로 분할되고 3개월 released, 3개월 pending 상태임을 보여줍니다. |
| 2:15-3:00 | 새 에스크로 생성 | 300 RLUSD, 3개월 결제가 월별 100 RLUSD 에스크로로 나뉘는 구조를 보여줍니다. |
| 3:00-3:40 | 사업자 대시보드 | 사업자는 서비스 제공 월에 대해서만 `EscrowFinish` 정산을 실행합니다. |
| 3:40-4:15 | 환불 보호 | 폐업/중단 시 released 월은 유지하고 pending 월만 환불 대상으로 분리합니다. |
| 4:15-4:45 | XRPL 요약 | RLUSD, Trust Line, XLS-85 Token EscrowCreate/Finish/Cancel을 사용했다고 정리합니다. |

## 4. Shot-by-Shot Guide

| Shot | 화면 | 조작 | 말할 포인트 | 확인할 증거 |
|:---|:---|:---|:---|:---|
| 1 | 온보딩 첫 화면 | 앱 시작 | 헬스장/학원 선불 결제 피해 문제 | 문제 문구가 화면에 보임 |
| 2 | 온보딩 XRPL 설명 | 다음 화면 이동 | 전액 선지급 대신 RLUSD를 월별 Token Escrow에 예치 | RLUSD, Token Escrow 문구 |
| 3 | LoginScreen | Consumer 선택, `010-1234-5678` 입력 | 소비자 김민수로 로그인 | Consumer 역할과 전화번호 |
| 4 | Consumer Dashboard | active 카드 확인 | 내 선불금의 released/pending/refunded 상태 확인 | active/completed/cancelled 카드 |
| 5 | Escrow Detail | 파워짐 active 상세 열기 | 600 RLUSD, 6개월, 3 released + 3 pending | 월별 상태와 tx hash |
| 6 | Payment Flow | 브라이트 영어학원 선택, `300`, `3` 입력 | 하나의 결제가 3개 월별 escrow로 분할 | 월별 100 RLUSD 설명 |
| 7 | Business Login | 로그아웃 후 Business `02-1234-5678` 로그인 | 사업자는 제공한 월만 정산 | 사업자 역할과 파워짐 계정 |
| 8 | Business Dashboard | Release 버튼 또는 정산 영역 표시 | `EscrowFinish`가 사업자 월별 정산에 대응 | 수령액, 미정산액, Release |
| 9 | Refund Scenario | cancelled escrow 상태 표시 | 미이용 pending 월은 `EscrowCancel` 환불 대상으로 분리 | refunded/released 상태 |
| 10 | 마무리 화면 | 대시보드 또는 문서 화면 | XRPL Testnet 검증 스크립트와 문서가 별도로 있음 | `docs/XRPL-INTEGRATION.md` 언급 |

## 5. 대사 압축본

```text
TrustPay는 헬스장, 학원처럼 선불 결제가 많은 업종에서 사업자 폐업 시 소비자가 미이용분을 돌려받기 어려운 문제를 해결하는 XRPL 기반 프로토타입입니다.

소비자의 선불금은 RLUSD로 표현되고, XRPL의 XLS-85 Token Escrow에 월별로 분할 예치됩니다. 사업자는 서비스를 제공한 월에 대해서만 EscrowFinish로 정산받고, 아직 이용하지 않은 pending 월은 소비자 보호 상태로 남습니다.

이 데모에서는 소비자 김민수가 600 RLUSD, 6개월 이용권 중 3개월은 released, 3개월은 pending 상태로 보호되는 것을 확인합니다. 새 결제 생성 시에도 300 RLUSD, 3개월 결제가 월별 100 RLUSD 에스크로로 나뉩니다.

사업자 화면에서는 파워짐 헬스장이 제공한 월에 대해서만 정산받는 흐름을 보여줍니다. 만약 서비스가 중단되면 이미 이용한 released 월은 유지하고, 미이용 pending 월만 EscrowCancel 환불 대상으로 분리할 수 있습니다.

TrustPay의 핵심 XRPL 사용 지점은 RLUSD, Trust Line, XLS-85 Token EscrowCreate, EscrowFinish, EscrowCancel입니다. Demo Mode는 제품 UX 시연용이고, Testnet 검증 스크립트는 실제 XRPL 트랜잭션 흐름 확인용으로 분리했습니다.
```

## 6. 다시 찍어야 하는 경우

- seed/private key나 `.env` 값이 화면에 보였습니다.
- Demo Mode mock hash를 실제 Testnet tx라고 말했습니다.
- 소비자와 사업자 전화번호를 잘못 입력했습니다.
- 5분을 넘겼습니다.
- 환불 보호가 “전액 자동 보장”처럼 들리게 설명했습니다.
- XRPL 키워드가 마지막 요약에 빠졌습니다.

## 7. 업로드와 제출 링크 확인

권장 업로드 방식:

- YouTube 일부공개
- Loom 공개 링크
- Google Drive 링크 공유: 링크가 있는 모든 사용자 보기 가능

제출 전 확인:

- 시크릿 브라우저에서 영상 링크가 열립니다.
- 모바일에서도 영상이 재생됩니다.
- 영상 제목과 설명란에 seed/private key가 없습니다.
- 설명란에는 GitHub repo와 `docs/XRPL-INTEGRATION.md` 링크만 포함합니다.

## 8. 구글폼에 붙일 프로토타입 링크 메모

```text
[입력 필요] 3~5분 데모 영상 링크
보조 설명: Demo Mode에서는 모바일 UX 전체 흐름을 시연하고, XRPL Testnet 트랜잭션 검증은 repository의 docs/XRPL-INTEGRATION.md 및 scripts/verify-xrpl-testnet.ts에서 확인할 수 있습니다.
```
