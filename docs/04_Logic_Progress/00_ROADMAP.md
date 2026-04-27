# Roadmap
> Created: 2026-04-26 22:45
> Last Updated: 2026-04-27

## 1. 전체 일정

**프로그램**: KFIP 2026 (Korea Fintech Innovation Program)
**기간**: 3개월 (2026-04-26 ~ 2026-06-25 데모데이)
**핵심 변경**: XRP → RLUSD + Token Escrow(XLS-85), XRPL 주소 로그인 → 전화번호/이메일 인증

| Phase | 기간 | 목표 | 상태 |
|:---|:---|:---|:---:|
| Phase 0 | Week 1 | 프로젝트 초기화 + 스캐폴딩 | Done |
| Phase 1 | Week 1 | 문서 체계 완성 | Done |
| Phase 1.5 | Week 1 | 설계 피벗 (RLUSD + 인증 방식 변경) | Done |
| Phase 2 | Week 2~3 | 핵심 기능 완성 (RLUSD Escrow, Auth, Consumer API) | Todo |
| Phase 3 | Week 3~4 | 모바일 앱 완성 (전체 플로우 동작) | Todo |
| Phase 4 | Week 5~6 | 통합 테스트 + 버그 수정 | Todo |
| Phase 5 | Week 7~8 | UI 개선 + 데모 준비 | Todo |
| Phase 6 | Week 8~9 | 최종 점검 + 데모데이 제출 (6/25) | Todo |

## 2. Phase 상세

### Phase 0 — 프로젝트 초기화 (Done)
- [x] 모노레포 구조 설정 (pnpm + Turborepo)
- [x] NestJS API 스캐폴딩
- [x] React Native (Expo) 앱 스캐폴딩
- [x] shared-types 패키지 생성
- [x] validators 패키지 생성
- [x] xrpl-client 패키지 생성
- [x] Prisma 스키마 + SQLite 초기화
- [x] XRPL Testnet 연결 구현
- [x] Git 초기 커밋

### Phase 1 — 문서 체계 완성 (Done)
- [x] Layer 1: Concept_Design (Vision, Lean Canvas, Product Specs)
- [x] Layer 2: UI_Screens (Screen Flow, UI Design)
- [x] Layer 3: Technical_Specs (Dev Principles, DB Schema, API Specs)
- [x] Layer 4: Logic_Progress (Roadmap, Backlog, Execution Plan)
- [x] Layer 5: QA_Validation (Test Scenarios, QA Checklist)
- [x] 문서 커밋
- **기술 명세 링크**: [Development Principles](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md)

### Phase 1.5 — 설계 피벗 (Done)
- [x] XRP → RLUSD 스테이블코인으로 결제 토큰 변경
- [x] Token Escrow(XLS-85) 활용으로 아키텍처 변경
- [x] XRPL 주소 로그인 → 전화번호/이메일 인증 + 커스토디얼 지갑
- [x] 2주 해커톤 → 3개월 KFIP 프로그램 타임라인 변경
- [x] 전체 문서 업데이트

### Phase 2 — 핵심 기능 완성
- [ ] 인증 API (`POST /auth/login`) 구현
- [ ] Consumer 등록 API (`POST /consumer`) 구현 — 지갑 자동 생성 + Trust Line
- [ ] Business 등록 API 수정 — 지갑 자동 생성 + Trust Line
- [ ] Escrow API 수정 — RLUSD Token Escrow(XLS-85)로 전환
- [ ] Validators 패키지를 API 컨트롤러에 연결 (NestJS Pipe)
- [ ] DB 스키마 마이그레이션 (phone/email/xrplSecret/currency/issuer 추가)
- [ ] 모바일: 로그인 화면 변경 (전화번호/이메일)
- [ ] 모바일: 사업자 목록 선택 화면 구현
- [ ] 모바일: EscrowDetail 화면 구현
- **기술 명세 링크**: [API Specs](../03_Technical_Specs/02_API_SPECS.md)

### Phase 3 — 모바일 앱 완성
- [ ] 전체 사용자 플로우 연결 (로그인 -> 결제 -> 대시보드 -> 정산/환불)
- [ ] 로딩/에러 상태 개선
- [ ] 네비게이션 가드 정리
- [ ] Demo Mode 토글 UI 추가
- **기술 명세 링크**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md)

### Phase 4 — 통합 테스트 + 버그 수정
- [ ] E2E 시나리오 테스트: 에스크로 생성 -> 월별 정산 -> 완료
- [ ] E2E 시나리오 테스트: 에스크로 생성 -> 폐업 환불
- [ ] XRPL Testnet 트랜잭션 안정성 테스트
- [ ] 엣지 케이스 처리 (중복 Finish, 이미 취소된 에스크로 등)
- **기술 명세 링크**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md)

### Phase 5 — UI 개선 + 데모 준비
- [ ] 디자인 다듬기 (카드 그림자, 색상 일관성)
- [ ] 데모 스크립트 작성
- [ ] 데모 데이터 시딩 스크립트
- [ ] Demo Mode에서 3분 내 전체 플로우 시연 가능 확인

### Phase 6 — 최종 점검 + 데모데이 제출 (6/25)
- [ ] QA Checklist 통과
- [ ] README 최종 업데이트
- [ ] KFIP 제출물 준비 (GitHub, 프로토타입, 데모 영상, 발표자료)
- [ ] XRPL 지갑 주소 제출 (Testnet)

## 3. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - MVP 기능 정의
- **Logic_Progress**: [Backlog](./00_BACKLOG.md) - 세부 작업 목록
- **Logic_Progress**: [Execution Plan](./01_EXECUTION_PLAN.md) - 실행 계획
- **QA_Validation**: [QA Checklist](../05_QA_Validation/02_QA_CHECKLIST.md) - 릴리스 기준
