# Product Specs
> Created: 2026-04-26 22:40
> Last Updated: 2026-04-26 22:40

## 1. MVP 정의

**목표**: 2주 내 해커톤 데모 가능한 프로토타입

소비자가 선불금을 XRPL Escrow에 예치하고, 월별로 사업자에게 정산되며,
사업자 폐업 시 남은 금액이 자동 환불되는 전체 플로우를 시연한다.

## 2. 사용자 역할

| 역할 | 설명 | 주요 기능 |
|:---|:---|:---|
| Consumer (소비자) | 선불 결제 이용자 | 에스크로 생성, 잔여 현황 조회, 환불 요청 |
| Business (사업자) | 선불 결제 운영자 | 사업자 등록, 월별 정산 수령, 대시보드 조회 |

## 3. 기능 명세 (MVP)

### 3.1 소비자 기능

| ID | 기능 | 우선순위 | 설명 |
|:---|:---|:---:|:---|
| C-01 | 로그인 | P0 | XRPL 주소 기반 간편 로그인 (MVP: 주소 직접 입력) |
| C-02 | 사업자 선택 | P0 | 등록된 사업자 목록에서 선택 |
| C-03 | 에스크로 생성 | P0 | 총 금액 + 개월 수 입력 -> 월별 분할 Escrow 생성 |
| C-04 | 에스크로 목록 | P0 | 내 에스크로 현황 (진행중/완료/환불) 조회 |
| C-05 | 환불 요청 | P0 | 미정산 에스크로 엔트리 취소 (EscrowCancel) |
| C-06 | 월별 상세 | P1 | 개별 에스크로 엔트리 상태 확인 |

### 3.2 사업자 기능

| ID | 기능 | 우선순위 | 설명 |
|:---|:---|:---:|:---|
| B-01 | 사업자 등록 | P0 | 상호명 + XRPL 주소 + 업종 등록 |
| B-02 | 대시보드 | P0 | 총 수령액, 미정산액, 활성 에스크로 수 표시 |
| B-03 | 월별 정산 | P0 | 정산 가능한 에스크로 엔트리에 대해 EscrowFinish 실행 |
| B-04 | 에스크로 목록 | P1 | 사업자에게 연결된 에스크로 전체 조회 |

### 3.3 시스템 기능

| ID | 기능 | 우선순위 | 설명 |
|:---|:---|:---:|:---|
| S-01 | XRPL 연동 | P0 | Testnet 연결, EscrowCreate/Finish/Cancel 트랜잭션 |
| S-02 | Demo Mode | P0 | 1개월 = 2분으로 시간 압축하여 데모 시연 가능 |
| S-03 | DB 영속성 | P0 | Escrow 상태를 SQLite에 저장하여 조회 성능 확보 |

## 4. 비기능 요구사항 (NFR)

| 항목 | 기준 |
|:---|:---|
| 플랫폼 | 모바일 앱 (iOS/Android via Expo) |
| 응답 속도 | API 응답 400ms 이내 (DB 조회), XRPL 트랜잭션 제외 |
| 블록체인 | XRPL Testnet (xrpl.js v4) |
| DB | SQLite (MVP), PostgreSQL 전환 가능 구조 (Prisma) |
| 인증 | MVP: XRPL 주소 기반 (지갑 서명 미적용) |
| 보안 | MVP: 서버 사이드 테스트 월렛 사용 (프로덕션 시 클라이언트 서명 필수) |

## 5. XRPL Escrow 플로우

```
[소비자] ---(600 XRP, 6개월)--> [PrepaidShield API]
                                      |
                          6x EscrowCreate (100 XRP each)
                          FinishAfter: +1M, +2M, ..., +6M
                          CancelAfter: +2M, +3M, ..., +7M
                                      |
                                [XRPL Testnet]
                                      |
              +-----------+-----------+-----------+
              |           |           |           |
          Month 1     Month 2     ...        Month 6
        EscrowFinish  EscrowFinish           EscrowFinish
        -> 사업자      -> 사업자              -> 사업자

        [사업자 폐업 시]
        남은 Escrow -> EscrowCancel -> 소비자 환불
```

## 6. 사이트맵

```
LoginScreen
  |
  +-- [Consumer] ConsumerDashboard
  |     +-- PaymentScreen (에스크로 생성)
  |     +-- EscrowDetailScreen (상세 조회)
  |
  +-- [Business] BusinessDashboard
        +-- EscrowListScreen (정산 관리)
```

## 7. MVP 제외 항목 (Post-MVP)

- 실제 지갑 연동 및 클라이언트 사이드 트랜잭션 서명
- 사용자 인증 (JWT/OAuth)
- Push 알림 (정산 가능 알림, 환불 완료 알림)
- 사업자 폐업 자동 감지 (공공데이터 연동)
- 반응형 웹 버전
- 수수료 징수 로직
- 다국어 지원

## 8. Related Documents
- **Concept_Design**: [Vision & Core Values](./01_VISION_CORE.md) - 핵심 가치 및 타겟
- **Concept_Design**: [Lean Canvas](./02_LEAN_CANVAS.md) - 비즈니스 모델
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md) - 화면 흐름 상세
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md) - 디자인 시스템
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - 데이터 모델
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 엔드포인트
