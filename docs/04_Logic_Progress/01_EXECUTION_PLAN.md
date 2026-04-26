# Execution Plan
> Created: 2026-04-26 22:45
> Last Updated: 2026-04-26 22:45

## 1. 실행 원칙

- 원자적 단위(Atomic Task)로 분할: 각 항목은 1~2시간 내 완료 가능
- 각 Phase 완료 시 Git 커밋
- 블로커 발생 시 즉시 기록하고 우회 방안 탐색

## 2. Phase 2 — 핵심 기능 완성 (Day 2~4)

### Step 2.1: Consumer 등록 API
- [ ] `apps/api/src/consumer/` 디렉토리 생성
- [ ] `consumer.module.ts` 생성 (PrismaModule import)
- [ ] `consumer.controller.ts` 생성 (`POST /consumer`, `GET /consumer/:address`)
- [ ] `consumer.service.ts` 생성 (register, findByAddress)
- [ ] `AppModule`에 ConsumerModule import 추가
- [ ] API 테스트 (curl 또는 REST client)
- [ ] Git 커밋

### Step 2.2: Zod 검증 연결
- [ ] `apps/api/src/common/zod-validation.pipe.ts` 생성 (NestJS PipeTransform)
- [ ] EscrowController에 CreateEscrow 스키마 적용
- [ ] EscrowController에 FinishEscrow 스키마 적용
- [ ] BusinessController에 Registration 스키마 적용
- [ ] 잘못된 입력으로 400 에러 반환 확인
- [ ] Git 커밋

### Step 2.3: 모바일 화면 추가
- [ ] 사업자 목록 선택 화면 (`BusinessListScreen.tsx`)
- [ ] ConsumerDashboard에서 "New Payment" 버튼 -> BusinessList -> PaymentScreen 네비게이션 연결
- [ ] EscrowDetailScreen 구현 (월별 entry 상태 표시)
- [ ] EscrowDetailScreen에 환불 버튼 추가 (pending entry가 있을 때만 표시)
- [ ] Git 커밋

## 3. Phase 3 — 모바일 앱 완성 (Day 4~7)

### Step 3.1: 전체 플로우 연결
- [ ] Consumer 로그인 시 자동 등록 로직 추가 (없으면 POST /consumer 호출)
- [ ] Business 로그인 시 사업자 정보 조회 연결
- [ ] 네비게이션 스택 정리 (Consumer/Business 분리)
- [ ] Git 커밋

### Step 3.2: UX 개선
- [ ] 공통 로딩 컴포넌트 추출
- [ ] 공통 에러 화면 추출
- [ ] Alert 대신 inline 피드백 적용 (선택)
- [ ] Demo Mode 토글 (Settings 또는 Login 화면)
- [ ] Git 커밋

## 4. Phase 4 — 통합 테스트 (Day 7~10)

### Step 4.1: 핵심 시나리오 테스트
- [ ] 시나리오 A: Consumer 등록 -> 사업자 선택 -> 에스크로 생성 -> 월별 정산 (전부) -> 완료
- [ ] 시나리오 B: Consumer 등록 -> 에스크로 생성 -> 2개월 정산 -> 나머지 환불 -> 취소
- [ ] 시나리오 C: Demo Mode에서 시간 압축 정상 동작 확인
- [ ] Git 커밋

### Step 4.2: 엣지 케이스 처리
- [ ] 이미 released된 entry에 finish 시도 -> 400 에러 확인
- [ ] 이미 cancelled된 escrow에 cancel 시도 -> 적절한 처리
- [ ] 존재하지 않는 escrow ID 접근 -> 404 에러 확인
- [ ] XRPL Testnet 네트워크 불안정 시 에러 핸들링
- [ ] Git 커밋

## 5. Phase 5 — UI 개선 + 데모 (Day 10~12)

### Step 5.1: 디자인 마무리
- [ ] 색상/타이포그래피 일관성 점검 (UI_DESIGN.md 기준)
- [ ] 카드 그림자/간격 통일
- [ ] 빈 상태 화면 개선
- [ ] Git 커밋

### Step 5.2: 데모 준비
- [ ] 데모 시딩 스크립트 작성 (`scripts/seed.ts`)
- [ ] 데모 시나리오 스크립트 작성 (말하면서 조작할 순서)
- [ ] 3분 내 전체 플로우 시연 리허설
- [ ] 스크린 녹화 (백업용)
- [ ] Git 커밋

## 6. Phase 6 — 최종 점검 (Day 12~14)

### Step 6.1: QA
- [ ] QA Checklist 전 항목 통과 확인
- [ ] Rubric 6개 기준 자체 평가
- [ ] 크리티컬 버그 수정
- [ ] Git 커밋

### Step 6.2: 제출
- [ ] README.md 최종 업데이트 (설치, 실행, 데모 방법)
- [ ] 해커톤 제출 양식 작성
- [ ] 발표자료 (필요 시)
- [ ] 최종 커밋 + 태그

## 7. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 구현 대상
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - DB 모델
- **Logic_Progress**: [Roadmap](./00_ROADMAP.md) - Phase 일정
- **Logic_Progress**: [Backlog](./00_BACKLOG.md) - 전체 작업 목록
- **QA_Validation**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 테스트 케이스
- **QA_Validation**: [QA Checklist](../05_QA_Validation/02_QA_CHECKLIST.md) - 릴리스 기준
