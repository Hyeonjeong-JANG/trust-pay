# Screen Flow
> Created: 2026-04-26 22:40
> Last Updated: 2026-04-26 22:40

## 1. 전체 사용자 여정

```
[App Launch]
    |
    v
LoginScreen
    |-- Role: Consumer --> ConsumerDashboard
    |                          |
    |                          +-- PaymentScreen (에스크로 생성)
    |                          +-- EscrowDetailScreen (상세/환불) [P1]
    |
    +-- Role: Business --> BusinessDashboard
                               |
                               +-- [inline] Release Payment (월별 정산)
```

## 2. 화면별 상세

### 2.1 LoginScreen

- **진입**: 앱 시작 시 (인증 상태 없을 때)
- **목적**: 역할 선택 + XRPL 주소 입력
- **상호작용**:
  1. Consumer / Business 역할 토글
  2. XRPL 주소 입력 (r로 시작, 25자 이상 검증)
  3. Enter 버튼 -> 역할에 따라 라우팅
- **이탈 조건**: 주소 미입력 시 버튼 비활성화

### 2.2 ConsumerDashboard

- **진입**: Consumer 로그인 후
- **목적**: 내 에스크로 목록 조회
- **데이터**: `GET /escrow/consumer/:address` -> 에스크로 리스트
- **상호작용**:
  1. 에스크로 카드 탭 -> EscrowDetail 이동 [P1]
  2. 결제 생성 -> PaymentScreen 이동
- **상태**: Loading / Empty / List

### 2.3 PaymentScreen

- **진입**: ConsumerDashboard에서 결제 생성 시
- **목적**: 새 에스크로 생성 (총액 + 기간 입력)
- **상호작용**:
  1. Total Amount (XRP) 입력
  2. Duration (months) 입력
  3. Monthly release 자동 계산 표시
  4. Create Escrow 버튼 -> API 호출
  5. 성공 시 Alert + ConsumerDashboard로 복귀
  6. 실패 시 Error Alert

### 2.4 BusinessDashboard

- **진입**: Business 로그인 후
- **목적**: 사업자 대시보드 (수령액, 미정산액, 정산 실행)
- **데이터**: `GET /business/:id/dashboard`
- **레이아웃**:
  - Summary Cards: Received / Pending (XRP)
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
  |     +-- PaymentScreen
  |     +-- EscrowDetailScreen [P1]
  |
  +-- [Business Stack]
        +-- BusinessDashboard
```

**네비게이션 가드**: `useAuthStore`의 role 값에 따라 조건부 렌더링 (App.tsx)

## 4. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세 및 사이트맵
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 엔드포인트 명세
