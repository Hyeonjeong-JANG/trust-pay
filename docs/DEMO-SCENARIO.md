# TrustPay 제출용 데모 시나리오

## 기준

- 기본 녹화/제출 링크: `https://xrpl-tawny.vercel.app`
- 비상용 로컬 실행: `pnpm demo:reset`, `pnpm demo:api`, `pnpm demo:mobile`
- OTP/PIN: `123456`
- Consumer: `010-2000-0001` 김민수
- Business: `010-1000-0002` 파워짐 피트니스

로컬 Expo Web 포트가 `8081`이 아니면 API를 `CORS_ORIGIN=http://localhost:<port> DEMO_MODE=true DATABASE_URL="file:./dev.db" pnpm --filter api dev`로 실행합니다.

## 핵심 메시지

TrustPay는 헬스장, 학원, 미용실처럼 장기 선불 결제가 흔한 업종에서 소비자의 미이용분을 보호합니다. 결제는 원화 UX로 설명하고, RLUSD는 XRPL 보호 원장의 보조 단위로 표시합니다. QR 생성은 비용이 들지 않고, 실제 비용이 발생하는 지점은 XRPL 트랜잭션 제출입니다.

## Canonical Flow

1. 온보딩에서 선불금 보호 문제와 XRPL Token Escrow 해결책을 짧게 보여줍니다.
2. Consumer `010-2000-0001`로 로그인합니다.
3. 홈에서 `전체` 필터를 눌러 진행중, 완료, 취소/환불 상태를 한 화면에서 보여줍니다.
4. 파워짐 피트니스 상세에서 월별 released/pending 상태와 XRPL 증빙 UI를 보여줍니다.
5. 프로필에서 로그아웃합니다. 웹에서는 프로필 화면을 아래로 스크롤하면 로그아웃 버튼이 보입니다.
6. Business `010-1000-0002`로 로그인합니다.
7. `새 보호 결제 만들기` 또는 하단 `결제` 탭에서 월정액 QR을 생성합니다. 예시는 결제 금액 `810000`, 기간 `6`개월입니다.
8. 생성된 실제 QR과 `TP-...` 코드를 보여줍니다. QR은 `trustpay://payment-request?code=...` 형태의 결제 요청 payload를 인코딩합니다.
9. 사업자 프로필에서 로그아웃합니다.
10. Consumer `010-2000-0001`로 다시 로그인합니다.
11. `QR 스캔 결제`에서 방금 생성된 `TP-...` 코드를 입력합니다.
12. 보호 결제 화면에서 원화 결제 금액, 월별 정산액, RLUSD 보조 단위를 확인합니다.
13. `계좌 승인 결제 요청`을 누르고 PIN `123456`으로 승인합니다.
14. 소비자 홈에 새 파워짐 피트니스 보호 결제가 추가되는지 확인합니다.
15. 환불 보호는 기존 헤어살롱 루나/환불 검토 상태로 설명합니다. 이미 이용한 금액은 유지되고 미이용 pending 금액만 환불 대상으로 분리됩니다.

## 제출 전 성공 기준

- 배포 URL에서 소비자 로그인, 사업자 로그인, 로그아웃이 모두 동작합니다.
- 사업자 로그인 직후 과거 seed 알림 모달이 흐름을 막지 않습니다.
- QR 생성 후 실제 QR 모양과 `TP-...` 코드가 함께 보입니다.
- 소비자가 QR 코드를 입력해 보호 결제를 완료할 수 있습니다.
- 완료 후 새 보호 결제가 홈에 반영됩니다.
- Demo Mode mock tx hash를 실제 Testnet tx라고 말하지 않습니다.
- 마지막 설명에 RLUSD, Trust Line, XLS-85 Token EscrowCreate/Finish/Cancel이 포함됩니다.
