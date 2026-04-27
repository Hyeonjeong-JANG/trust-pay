# Execution Plan
> Created: 2026-04-26 22:45
> Last Updated: 2026-04-27

## 1. 실행 원칙

- 원자적 단위(Atomic Task)로 분할: 각 항목은 1~2시간 내 완료 가능
- 각 Phase 완료 시 Git 커밋
- 블로커 발생 시 즉시 기록하고 우회 방안 탐색
- **프로그램**: KFIP 2026, **데모데이**: 2026-06-25

## 2. Phase 2 — 핵심 기능 완성 (Week 2~3)

### Step 2.0: DB 스키마 + XRPL 기반 수정
- [ ] Prisma 스키마 수정 (phone/email/xrplSecret/currency/issuer 필드 추가)
- [ ] `prisma db push` 실행
- [ ] xrpl-client: Token Escrow(XLS-85) 지원으로 수정 (RLUSD amount 전달)
- [ ] xrpl-client: Trust Line 설정 함수 추가 (`setTrustLine`)
- [ ] xrpl-client: 커스토디얼 지갑 생성 함수 추가 (`createWallet`)
- [ ] shared-types 업데이트 (RLUSD 관련 타입 추가)
- [ ] validators 업데이트 (XRPL 주소 직접입력 제거, phone/email 검증 추가)
- [ ] Git 커밋

### Step 2.1: Auth + Consumer API
- [ ] `apps/api/src/auth/` 디렉토리 생성
- [ ] `auth.module.ts`, `auth.controller.ts`, `auth.service.ts` 생성
- [ ] `POST /auth/login` 구현 (phone/email → 사용자 조회 또는 자동 등록)
- [ ] `apps/api/src/consumer/` 디렉토리 생성
- [ ] `consumer.module.ts`, `consumer.controller.ts`, `consumer.service.ts` 생성
- [ ] `POST /consumer` 구현 (지갑 자동 생성 + Trust Line 설정)
- [ ] `AppModule`에 AuthModule, ConsumerModule import 추가
- [ ] API 테스트 (curl 또는 REST client)
- [ ] Git 커밋

### Step 2.2: Business + Escrow API 수정
- [ ] BusinessService 수정: 등록 시 XRPL 지갑 자동 생성 + Trust Line
- [ ] EscrowService 수정: consumerId/businessId 기반으로 주소 조회
- [ ] EscrowService 수정: RLUSD Token EscrowCreate 트랜잭션 생성
- [ ] EscrowService 수정: RLUSD Token EscrowFinish/Cancel 트랜잭션
- [ ] Zod 검증 파이프라인 (`zod-validation.pipe.ts`) 생성 + 적용
- [ ] Git 커밋

### Step 2.3: 모바일 화면 수정/추가
- [ ] LoginScreen 수정 (전화번호/이메일 입력, XRPL 주소 제거)
- [ ] Zustand 스토어 수정 (userId 기반, xrplAddress 불필요)
- [ ] BusinessListScreen 구현 (사업자 선택)
- [ ] PaymentScreen 수정 (RLUSD 단위 표시)
- [ ] EscrowDetailScreen 구현 (월별 entry 상태 + 환불 버튼)
- [ ] 네비게이션 연결 (Dashboard → BusinessList → Payment)
- [ ] Git 커밋

## 3. Phase 3 — 모바일 앱 완성 (Week 3~4)

### Step 3.1: 전체 플로우 연결
- [ ] Consumer 로그인 → 자동 등록 → Dashboard 플로우 연결
- [ ] Business 로그인 → 자동 등록 → Dashboard 플로우 연결
- [ ] 네비게이션 스택 정리 (Consumer/Business 분리)
- [ ] Git 커밋

### Step 3.2: UX 개선
- [ ] 공통 로딩 컴포넌트 추출
- [ ] 공통 에러 화면 추출
- [ ] Alert 대신 inline 피드백 적용 (선택)
- [ ] Demo Mode 토글 (Settings 또는 Login 화면)
- [ ] Git 커밋

## 4. Phase 4 — 통합 테스트 (Week 5~6)

### Step 4.1: 핵심 시나리오 테스트
- [ ] 시나리오 A: 로그인 → 사업자 선택 → RLUSD 에스크로 생성 → 월별 정산 → 완료
- [ ] 시나리오 B: RLUSD 에스크로 생성 → 2개월 정산 → 나머지 환불 → 취소
- [ ] 시나리오 C: Demo Mode에서 시간 압축 정상 동작 확인
- [ ] Git 커밋

### Step 4.2: 엣지 케이스 처리
- [ ] 이미 released된 entry에 finish 시도 → 400 에러 확인
- [ ] 이미 cancelled된 escrow에 cancel 시도 → 적절한 처리
- [ ] 존재하지 않는 escrow ID 접근 → 404 에러 확인
- [ ] XRPL Testnet 네트워크 불안정 시 에러 핸들링
- [ ] Trust Line 미설정 시 에러 핸들링
- [ ] Git 커밋

## 5. Phase 5 — UI 개선 + 데모 (Week 7~8)

### Step 5.1: 디자인 마무리
- [ ] 색상/타이포그래피 일관성 점검 (UI_DESIGN.md 기준)
- [ ] 카드 그림자/간격 통일
- [ ] 빈 상태 화면 개선
- [ ] Git 커밋

### Step 5.2: 데모 준비
- [ ] 데모 시딩 스크립트 작성 (`scripts/seed.ts`)
- [ ] 데모 시나리오 스크립트 작성 (발표 중 조작 순서)
- [ ] 3분 내 전체 플로우 시연 리허설
- [ ] 스크린 녹화 (백업용)
- [ ] Git 커밋

## 6. Phase 6 — 최종 점검 + 데모데이 (Week 8~9)

### Step 6.1: QA
- [ ] QA Checklist 전 항목 통과 확인
- [ ] Rubric 6개 기준 자체 평가
- [ ] 크리티컬 버그 수정
- [ ] Git 커밋

### Step 6.2: KFIP 제출
- [ ] README.md 최종 업데이트 (설치, 실행, 데모 방법)
- [ ] GitHub 링크 정리
- [ ] XRPL Testnet 지갑 주소 제출
- [ ] 발표자료 작성
- [ ] 데모 영상 촬영
- [ ] 최종 커밋 + 태그

## 7. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 구현 대상
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - DB 모델
- **Logic_Progress**: [Roadmap](./00_ROADMAP.md) - Phase 일정
- **Logic_Progress**: [Backlog](./00_BACKLOG.md) - 전체 작업 목록
- **QA_Validation**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 테스트 케이스
- **QA_Validation**: [QA Checklist](../05_QA_Validation/02_QA_CHECKLIST.md) - 릴리스 기준
