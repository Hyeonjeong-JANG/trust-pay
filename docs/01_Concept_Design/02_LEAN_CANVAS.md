# Lean Canvas
> Created: 2026-04-26 22:40
> Last Updated: 2026-04-27

## 1. Problem (문제)

1. 선불 결제 후 사업자 폐업 시 환불이 사실상 불가능
2. 소비자보호원 중재/법적 소송은 느리고 회수율 낮음
3. 소비자 불신으로 장기 이용권 판매가 어려움 (사업자 측 문제)

## 2. Customer Segments (고객)

| 구분 | 세그먼트 | 특성 |
|:---|:---|:---|
| Primary | 선불 결제 소비자 | 헬스장/학원/미용실 이용자, 환불 불안감 보유 |
| Secondary | 소규모 사업자 | 선불 결제 운영, 신뢰 확보가 매출에 직결 |

**MVP 우선 업종**: 헬스장, 학원, 미용실

## 3. Unique Value Proposition (UVP)

**"선불금을 RLUSD 스테이블코인 에스크로에 보관하여, 가치 변동 없이 사업자 폐업 시 자동 환불"**

- 기존: 돈을 사업자에게 넘긴 후 돌려받을 방법 없음
- PrepaidShield: 돈이 XRPL Token Escrow(XLS-85)에 RLUSD로 잠겨있으므로 가치 변동 없이 자동 환불

## 4. Solution (솔루션)

1. 소비자가 선불금을 RLUSD로 XRPL Token Escrow에 예치
2. 매월 자동으로 사업자에게 RLUSD 정산 (EscrowFinish)
3. 사업자 폐업 시 미정산 RLUSD 자동 환불 (EscrowCancel)

## 5. Channels (유통)

- MVP: 모바일 앱 (React Native / Expo)
- 향후: 반응형 웹 추가
- 사업자 온보딩: 직접 영업 + "선불금 보호 인증" 스티커/배지 제공

## 6. Revenue Streams (수익)

| 단계 | 수익 모델 |
|:---|:---|
| MVP (KFIP 데모) | 수익 모델 미적용 (프로토타입) |
| Phase 2 | Escrow 생성 시 수수료 (0.5~1%) |
| Phase 3 | 사업자 월정액 구독 (인증 배지 + 대시보드) |

## 7. Cost Structure (비용)

- XRPL Testnet: 무료 (Mainnet 전환 시 최소 트랜잭션 비용)
- 서버: NestJS API 호스팅 (초기 무료 티어 활용)
- 개발: AI 기반 개발로 인건비 최소화

## 8. Key Metrics (핵심 지표)

| 지표 | 설명 |
|:---|:---|
| Escrow 생성 수 | 서비스 이용 활성도 |
| 월별 EscrowFinish 성공률 | 정상 정산 비율 |
| EscrowCancel 실행 수 | 환불 보호 실제 작동 빈도 |
| 사업자 등록 수 | B2B 채택률 |

## 9. Unfair Advantage (경쟁 우위)

- XRPL Token Escrow(XLS-85, 2026.02 활성화) — 스마트 컨트랙트 없이 프로토콜 레벨에서 스테이블코인 에스크로 지원
- RLUSD 스테이블코인으로 가치 변동 없는 선불금 보호 (XRP 변동성 문제 해결)
- 블록체인 기반 투명성: 모든 거래 내역이 공개 원장에 기록
- 사업자에게도 이익: "선불금 보호 인증"으로 소비자 신뢰 확보 -> 매출 증가

## 10. Related Documents
- **Concept_Design**: [Vision & Core Values](./01_VISION_CORE.md) - 핵심 가치 및 타겟
- **Concept_Design**: [Product Specs](./03_PRODUCT_SPECS.md) - MVP 기능 정의
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 엔드포인트 명세
