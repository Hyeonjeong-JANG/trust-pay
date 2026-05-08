# KFIP 2026 1차 제출 개선 계획
> Created: 2026-05-04
> Scope: 2026-05-13 1차 서류 제출 전까지 제출 신뢰도, 제품 완성도, XRPL 기술 어필을 동시에 끌어올리는 계획

## 1. 문서 배치 결정

이 계획은 `docs/04_Logic_Progress/02_KFIP_1ST_SUBMISSION_PLAN.md`에 둔다.

선택 이유:
- `docs/04_Logic_Progress/`는 이미 Roadmap, Backlog, Execution Plan을 보관하는 프로젝트 실행 레이어다.
- 기존 `00_ROADMAP.md`는 6월 25일 데모데이까지의 장기 로드맵이고, 이 문서는 5월 13일 1차 서류 제출 전용 단기 보강 계획이다.
- 루트 `README.md`는 심사위원용 소개와 실행 방법만 담아야 하므로, 상세 실행 계획을 넣기에는 과하다.
- `docs/superpowers/plans/`는 에이전트 작업용 보조 문서 성격이 강하고 현재 untracked 상태라, 프로젝트 공식 제출 준비 문서 위치로 쓰지 않는다.

## 2. 현재 기준선

2026-05-04 기준 확인된 상태:

| 항목 | 상태 | 근거 |
|:---|:---:|:---|
| Monorepo build | Pass | `pnpm build` 성공, 5개 패키지 빌드 통과 |
| Unit tests | Pass | `pnpm turbo run test` 성공, API 33개 + Mobile 50개 통과 |
| API E2E tests | Pass | `pnpm --filter api test:e2e` 성공, 31개 통과 |
| Mobile typecheck | Pass | `pnpm --filter mobile exec tsc --noEmit` 성공 |
| GitHub 최신성 | Risk | `main`이 `origin/main`보다 7 commits ahead |
| 제출 문서 | Risk | 데모 문서 간 실행 명령, 로그인 정보, 시나리오가 일부 불일치 |
| 프로토타입 링크 | Missing | repo 내 공개 데모/영상 링크 없음 |
| XRPL 어필 문서 | Partial | 코드와 스크립트는 있으나 심사용 통합 설명 문서가 없음 |

## 3. 1차 제출 항목 매핑

| 구글폼 항목 | 제출 자료 | 관리 위치 | 담당 Phase |
|:---|:---|:---|:---|
| 프로젝트 소개 | 1분 소개문, 문제/솔루션/차별점 | `README.md`, `docs/KFIP-SUBMISSION.md` | Phase 1 |
| Github Repository 링크 | 최신 코드 push된 public 또는 private repo | GitHub remote, `README.md` | Phase 5 |
| XRPL 지갑 주소 | Testnet 기준 제출용 주소 | `docs/KFIP-SUBMISSION.md`에 address만 기록, seed는 기록 금지 | Phase 4 |
| 프로토타입 링크 | 3~5분 데모 영상 또는 Expo/웹 데모 링크 | `docs/KFIP-SUBMISSION.md` | Phase 6 |

## 4. Phase 계획

### Phase 1: 제출 문서 패키지 정리

목표: 심사위원이 GitHub를 열었을 때 3분 안에 문제, 솔루션, 실행 방법, XRPL 사용 이유를 이해하게 만든다.

수정/생성 파일:
- Modify: `README.md`
- Modify: `docs/DEMO-SCENARIO.md`
- Modify: `docs/DEMO-SCRIPT.md`
- Create: `docs/KFIP-SUBMISSION.md`

작업 내용:
- `README.md`를 제출용 구조로 재정리한다: 한 줄 소개, 문제, 솔루션, 핵심 XRPL 기능, 데모 실행, 테스트 결과, 문서 링크.
- `docs/DEMO-SCENARIO.md`를 canonical 데모 플로우로 지정한다.
- `docs/DEMO-SCRIPT.md`의 글자 깨짐을 제거하고 한국어 발표 스크립트로 재작성한다.
- `docs/KFIP-SUBMISSION.md`에 구글폼 답변 초안을 보관한다.

검증 기준:
- README만 읽어도 프로젝트 목적과 XRPL 사용 이유가 명확하다.
- 데모 문서의 명령어, 전화번호, 사업자명, 금액이 실제 seed/app과 일치한다.
- `docs/DEMO-SCRIPT.md`에 깨진 문자가 없다.

검증 명령:
- `pnpm build`
- `pnpm turbo run test`

### Phase 2: 데모 플로우 안정화

목표: 로컬에서 3~5분 내 소비자 결제, 사업자 정산, 소비자 환불 흐름을 안정적으로 시연한다.

수정/생성 파일:
- Modify: `apps/api/prisma/seed.ts`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `docs/DEMO-SCENARIO.md`
- Optional Create: `scripts/demo-reset.ts`

