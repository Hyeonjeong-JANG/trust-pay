# Test Scenarios
> Created: 2026-04-26 22:50
> Last Updated: 2026-04-26 22:50

## 1. 핵심 시나리오 (E2E)

### Scenario A — 정상 플로우: 생성 -> 전액 정산 -> 완료

| Step | 행위 | 기대 결과 |
|:---:|:---|:---|
| 1 | Consumer 등록 (XRPL 주소 입력) | Consumer DB 레코드 생성 |
| 2 | Business 등록 (상호명 + XRPL 주소) | Business DB 레코드 생성 |
| 3 | Consumer가 600 XRP / 6개월 에스크로 생성 | Escrow(status: active) + 6개 EscrowEntry(status: pending) 생성 |
| 4 | XRPL Testnet에 6개 EscrowCreate 트랜잭션 확인 | 각 entry에 txHash 기록됨 |
| 5 | Business가 Month 1 정산 (EscrowFinish) | entry[0].status -> released, txHash 갱신 |
| 6 | Business가 Month 2~6 순차 정산 | 각 entry.status -> released |
| 7 | 마지막 entry 정산 완료 | escrow.status -> completed |

### Scenario B — 폐업 환불: 생성 -> 부분 정산 -> 환불

| Step | 행위 | 기대 결과 |
|:---:|:---|:---|
| 1 | Consumer가 600 XRP / 6개월 에스크로 생성 | Escrow + 6개 entry 생성 |
| 2 | Business가 Month 1, 2 정산 | 2개 entry -> released |
| 3 | Consumer가 환불 요청 (cancelEscrow) | 나머지 4개 entry -> refunded |
| 4 | escrow.status 확인 | cancelled |
| 5 | 환불 응답 확인 | `{ cancelled: 4 }` |

### Scenario C — Demo Mode 시간 압축

| Step | 행위 | 기대 결과 |
|:---:|:---|:---|
| 1 | Demo Mode 활성화 (1개월 = 2분) | 환경변수 XRPL_DEMO_MODE=true |
| 2 | 에스크로 생성 (3개월) | finishAfter 간격이 약 2분 |
| 3 | 2분 대기 후 Month 1 정산 | EscrowFinish 성공 |
| 4 | 총 6분 내 전체 플로우 완료 | 3개 entry 모두 released |

## 2. API 단위 테스트

### Escrow API

| ID | 테스트 | Method | Endpoint | 기대 |
|:---|:---|:---|:---|:---|
| E-01 | 에스크로 생성 성공 | POST | /escrow | 201, entries 포함 |
| E-02 | 존재하지 않는 Consumer | POST | /escrow | 404 |
| E-03 | 존재하지 않는 Business | POST | /escrow | 404 |
| E-04 | 에스크로 상세 조회 | GET | /escrow/:id | 200, relations 포함 |
| E-05 | 존재하지 않는 에스크로 조회 | GET | /escrow/:id | 404 |
| E-06 | 월별 정산 성공 | POST | /escrow/:id/finish | 200, txHash 반환 |
| E-07 | 이미 released된 entry 정산 시도 | POST | /escrow/:id/finish | 400 |
| E-08 | 에스크로 환불 성공 | POST | /escrow/:id/cancel | 200, cancelled 수 반환 |
| E-09 | Consumer별 에스크로 목록 | GET | /escrow/consumer/:addr | 200, 배열 |

### Business API

| ID | 테스트 | Method | Endpoint | 기대 |
|:---|:---|:---|:---|:---|
| B-01 | 사업자 등록 성공 | POST | /business | 201 |
| B-02 | 활성 사업자 목록 | GET | /business | 200, isActive만 |
| B-03 | 사업자 상세 조회 | GET | /business/:id | 200 |
| B-04 | 존재하지 않는 사업자 | GET | /business/:id | 404 |
| B-05 | 대시보드 조회 | GET | /business/:id/dashboard | 200, 집계 데이터 |

## 3. 입력 검증 테스트

| ID | 테스트 | 입력 | 기대 |
|:---|:---|:---|:---|
| V-01 | 잘못된 XRPL 주소 형식 | `{ consumerAddress: "invalid" }` | 400 |
| V-02 | 금액 초과 | `{ totalAmount: 200000000 }` | 400 |
| V-03 | 금액 음수 | `{ totalAmount: -100 }` | 400 |
| V-04 | 개월 수 범위 초과 | `{ months: 25 }` | 400 |
| V-05 | 필수 필드 누락 | `{}` | 400 |

## 4. XRPL 트랜잭션 테스트

| ID | 테스트 | 기대 |
|:---|:---|:---|
| X-01 | EscrowCreate 트랜잭션 생성 | Testnet에 기록됨, sequence 반환 |
| X-02 | EscrowFinish (finishAfter 경과 후) | 성공, txHash 반환 |
| X-03 | EscrowFinish (finishAfter 미경과) | 실패, 에러 처리 |
| X-04 | EscrowCancel (cancelAfter 경과 후) | 성공, 자금 반환 |
| X-05 | EscrowCancel (cancelAfter 미경과) | 실패, 에러 처리 |

## 5. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 테스트 대상 기능
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 엔드포인트 참조
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - 데이터 모델 참조
- **QA_Validation**: [QA Checklist](./02_QA_CHECKLIST.md) - 릴리스 기준
- **Logic_Progress**: [Execution Plan](../04_Logic_Progress/01_EXECUTION_PLAN.md) - Phase 4 테스트 일정
