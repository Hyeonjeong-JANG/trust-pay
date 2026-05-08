# KFIP 1차 제출 QA

> Created: 2026-05-04
> Scope: 2026-05-13 1차 제출 전 GitHub repo, 데모, XRPL 증거, 보안 노출 상태를 확인하는 체크리스트

## 1. 제출 전 필수 검증

| 항목 | 명령 | 통과 기준 |
|:---|:---|:---|
| Monorepo build | `pnpm build` | 5개 package build 성공 |
| Unit tests | `pnpm turbo run test` | API/Mobile 테스트 실패 없음 |
| API E2E | `pnpm --filter api test:e2e` | 31개 이상 E2E 통과 |
| Mobile typecheck | `pnpm --filter mobile exec tsc --noEmit` | TypeScript error 없음 |
| Mobile Jest 종료 | `pnpm --filter mobile exec jest --runInBand` | `--forceExit` 없이 종료 |
| Testnet script help | `pnpm exec tsx --test scripts/testnet-cli.spec.ts` | help 출력이 네트워크 없이 통과 |
| Secret tracking | `git ls-files --error-unmatch apps/api/.env` | 실패해야 정상 |
| Worktree status | `git status --short --branch` | 의도한 변경만 존재 |

## 2. Secret/Wallet Safety

- [ ] `apps/api/.env`는 git tracked 파일이 아니다.
- [ ] `RLUSD_ISSUER_SEED`는 `apps/api/.env`에만 둔다.
- [ ] README, 제출 문서, 데모 영상 설명란에는 seed/private key를 기록하지 않는다.
- [ ] API 응답에는 `xrplSecret`이 포함되지 않는다.
- [ ] `ENCRYPTION_KEY`는 Demo/Test 외 환경에서 명시적으로 설정한다.
- [ ] `.env.*` 파일은 ignore되고, `.env.example`만 tracked 상태를 유지한다.

## 3. Demo Readiness

- [ ] `pnpm demo:reset`으로 canonical seed를 재생성한다.
- [ ] `pnpm demo:api`로 API를 실행한다.
- [ ] `pnpm demo:mobile`로 Expo 앱을 실행한다.
- [ ] 소비자 `010-1234-5678` 로그인 확인.
- [ ] 사업자 `02-1234-5678` 로그인 확인.
- [ ] 활성 에스크로 상세에서 released/pending 상태와 tx hash 표시 확인.
- [ ] 사업자 대시보드에서 `EscrowFinish` 정산 액션 확인.
- [ ] 환불 시나리오 설명에 pending 월차 보호가 포함된다.

## 4. XRPL Evidence Readiness

- [ ] `docs/XRPL-INTEGRATION.md`가 README에서 링크된다.
- [ ] `scripts/verify-xrpl-testnet.ts --help`가 직접 XRPL 검증 흐름을 설명한다.
- [ ] `scripts/testnet-e2e-flow.ts --help`가 API-backed Testnet 검증 준비 절차를 설명한다.
- [ ] Testnet 검증 결과로 제출할 값은 address와 tx hash뿐이다.
- [ ] Demo Mode synthetic hash와 Testnet tx hash 차이를 영상/문서에서 구분한다.

## 5. 제출 자료 상태

- [ ] `docs/KFIP-SUBMISSION.md`의 GitHub repo 링크가 최신이다.
- [ ] `docs/KFIP-SUBMISSION.md`의 XRPL 지갑 주소는 Testnet address만 포함한다.
- [ ] 프로토타입/영상 링크는 시크릿 브라우저에서 접근 가능하다.
- [ ] `docs/DEMO-SCENARIO.md`와 실제 seed 데이터가 일치한다.
- [ ] `docs/DEMO-SCRIPT.md`가 3~5분 영상 흐름에 맞는다.
