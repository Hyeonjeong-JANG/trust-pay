# API Specs
> Created: 2026-04-26 22:45
> Last Updated: 2026-04-27

## 1. 개요

- **프레임워크**: NestJS ^11.0.0
- **Base URL**: `http://localhost:3000`
- **형식**: REST JSON API
- **인증**: 전화번호/이메일 간편 인증 (MVP)
- **결제 토큰**: RLUSD (Token Escrow via XLS-85)
- **CORS**: 전체 허용 (MVP)

## 2. Escrow API

### 2.1 POST /escrow — 에스크로 생성

소비자가 사업자에게 선불금을 RLUSD로 월별 분할 Token Escrow에 예치한다.

**Request Body**:
```json
{
  "consumerId": "uuid",
  "businessId": "uuid",
  "totalAmount": 600,
  "months": 6
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "consumerId": "uuid",
  "businessId": "uuid",
  "consumerAddress": "rConsumer...",
  "businessAddress": "rBusiness...",
  "totalAmount": 600,
  "monthlyAmount": 100,
  "months": 6,
  "currency": "RLUSD",
  "status": "active",
  "entries": [
    {
      "id": "uuid",
      "month": 1,
      "sequence": 12345,
      "amount": "100",
      "finishAfter": 893456789,
      "cancelAfter": 896048789,
      "status": "pending",
      "txHash": "ABCDEF..."
    }
  ]
}
```

**에러**:
- `404` Consumer not found
- `404` Business not found

**비즈니스 로직**:
1. Consumer/Business 존재 확인 + XRPL 주소 조회
2. Trust Line 확인 (RLUSD issuer에 대한 신뢰선)
3. N개의 XRPL Token EscrowCreate 트랜잭션 생성 (RLUSD)
4. DB에 Escrow + EscrowEntry 저장

---

### 2.2 GET /escrow/:id — 에스크로 상세 조회

**Response 200**: Escrow 객체 (entries, business, consumer 포함)

**에러**: `404` Escrow not found

---

### 2.3 POST /escrow/:id/finish — 월별 정산 실행

사업자가 해당 월의 에스크로를 정산받는다.

**Request Body**:
```json
{
  "entryMonth": 1
}
```

**Response 200**:
```json
{
  "txHash": "ABCDEF..."
}
```

**에러**:
- `404` Escrow not found
- `404` Entry not found
- `400` Entry already released/refunded

**비즈니스 로직**:
1. Escrow + entries 조회
2. 해당 month의 entry가 pending인지 확인
3. XRPL EscrowFinish 트랜잭션 실행
4. entry.status -> "released" 업데이트
5. 모든 entry가 released면 escrow.status -> "completed"

---

### 2.4 POST /escrow/:id/cancel — 에스크로 환불

소비자가 미정산 에스크로를 취소하고 환불받는다.

**Response 200**:
```json
{
  "cancelled": 4
}
```

**에러**: `404` Escrow not found

**비즈니스 로직**:
1. Escrow + entries 조회
2. status가 "pending"인 모든 entry에 대해 EscrowCancel 실행
3. 개별 entry 실패 시 로깅 후 다음 entry 계속 처리
4. entry.status -> "refunded" 업데이트
5. escrow.status -> "cancelled"

---

### 2.5 GET /escrow/consumer/:address — 소비자 에스크로 목록

**Response 200**: Escrow 배열 (entries, business 포함)

---

## 3. Business API

### 3.1 POST /business — 사업자 등록

**Request Body**:
```json
{
  "name": "FitGym Gangnam",
  "category": "gym",
  "address": "Seoul Gangnam-gu ...",
  "phone": "010-1234-5678",
  "email": "fitgym@example.com"
}
```

**Response 201**: Business 객체 (xrplAddress 자동 생성됨, xrplSecret 미노출)

**비즈니스 로직**:
1. XRPL 지갑 자동 생성 (Testnet faucet)
2. RLUSD issuer에 대한 Trust Line 설정
3. DB에 Business 저장 (xrplSecret 암호화)

---

### 3.2 GET /business — 활성 사업자 목록

**Response 200**: Business 배열 (isActive: true만)

---

### 3.3 GET /business/:id — 사업자 상세

**Response 200**: Business 객체

**에러**: `404` Business not found

---

### 3.4 GET /business/:id/dashboard — 사업자 대시보드

**Response 200**:
```json
{
  "totalReceived": 300,
  "totalPending": 300,
  "activeEscrows": 2,
  "escrows": [...]
}
```

**비즈니스 로직**:
- totalReceived: status가 "released"인 entry의 amount 합계
- totalPending: status가 "pending"인 entry의 amount 합계
- activeEscrows: status가 "active"인 escrow 수

## 4. Auth API

### 4.1 POST /auth/login — 간편 로그인

**Request Body**:
```json
{
  "phone": "010-1234-5678",
  "role": "consumer"
}
```

**Response 200**:
```json
{
  "userId": "uuid",
  "role": "consumer",
  "name": "홍길동"
}
```

**비즈니스 로직**:
1. phone/email로 사용자 조회
2. 없으면 자동 등록 (XRPL 지갑 생성 + Trust Line 설정)
3. 있으면 기존 사용자 반환

## 5. Consumer API

### 5.1 POST /consumer — 소비자 등록

**Request Body**:
```json
{
  "name": "홍길동",
  "phone": "010-1234-5678",
  "email": "hong@example.com"
}
```

**Response 201**: Consumer 객체 (xrplAddress 자동 생성됨)

## 6. [TODO] 미구현 API

| 엔드포인트 | 우선순위 | 설명 |
|:---|:---:|:---|
| GET /business/:id/escrows | P1 | 사업자별 에스크로 목록 |
| PATCH /business/:id | P2 | 사업자 정보 수정 |
| POST /auth/send-otp | P2 | OTP 발송 (프로덕션 인증) |
| POST /auth/verify-otp | P2 | OTP 검증 (프로덕션 인증) |

## 5. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세
- **Technical_Specs**: [Development Principles](./00_DEVELOPMENT_PRINCIPLES.md) - 아키텍처 원칙
- **Technical_Specs**: [DB Schema](./01_DB_SCHEMA.md) - 데이터 모델
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - 미구현 항목 추적
- **QA_Validation**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - API 테스트 케이스