작업 내용:
- 데모 seed의 소비자, 사업자, 에스크로 데이터를 데모 문서와 완전히 일치시킨다.
- 루트에서 실행 가능한 데모 명령을 추가한다: DB reset, seed, API 실행, 모바일 실행.
- 데모 실패 시 빠르게 원상 복구할 수 있는 reset 절차를 문서화한다.
- Demo Mode와 Testnet Mode를 혼동하지 않도록 데모 문서에서 명확히 분리한다.

검증 기준:
- fresh DB에서 seed 후 앱에 문서와 동일한 소비자/사업자/에스크로가 표시된다.
- 소비자 로그인, 에스크로 생성, 사업자 릴리즈, 소비자 환불이 끊기지 않는다.
- 서버 미실행, 네트워크 오류, API 오류가 앱에서 이해 가능한 메시지로 표시된다.

검증 명령:
- `pnpm --filter api exec prisma db push`
- `pnpm --filter api seed`
- `pnpm --filter api test:e2e`
- `pnpm turbo run test`

### Phase 3: 제품 UX 완성도 보강

목표: 데모 영상에서 앱이 프로토타입이지만 신뢰 가능한 제품처럼 보이게 만든다.

수정/생성 파일:
- Modify: `apps/mobile/src/screens/LoginScreen.tsx`
- Modify: `apps/mobile/src/screens/OnboardingScreen.tsx`
- Modify: `apps/mobile/src/screens/consumer/DashboardScreen.tsx`
- Modify: `apps/mobile/src/screens/consumer/BusinessSelectScreen.tsx`
- Modify: `apps/mobile/src/screens/consumer/PaymentScreen.tsx`
- Modify: `apps/mobile/src/screens/consumer/EscrowDetailScreen.tsx`
- Modify: `apps/mobile/src/screens/business/BusinessDashboardScreen.tsx`
- Modify: `apps/mobile/src/components/ErrorView.tsx`
- Modify: `apps/mobile/src/components/NetworkBanner.tsx`

작업 내용:
- 온보딩에서 문제 제기, RLUSD, XLS-85 Token Escrow, 소비자 보호를 더 직접적으로 보여준다.
- 결제 화면에서 월별 분할 에스크로 구조를 더 명확히 설명한다.
- 상세 화면에서 released, pending, refunded 상태와 tx hash를 심사위원이 바로 이해할 수 있게 정리한다.
- 사업자 대시보드에서 수령액, 미정산액, 릴리즈 액션을 데모 중심으로 정리한다.
- 실패/로딩/빈 상태를 데모 중 당황하지 않게 보완한다.

검증 기준:
- 3~5분 영상에서 앱 흐름만 봐도 문제와 해결 방식이 이해된다.
- 모든 주요 화면이 모바일 화면 녹화에 적합한 밀도와 가독성을 가진다.
- 네트워크/API 오류가 generic crash처럼 보이지 않는다.

검증 명령:
- `pnpm --filter mobile exec tsc --noEmit`
- `pnpm --filter mobile test`

### Phase 4: XRPL 기술 어필 강화

목표: 이 프로젝트가 일반 결제앱이 아니라 XRPL 기능을 핵심으로 쓰는 프로젝트임을 증명한다.

수정/생성 파일:
- Create: `docs/XRPL-INTEGRATION.md`
- Modify: `README.md`
- Modify: `scripts/verify-xrpl-testnet.ts`
- Modify: `scripts/testnet-e2e-flow.ts`
- Modify: `packages/xrpl-client/src/escrow-client.ts`
- Modify: `apps/api/src/xrpl/xrpl.service.ts`

작업 내용:
- `docs/XRPL-INTEGRATION.md`에 RLUSD, Trust Line, XLS-85 Token EscrowCreate, EscrowFinish, EscrowCancel 흐름을 정리한다.
- Demo Mode와 Testnet Mode의 차이를 명확히 설명한다.
- Testnet에서 실제 검증할 수 있는 스크립트 사용법과 예상 결과를 문서화한다.
- 제출용 XRPL 지갑 주소는 address만 기록하고 seed/private key는 어디에도 기록하지 않는다.

검증 기준:
- 심사위원 질문인 “XRPL을 어디에 썼나요?”에 문서와 코드 경로로 바로 답할 수 있다.
- `scripts/verify-xrpl-testnet.ts`가 실제 Testnet 검증 절차를 설명하고 실행 가능하다.
- 비밀값이 git tracked 파일에 포함되지 않는다.

검증 명령:
- `pnpm build`
- `pnpm --filter api test:e2e`
- `git status --short`
- `git ls-files --error-unmatch apps/api/.env`는 실패해야 정상이다.

### Phase 5: 보안, 테스트, 저장소 제출 상태 하드닝

목표: GitHub repo 제출 시 신뢰를 깎는 요소를 제거한다.

