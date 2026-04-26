# Backlog
> Created: 2026-04-26 22:45
> Last Updated: 2026-04-26 22:45

## Done

- [x] 모노레포 초기화 (pnpm workspace + Turborepo)
- [x] NestJS API 스캐폴딩 (AppModule, PrismaModule, XrplModule)
- [x] Prisma 스키마 정의 (Business, Consumer, Escrow, EscrowEntry)
- [x] SQLite DB 초기화 (prisma:push)
- [x] XRPL Testnet 연결 (xrpl-client 패키지)
- [x] XrplEscrowClient 구현 (createMonthlyEscrows, finishEscrow, cancelEscrow)
- [x] shared-types 패키지 (타입 정의)
- [x] validators 패키지 (Zod 스키마)
- [x] EscrowController/Service 구현 (CRUD + XRPL 연동)
- [x] BusinessController/Service 구현 (등록, 조회, 대시보드)
- [x] React Native (Expo) 앱 스캐폴딩
- [x] LoginScreen (역할 선택 + 주소 입력)
- [x] ConsumerDashboardScreen (에스크로 목록)
- [x] PaymentScreen (에스크로 생성)
- [x] BusinessDashboardScreen (정산 대시보드)
- [x] Zustand 인증 스토어
- [x] TanStack Query API 클라이언트
- [x] Git 초기 커밋
- [x] Layer 1~3 문서 작성
- [x] Layer 4~5 문서 작성
- [x] 문서 커밋

## In Progress

## ToDo — P0 (MVP 필수)

- [ ] Consumer 등록 API 구현 (`POST /consumer`)
- [ ] Zod 검증 파이프라인을 NestJS 컨트롤러에 연결
- [ ] 모바일: 사업자 목록 선택 화면 추가
- [ ] 모바일: Consumer 등록 플로우 추가 (로그인 시 자동 등록 또는 별도 화면)
- [ ] 모바일: EscrowDetail 화면 (월별 상태 표시 + 환불 버튼)
- [ ] 모바일: Consumer 환불 요청 UI (cancelEscrow 호출)
- [ ] E2E 플로우 테스트: 생성 -> 정산 -> 완료
- [ ] E2E 플로우 테스트: 생성 -> 폐업 환불
- [ ] Demo Mode 시연 확인 (3분 내 전체 플로우)

## ToDo — P1 (완성도 향상)

- [ ] API 에러 응답 표준화 (일관된 에러 포맷)
- [ ] 사업자별 에스크로 목록 API (`GET /business/:id/escrows`)
- [ ] 모바일: 로딩 스피너 컴포넌트 통일
- [ ] 모바일: 에러 상태 화면 개선
- [ ] 모바일: Demo Mode 토글 UI
- [ ] 데모 데이터 시딩 스크립트 (seed.ts)

## ToDo — P2 (Post-MVP)

- [ ] XRPL 지갑 서명 기반 인증
- [ ] JWT/세션 기반 API 인증
- [ ] Push 알림 (정산 가능, 환불 완료)
- [ ] 반응형 웹 버전
- [ ] ESLint + Prettier 설정
- [ ] 단위 테스트 작성 (Jest/Vitest)
- [ ] 사업자 폐업 자동 감지 (공공데이터 API 연동)
- [ ] 수수료 징수 로직

## Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - MVP 기능 정의
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - 미구현 API 목록
- **Logic_Progress**: [Roadmap](./00_ROADMAP.md) - Phase별 일정
- **Logic_Progress**: [Execution Plan](./01_EXECUTION_PLAN.md) - 실행 계획
