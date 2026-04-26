# DB Schema
> Created: 2026-04-26 22:45
> Last Updated: 2026-04-26 22:45

## 1. 개요

- **ORM**: Prisma ^6.6.0
- **DB**: SQLite (MVP) -> PostgreSQL (Production 전환 가능)
- **스키마 파일**: `apps/api/prisma/schema.prisma`

## 2. ER Diagram

```
┌──────────────┐       ┌──────────────┐
│   Consumer   │       │   Business   │
│──────────────│       │──────────────│
│ id       (PK)│       │ id       (PK)│
│ name         │       │ name         │
│ xrplAddress  │       │ category     │
│ (unique)     │       │ address      │
│ createdAt    │       │ xrplAddress  │
│ updatedAt    │       │ (unique)     │
└──────┬───────┘       │ isActive     │
       │               │ createdAt    │
       │ 1:N           │ updatedAt    │
       │               └──────┬───────┘
       │                      │ 1:N
       v                      v
┌─────────────────────────────────┐
│            Escrow               │
│─────────────────────────────────│
│ id              (PK)            │
│ consumerId      (FK -> Consumer)│
│ businessId      (FK -> Business)│
│ consumerAddress                 │
│ businessAddress                 │
│ totalAmount     (Float)         │
│ monthlyAmount   (Float)         │
│ months          (Int)           │
│ status          (String)        │
│ createdAt                       │
│ updatedAt                       │
└──────────────┬──────────────────┘
               │ 1:N
               v
┌─────────────────────────────────┐
│         EscrowEntry             │
│─────────────────────────────────│
│ id          (PK)                │
│ escrowId    (FK -> Escrow)      │
│ month       (Int)               │
│ sequence    (Int)               │
│ amount      (String)            │
│ finishAfter (Int, Ripple epoch) │
│ cancelAfter (Int, Ripple epoch) │
│ status      (String)            │
│ txHash      (String, nullable)  │
│ createdAt                       │
│ updatedAt                       │
└─────────────────────────────────┘
```

## 3. 모델 상세

### 3.1 Business

| 필드 | 타입 | 제약 | 설명 |
|:---|:---|:---|:---|
| id | String | PK, UUID | 고유 식별자 |
| name | String | required | 상호명 |
| category | String | required | 업종 (gym, academy, salon 등) |
| address | String | required | 사업장 주소 |
| xrplAddress | String | unique | XRPL 수신 지갑 주소 |
| isActive | Boolean | default: true | 영업 상태 |
| createdAt | DateTime | auto | 등록일시 |
| updatedAt | DateTime | auto | 수정일시 |

### 3.2 Consumer

| 필드 | 타입 | 제약 | 설명 |
|:---|:---|:---|:---|
| id | String | PK, UUID | 고유 식별자 |
| name | String | required | 소비자 이름 |
| xrplAddress | String | unique | XRPL 지갑 주소 |
| createdAt | DateTime | auto | 등록일시 |
| updatedAt | DateTime | auto | 수정일시 |

### 3.3 Escrow

| 필드 | 타입 | 제약 | 설명 |
|:---|:---|:---|:---|
| id | String | PK, UUID | 고유 식별자 |
| consumerId | String | FK -> Consumer | 소비자 참조 |
| businessId | String | FK -> Business | 사업자 참조 |
| consumerAddress | String | required | 소비자 XRPL 주소 (역정규화) |
| businessAddress | String | required | 사업자 XRPL 주소 (역정규화) |
| totalAmount | Float | required | 총 에스크로 금액 (XRP) |
| monthlyAmount | Float | required | 월별 정산 금액 (XRP) |
| months | Int | required | 총 개월 수 |
| status | String | default: "active" | active / completed / cancelled |
| createdAt | DateTime | auto | 생성일시 |
| updatedAt | DateTime | auto | 수정일시 |

### 3.4 EscrowEntry

| 필드 | 타입 | 제약 | 설명 |
|:---|:---|:---|:---|
| id | String | PK, UUID | 고유 식별자 |
| escrowId | String | FK -> Escrow | 상위 에스크로 참조 |
| month | Int | required | 몇 번째 달 (1, 2, ..., N) |
| sequence | Int | required | XRPL EscrowCreate의 Sequence 번호 |
| amount | String | required | 정산 금액 (drops 단위, 문자열) |
| finishAfter | Int | required | EscrowFinish 가능 시각 (Ripple epoch) |
| cancelAfter | Int | required | EscrowCancel 가능 시각 (Ripple epoch) |
| status | String | default: "pending" | pending / released / refunded |
| txHash | String? | nullable | XRPL 트랜잭션 해시 (Finish/Cancel 후 기록) |
| createdAt | DateTime | auto | 생성일시 |
| updatedAt | DateTime | auto | 수정일시 |

## 4. 상태 전이

### Escrow.status
```
active --> completed   (모든 entry가 released)
active --> cancelled   (cancelEscrow 호출)
```

### EscrowEntry.status
```
pending --> released   (EscrowFinish 성공)
pending --> refunded   (EscrowCancel 성공)
```

## 5. 설계 결정

- **역정규화**: Escrow에 consumerAddress/businessAddress를 중복 저장하여 JOIN 없이 주소 기반 조회 가능
- **amount 타입**: EscrowEntry.amount는 String (drops 단위 정밀도 보존), Escrow.totalAmount/monthlyAmount는 Float (XRP 단위, UI 표시용)
- **Ripple epoch**: finishAfter/cancelAfter는 Int (2000-01-01 기준 초 단위, XRPL 프로토콜 규격)

## 6. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세
- **Technical_Specs**: [Development Principles](./00_DEVELOPMENT_PRINCIPLES.md) - 아키텍처 원칙
- **Technical_Specs**: [API Specs](./02_API_SPECS.md) - API 엔드포인트
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - 작업 목록
