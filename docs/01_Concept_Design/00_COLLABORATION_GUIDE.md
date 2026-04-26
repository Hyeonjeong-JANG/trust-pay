# AI-Human Collaboration Guide
> Created: 2026-04-26 22:40
> Last Updated: 2026-04-26 22:40

## 1. 프로젝트 개요

PrepaidShield는 XRPL Escrow를 활용하여 선불 결제(헬스장, 학원, 미용실 등)의 소비자 자금을 보호하는 서비스이다.
KFIP 2026 Hackathon 출품작으로, 2주 내 MVP 완성이 목표이다.

## 2. 역할 분담

| 역할 | 담당 | 범위 |
|:---|:---|:---|
| Product Owner | Human | 비전, 우선순위 결정, 최종 승인 |
| Architect & Developer | AI (Claude) | 설계, 코드 작성, 문서 생성 |
| QA & Reviewer | Human + AI | Human이 시나리오 검증, AI가 자동화 테스트 |

## 3. 의사결정 기준

- **Speed over Perfection**: 2주 해커톤이므로 MVP 기능 우선, 완벽한 설계보다 동작하는 프로토타입
- **Ask before Assume**: 모호한 요구사항은 반드시 질문 후 진행
- **Code follows Docs**: 문서(docs/) 기반으로 코드 작성, 문서와 코드 불일치 금지

## 4. 커뮤니케이션 규칙

- 문서 수정 시 반드시 기존 문서를 먼저 읽고 컨텍스트 유지
- 핵심 결정 사항은 문서에 기록하여 세션 간 컨텍스트 유실 방지
- 이모지 사용 금지, 전문적이고 명확한 텍스트로 소통

## 5. Related Documents
- **Concept_Design**: [Vision & Core Values](./01_VISION_CORE.md) - 프로젝트 비전 및 타겟 오디언스
- **Concept_Design**: [Lean Canvas](./02_LEAN_CANVAS.md) - 비즈니스 모델 및 수익 구조
- **Concept_Design**: [Product Specs](./03_PRODUCT_SPECS.md) - MVP 기능 명세
