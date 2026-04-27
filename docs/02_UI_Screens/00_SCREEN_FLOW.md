# Screen Flow
> Created: 2026-04-26 22:40
> Last Updated: 2026-04-27

## 1. 전체 사용자 여정

```
[App Launch]
    |
    v
LoginScreen (전화번호/이메일 인증)
    |-- Role: Consumer --> ConsumerDashboard
    |                          |
    |                          +-- BusinessListScreen (사업자 선택)
    |                          |       +-- PaymentScreen (에스크로 생성)
    |                          +-- EscrowDetailScreen (상세/환불)
    |
    +-- Role: Business --> BusinessDashboard
                               |
                               +-- [inline] Release Payment (월별 정산)
```

## 2. 화면별 상세

### 2.1 LoginScreen

- **진입**: 앱 시작 시 (인증 상태 없을 때)
- **목적**: 역할 선택 + 전화번호/이메일 인증
- **상호작용**:
  1. Consumer / Business 역할 토글
  2. 전화번호 또는 이메일 입력
  3. 인증 코드 확인 (MVP: 간편 인증, OTP 생략 가능)
  4. Enter 버튼 -> 서버에서 커스토디얼 XRPL 지갑 자동 생성/조회 -> 역할에 따라 라우팅
- **이탈 조건**: 연락처 미입력 시 버튼 비활성화
- **참고**: 사용자는 XRPL 지갑 주소를 알 필요 없음 (서버가 관리)

### 2.2 ConsumerDashboard

- **진입**: Consumer 로그인 후
- **목적**: 내 에스크로 목록 조회
- **데이터**: `GET /escrow/consumer/:id` -> 에스크로 리스트
- **상호작용**:
  1. 에스크로 카드 탭 -> EscrowDetail 이동
  2. 결제 생성 -> BusinessListScreen -> PaymentScreen 이동
- **상태**: Loading / Empty / List

### 2.3 BusinessListScreen

- **진입**: ConsumerDashboard에서 "새 결제" 탭 시
- **목적**: 에스크로를 생성할 사업자 선택
- **데이터**: `GET /business` -> 활성 사업자 리스트
- **상호작용**:
  1. 사업자 카드 탭 -> PaymentScreen으로 이동 (선택된 businessId 전달)
- **상태**: Loading / Empty / List

### 2.4 PaymentScreen

- **진입**: BusinessListScreen에서 사업자 선택 후
- **목적**: 새 에스크로 생성 (총액 + 기간 입력)
- **상호작용**:
  1. Total Amount (RLUSD) 입력
  2. Duration (months) 입력
  3. Monthly release 자동 계산 표시 (예: 600 RLUSD / 6개월 = 100 RLUSD/월)
  4. Create Escrow 버튼 -> API 호출
  5. 성공 시 Alert + ConsumerDashboard로 복귀
  6. 실패 시 Error Alert

### 2.5 EscrowDetailScreen

- **진입**: ConsumerDashboard에서 에스크로 카드 탭 시
- **목적**: 개별 에스크로의 월별 엔트리 상태 확인 + 환불 요청
- **데이터**: `GET /escrow/:id` -> Escrow + entries
- **레이아웃**:
  - 에스크로 요약 (사업자명, 총액, 상태)
  - 월별 엔트리 리스트 (month, amount, status 배지)
  - 환불 버튼 (pending 엔트리가 있을 때만 표시)
- **상호작용**:
  1. 환불 요청 버튼 -> 확인 모달 -> EscrowCancel 실행
  2. 성공 시 Alert + 상태 갱신

### 2.6 BusinessDashboard

- **진입**: Business 로그인 후
- **목적**: 사업자 대시보드 (수령액, 미정산액, 정산 실행)
- **데이터**: `GET /business/:id/dashboard`
- **레이아웃**:
  - Summary Cards: Received / Pending (RLUSD)
  - Active Escrows 리스트
  - 각 에스크로의 첫 번째 pending 엔트리에 Release 버튼
- **상호작용**:
  1. Release Month N 버튼 -> EscrowFinish 실행
  2. 성공 시 Alert + 대시보드 갱신

## 3. 네비게이션 구조

```
NativeStackNavigator
  |
  +-- LoginScreen (초기 화면, 인증 없을 때)
  |
  +-- [Consumer Stack]
  |     +-- ConsumerDashboard
  |     +-- BusinessListScreen (사업자 선택)
  |     +-- PaymentScreen
  |     +-- EscrowDetailScreen
  |
  +-- [Business Stack]
        +-- BusinessDashboard
```

**네비게이션 가드**: `useAuthStore`의 role/userId 값에 따라 조건부 렌더링 (App.tsx)

## 4. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세 및 사이트맵
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 엔드포인트 명세