수정/생성 파일:
- Modify: `.gitignore`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/src/common/crypto.service.ts`
- Modify: `apps/api/test/demo-mode.e2e-spec.ts`
- Modify: `apps/api/test/app.e2e-spec.ts`
- Modify: `apps/mobile/src/components/Skeleton.spec.tsx`
- Modify: `docs/05_QA_Validation/02_QA_CHECKLIST.md`
- Optional Create: `docs/05_QA_Validation/03_SUBMISSION_QA.md`

작업 내용:
- secret, seed, private key가 tracked 파일에 없는지 재검사한다.
- API 응답에서 `xrplSecret`이 노출되지 않는 테스트를 유지/보강한다.
- 모바일 테스트의 animation timer 경고가 데모 안정성에 영향이 있는지 확인하고 필요한 범위만 수정한다.
- 1차 제출 전용 QA 체크리스트를 추가하거나 기존 QA 체크리스트를 업데이트한다.
- 최신 코드가 GitHub remote에 올라갈 준비가 되었는지 확인한다.

검증 기준:
- build, unit test, e2e test, mobile typecheck가 모두 통과한다.
- `.env`는 tracked 파일이 아니다.
- GitHub에 올릴 변경만 남고 로컬 작업 파일은 제외된다.

검증 명령:
- `pnpm build`
- `pnpm turbo run test`
- `pnpm --filter api test:e2e`
- `pnpm --filter mobile exec tsc --noEmit`
- `git status --short --branch`

### Phase 6: 프로토타입 링크와 제출 자산 제작

목표: 구글폼에 바로 붙여넣을 수 있는 최종 제출 자료를 완성한다.

수정/생성 파일:
- Modify: `docs/KFIP-SUBMISSION.md`
- Modify: `docs/DEMO-SCENARIO.md`
- Modify: `docs/DEMO-SCRIPT.md`
- Optional Create: `docs/DEMO-VIDEO-SHOTLIST.md`

작업 내용:
- 3~5분 데모 영상 구성을 확정한다.
- 영상에는 문제 제기, 소비자 플로우, 사업자 플로우, XRPL Token Escrow 설명, 환불 보호를 포함한다.
- 구글폼 제출용 프로젝트 소개문을 최종화한다.
- GitHub repo 링크, XRPL 지갑 주소, 프로토타입/영상 링크를 `docs/KFIP-SUBMISSION.md`에 모은다.

검증 기준:
- 구글폼 네 항목을 모두 채울 수 있다.
- 영상 링크가 외부에서 접근 가능하다.
- 제출용 주소에는 seed/private key가 포함되지 않는다.

검증 명령:
- 링크를 private/incognito 브라우저에서 열어 접근 가능성을 확인한다.
- `git status --short --branch`로 제출 직전 변경 상태를 확인한다.

### Phase 7: 최종 리허설과 제출 전 동결

목표: 제출 직전 재현성과 repo 신뢰도를 최종 확인한다.

수정/생성 파일:
- Modify: `docs/KFIP-SUBMISSION.md`
- Modify: `README.md`

작업 내용:
- fresh clone 기준 설치, 빌드, 테스트, 데모 실행 절차를 점검한다.
- README의 모든 명령어가 현재 repo에서 동작하는지 확인한다.
- 제출 링크와 지갑 주소를 최종 확인한다.
- push 후 GitHub에서 README와 문서 렌더링을 확인한다.

검증 기준:
- GitHub 링크만 받은 사람이 프로젝트를 이해하고 실행할 수 있다.
- 제출 자료 네 항목이 모두 준비되어 있다.
- 제출 직전 `main`과 `origin/main`의 차이가 의도된 상태다.

검증 명령:
- `pnpm install`
- `pnpm build`
- `pnpm turbo run test`
- `pnpm --filter api test:e2e`
- `pnpm --filter mobile exec tsc --noEmit`
- `git status --short --branch`

## 5. 권장 실행 순서

| 순서 | Phase | 이유 |
|:---:|:---|:---|
| 1 | Phase 1 | 제출물의 첫인상과 심사용 메시지를 먼저 고정한다. |
| 2 | Phase 2 | 문서와 실제 데모 데이터/명령어 불일치를 제거한다. |
| 3 | Phase 4 | XRPL 차별성을 문서와 코드 경로로 증명한다. |
| 4 | Phase 3 | 화면 녹화 전에 제품 UX를 보강한다. |
| 5 | Phase 5 | 제출 repo의 보안/테스트 신뢰도를 확보한다. |
| 6 | Phase 6 | 최종 영상과 구글폼 답변을 만든다. |
| 7 | Phase 7 | fresh clone 리허설 후 제출 전 상태를 동결한다. |

## 6. 완료 정의

이 계획은 다음 조건을 만족하면 완료로 본다.

- `README.md`가 심사위원용 제출 README로 정리되어 있다.
- `docs/KFIP-SUBMISSION.md`에 구글폼 네 항목의 최종 제출값이 모여 있다.
- `docs/DEMO-SCENARIO.md`와 `docs/DEMO-SCRIPT.md`가 실제 앱/seed 데이터와 일치한다.
- `docs/XRPL-INTEGRATION.md`가 XRPL 사용 방식과 검증 방법을 설명한다.
- build, unit test, API E2E, mobile typecheck가 모두 통과한다.
- GitHub remote에 최신 코드가 올라가 있다.
- 프로토타입 또는 데모 영상 링크가 외부 접근 가능하다.
- XRPL 제출 주소는 address만 공유되고 seed/private key는 공유되지 않는다.
