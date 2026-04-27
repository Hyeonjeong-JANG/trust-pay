# Development Principles
> Created: 2026-04-26 22:45
> Last Updated: 2026-04-27

## 1. Architecture

### 1.1 모노레포 구조

```
/
├── apps/
│   ├── api/          NestJS 백엔드 (REST API + XRPL)
│   └── mobile/       React Native (Expo) 모바일 앱
├── packages/
│   ├── shared-types/  TypeScript 공유 타입
│   ├── validators/    Zod 스키마 (프론트/백 공유 검증)
│   └── xrpl-client/   XRPL 연결 및 에스크로 로직
├── turbo.json         Turborepo 설정
├── pnpm-workspace.yaml
└── tsconfig.base.json  공통 TS 설정
```

### 1.2 의존성 방향

```
mobile --> api (REST API 호출)
api --> xrpl-client (XRPL 트랜잭션: Token Escrow + Trust Lines)
api --> validators (입력 검증) [TODO: 미연결]
mobile --> shared-types (타입 공유)
api --> shared-types (타입 공유)
validators --> shared-types (타입 참조)
```

### 1.3 모듈 구조 (NestJS)

```
AppModule
├── ConfigModule (환경변수)
├── PrismaModule (DB, Global)
├── XrplModule (블록체인)
├── EscrowModule (핵심 비즈니스 로직)
└── BusinessModule (사업자 관리)
```

## 2. Patterns

### 2.1 상태 관리
- **Backend**: Prisma ORM + SQLite (stateless REST API)
- **Mobile**: Zustand (인증 상태), TanStack Query (서버 상태)

### 2.2 데이터 페칭
- TanStack Query v5 사용
- queryKey 패턴: `['resource', identifier]` (예: `['consumerEscrows', address]`)
- Mutation 성공 시 `invalidateQueries`로 캐시 무효화

### 2.3 에러 처리
- Backend: NestJS 내장 예외 (`NotFoundException`, `BadRequestException`)
- Mobile: TanStack Query의 `onError` 콜백 + `Alert.alert`
- XRPL 트랜잭션 실패: try-catch 후 로깅, 부분 실패 허용 (cancelEscrow)

### 2.4 컴포넌트 구성
- 화면 단위 컴포넌트 (`screens/`)
- 공통 컴포넌트 추출 미적용 (MVP 단계)
- StyleSheet.create로 스타일 분리

## 3. Standards

### 3.1 TypeScript
- `strict: true` (tsconfig.base.json)
- Target: ES2022, Module: Node16
- Composite project references 사용

### 3.2 네이밍 규칙
- 파일명: kebab-case (`escrow.service.ts`, `create-escrow.dto.ts`)
- 클래스명: PascalCase (`EscrowService`, `CreateEscrowDto`)
- 변수/함수: camelCase (`findById`, `monthlyAmount`)
- DB 모델: PascalCase (`EscrowEntry`)
- DB 필드: camelCase (`xrplAddress`, `createdAt`)

### 3.3 Import 규칙
- 패키지 간: `@prepaid-shield/shared-types` (workspace:* 참조)
- 앱 내부: 상대 경로 (`../prisma/prisma.service`)
- [TODO] path alias 미설정

### 3.4 데이터 검증
- Zod 스키마는 `packages/validators`에 정의됨
- [TODO: High] API 컨트롤러에 Zod 검증 파이프라인 연결 필요
- 금액 제한: 최대 100,000,000 RLUSD, 최소 1 RLUSD
- 기간 제한: 1~24개월

### 3.5 인증/인가
- MVP: 전화번호/이메일 간편 인증 + 서버 커스토디얼 지갑
- 서버가 사용자별 XRPL 지갑을 생성/관리 (사용자는 지갑 주소 몰라도 됨)
- [TODO: Medium] Production 시 JWT 세션 + HSM/MPC 기반 키 관리로 전환

### 3.6 XRPL 기능 활용
- **Token Escrow (XLS-85)**: RLUSD 에스크로 생성/정산/환불 (2026.02 메인넷 활성화)
- **Trust Lines**: RLUSD 수신을 위한 신뢰선 설정 (지갑 생성 시 자동)
- Testnet에서 RLUSD issuer 주소 설정 필요 (환경변수: `RLUSD_ISSUER`)

### 3.6 커밋 컨벤션
- `chore:` 설정/인프라 변경
- `feat:` 새 기능 추가
- `fix:` 버그 수정
- `docs:` 문서 변경

## 4. Tooling

| 도구 | 버전 | 용도 |
|:---|:---|:---|
| pnpm | 10.8.1 | 패키지 매니저 |
| Turborepo | ^2.5.0 | 모노레포 빌드 오케스트레이션 |
| TypeScript | ^5.8.0 | 타입 시스템 |
| NestJS | ^11.0.0 | 백엔드 프레임워크 |
| Prisma | ^6.6.0 | ORM (SQLite) |
| Expo | ~52.0.0 | React Native 빌드 |
| xrpl.js | ^4.1.0 | XRPL 블록체인 SDK |
| Zod | ^3.24.0 | 스키마 검증 |
| TanStack Query | ^5.60.0 | 서버 상태 관리 |
| Zustand | ^5.0.0 | 클라이언트 상태 관리 |

| 항목 | 상태 |
|:---|:---|
| 린터 (ESLint) | [TODO: Medium] 미설정 |
| 포매터 (Prettier) | [TODO: Medium] 미설정 |
| 테스트 (Jest/Vitest) | [TODO: High] 미설정 |
| CI/CD | [TODO: Low] 해커톤 단계에서 불필요 |

## 5. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세
- **Technical_Specs**: [DB Schema](./01_DB_SCHEMA.md) - 데이터 모델
- **Technical_Specs**: [API Specs](./02_API_SPECS.md) - API 엔드포인트
- **Logic_Progress**: [Roadmap](../04_Logic_Progress/00_ROADMAP.md) - 개발 일정
