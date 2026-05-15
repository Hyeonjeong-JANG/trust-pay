# TrustPay 데모 영상 Shotlist

## 목표

- 30초 안에 선불 결제 피해 문제를 설명합니다.
- 2분 안에 소비자 보호 상태와 XRPL 증빙 UI를 보여줍니다.
- 4분 안에 사업자 QR 생성과 소비자 계좌 승인 보호 결제를 완료합니다.
- 마지막에 RLUSD, Trust Line, XLS-85 Token EscrowCreate/Finish/Cancel을 명확히 말합니다.

## 녹화 전 준비

기본은 배포 웹 데모입니다.

```text
https://xrpl-tawny.vercel.app
Consumer: 010-2000-0001 / OTP: 123456
Business: 010-1000-0002 / OTP: 123456
PIN: 123456
```

로컬 fallback:

```bash
pnpm demo:reset
pnpm demo:api
pnpm demo:mobile
```

Expo Web 포트가 `8081`이 아니면 API의 `CORS_ORIGIN`을 해당 포트로 맞춥니다.

## Shot-by-Shot

| Shot | 화면 | 조작 | 확인할 증거 |
|:---|:---|:---|:---|
| 1 | 온보딩 | 건너뛰기 전 핵심 문구 노출 | 선불금 보호/XRPL 설명 |
| 2 | Consumer Login | `010-2000-0001`, OTP `123456` | 김민수 홈 진입 |
| 3 | Consumer Home | `전체` 필터 선택 | 진행중, 완료, 취소/환불 상태 카드 |
| 4 | Escrow Detail | 파워짐 카드 상세 | released/pending 월별 상태, tx hash 증빙 |
| 5 | Logout | 프로필 아래로 스크롤 후 로그아웃 | 로그인 화면 복귀 |
| 6 | Business Login | `010-1000-0002`, OTP `123456` | 파워짐 대시보드, 과거 알림 모달 없음 |
| 7 | QR Create | 결제 금액 `810000`, 기간 `6`, QR 생성 | 실제 QR, `TP-...` 코드, SCAN/TRUSTPAY 라벨 |
| 8 | Consumer QR Entry | 소비자로 재로그인 후 `QR 스캔 결제` | `TP-...` 코드 입력 화면 |
| 9 | Payment Approval | 코드 불러오기, PIN `123456` 승인 | 원화 금액, 월별 정산액, 승인 완료 |
| 10 | Consumer Home | 홈으로 복귀 | 새 파워짐 보호 결제 반영 |
| 11 | Refund Protection | 기존 환불/취소 카드 설명 | released 유지, pending 환불 보호 메시지 |
| 12 | Wrap-up | 홈 또는 상세 화면 | XRPL 키워드 5개 요약 |

## 다시 찍어야 하는 경우

- QR 생성 화면이 장난감 배지처럼 보이고 실제 QR 패턴이 보이지 않습니다.
- 사업자 로그인 직후 과거 알림 모달이 연속으로 떠서 흐름이 끊깁니다.
- Demo Mode mock tx hash를 실제 Testnet tx라고 말했습니다.
- 원화보다 RLUSD를 먼저 설명해 일반 사용자 가치가 흐려졌습니다.
- 5분을 넘겼습니다.
- seed/private key나 `.env`가 화면에 보였습니다.

## 제출 링크 메모

```text
웹 데모: https://xrpl-tawny.vercel.app
데모 영상: [입력 필요]
보조 설명: Demo Mode에서는 모바일 UX 전체 흐름을 안정적으로 시연하고, 실제 XRPL Testnet 트랜잭션 검증은 docs/XRPL-INTEGRATION.md 및 scripts/verify-xrpl-testnet.ts에서 확인할 수 있습니다.
```
