# QA Checklist
> Created: 2026-04-26 22:50
> Last Updated: 2026-04-27

## 1. Global Rubric Scorecard

| Criterion | Status | Evidence |
|:---|:---:|:---|
| **Functionality** | - | MVP 기능 작동: 에스크로 생성/정산/환불 전체 플로우 |
| **Potential Impact** | - | 선불 결제 피해 방지, XRPL 생태계 확장 |
| **Novelty** | - | XRPL Token Escrow(XLS-85) + RLUSD 스테이블코인 (스마트 컨트랙트 불필요) |
| **UX** | - | API 400ms 이내, 직관적 모바일 UI |
| **Open-source** | - | 모노레포 구조, 패키지 분리로 재사용 가능 |
| **Business Plan** | - | 수수료 모델 + 사업자 구독 모델 설계됨 |

**목표**: 6개 중 4개 이상 Pass

## 2. Originality & Ethics Check

- [ ] 코드가 다른 프로젝트에서 복사되지 않았음을 확인
- [ ] 오픈소스 라이선스 준수 (xrpl.js: ISC, NestJS: MIT, Expo: MIT)
- [ ] 민감 정보(개인키, 시드 등)가 코드에 하드코딩되지 않음
- [ ] .env 파일이 .gitignore에 포함됨

## 3. 기능 체크리스트

### 소비자 플로우
- [ ] 앱 시작 -> LoginScreen 표시
- [ ] Consumer 역할 선택 + 전화번호/이메일 입력 -> Dashboard 이동
- [ ] 로그인 시 XRPL 지갑 자동 생성 + RLUSD Trust Line 설정
- [ ] Dashboard에서 에스크로 목록 조회
- [ ] 사업자 선택 -> 새 결제 생성 (RLUSD 금액 + 기간 입력)
- [ ] 에스크로 생성 성공 알림
- [ ] 에스크로 상세 조회 (월별 상태 표시)
- [ ] 환불 요청 -> pending entry RLUSD 환불 처리

### 사업자 플로우
- [ ] Business 역할 선택 + 전화번호/이메일 입력 -> Dashboard 이동
- [ ] 등록 시 XRPL 지갑 자동 생성 + RLUSD Trust Line 설정
- [ ] Dashboard에서 총 수령액 / 미정산액 표시 (RLUSD 단위)
- [ ] 활성 에스크로 목록 표시
- [ ] Release 버튼으로 월별 정산 실행
- [ ] 정산 성공 알림 + 대시보드 갱신

### XRPL 연동
- [ ] Testnet 연결 정상
- [ ] 커스토디얼 지갑 생성 정상
- [ ] RLUSD Trust Line 설정 정상
- [ ] Token EscrowCreate (RLUSD) 트랜잭션 생성 및 기록
- [ ] Token EscrowFinish 트랜잭션 실행 (finishAfter 경과 후)
- [ ] Token EscrowCancel 트랜잭션 실행 (cancelAfter 경과 후)
- [ ] Demo Mode 시간 압축 정상 동작

### API
- [ ] 모든 엔드포인트 정상 응답
- [ ] 잘못된 입력에 대해 400 에러 반환
- [ ] 존재하지 않는 리소스에 대해 404 에러 반환
- [ ] CORS 설정 정상

## 4. 비기능 체크리스트

### 성능
- [ ] API 응답 시간 400ms 이내 (DB 조회)
- [ ] 모바일 앱 화면 전환 매끄러움

### 보안
- [ ] .env 파일 미커밋
- [ ] 커스토디얼 지갑 시크릿이 코드에 노출되지 않음 (DB 암호화 저장)
- [ ] 전화번호/이메일 간편 인증 적용 (MVP)

### 코드 품질
- [ ] TypeScript strict 모드 에러 없음
- [ ] 빌드 성공 (turbo build)
- [ ] 미사용 import/변수 없음

## 5. 데모 체크리스트

- [ ] Demo Mode에서 전체 플로우 3분 내 시연 가능
- [ ] 데모 데이터 준비됨 (사업자 + 소비자 사전 등록)
- [ ] 에스크로 생성 -> 월별 정산 -> 완료 시연
- [ ] 폐업 환불 시나리오 시연
- [ ] XRPL Testnet Explorer에서 트랜잭션 확인 가능

## 6. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - MVP 기능 정의
- **Concept_Design**: [Lean Canvas](../01_Concept_Design/02_LEAN_CANVAS.md) - 비즈니스 모델
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 테스트 대상
- **QA_Validation**: [Test Scenarios](./01_TEST_SCENARIOS.md) - 상세 테스트 케이스
- **Logic_Progress**: [Roadmap](../04_Logic_Progress/00_ROADMAP.md) - Phase 6 최종 점검
