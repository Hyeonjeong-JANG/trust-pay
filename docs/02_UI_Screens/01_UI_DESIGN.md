# UI Design System
> Created: 2026-04-26 22:40
> Last Updated: 2026-04-26 22:40

## 1. 디자인 원칙

- **Simple & Trustworthy**: 금융 서비스답게 깔끔하고 신뢰감 있는 디자인
- **Mobile First**: React Native 네이티브 컴포넌트 기반
- **Minimal Friction**: 최소 입력으로 핵심 기능 사용 가능

## 2. 색상 시스템

| Token | Hex | 용도 |
|:---|:---|:---|
| Primary | `#4A90D9` | 주요 버튼, 활성 상태, 브랜드 강조 |
| Primary BG | `#EBF3FB` | 선택된 항목 배경 |
| Success | `#34C759` | Release 버튼, 성공 상태 |
| Background | `#FFFFFF` | 주요 화면 배경 |
| Surface | `#F5F5F5` | 리스트 화면 배경 |
| Card | `#FFFFFF` | 카드 컴포넌트 배경 |
| Text Primary | `#000000` | 제목, 본문 |
| Text Secondary | `#333333` | 부제목, 금액 |
| Text Muted | `#666666` | 보조 텍스트, 라벨 |
| Text Disabled | `#999999` | 비활성 텍스트, 빈 상태 |
| Border | `#DDDDDD` | 입력 필드, 비활성 버튼 테두리 |

## 3. 타이포그래피

| 스타일 | Size | Weight | 용도 |
|:---|:---:|:---:|:---|
| H1 | 32px | Bold | 앱 타이틀 (LoginScreen) |
| H2 | 24px | Bold | 화면 타이틀 |
| H3 | 20px | Bold | Summary 값 |
| H4 | 18px | SemiBold (600) | 카드 타이틀, 섹션 헤더 |
| Body | 16px | Normal | 본문, 버튼 텍스트, 입력 필드 |
| Caption | 14px | Normal | 라벨, 보조 텍스트 |
| Small | 14px | SemiBold (600) | 강조 라벨 |

## 4. 컴포넌트 스펙

### 4.1 Button (Primary)
- 배경: `#4A90D9`
- 텍스트: `#FFFFFF`, 16px, SemiBold
- Padding: 16px vertical
- Border Radius: 12px
- Disabled: opacity 0.5

### 4.2 Button (Success / Release)
- 배경: `#34C759`
- 텍스트: `#FFFFFF`, SemiBold
- Padding: 12px vertical
- Border Radius: 8px

### 4.3 Card
- 배경: `#FFFFFF`
- Padding: 16px
- Border Radius: 12px
- Shadow: color `#000`, opacity 0.1, radius 4, elevation 2

### 4.4 Input Field
- Border: 1px `#DDDDDD`
- Border Radius: 8px
- Padding: 12px
- Font Size: 16px
- Margin Bottom: 16~24px

### 4.5 Role Toggle Button
- 비활성: border `#DDDDDD`, text `#666666`
- 활성: border `#4A90D9`, bg `#EBF3FB`, text `#4A90D9` SemiBold
- Padding: 12px
- Border Radius: 8px
- Layout: flex row, gap 12px

### 4.6 Summary Card (Business Dashboard)
- 배경: `#FFFFFF`
- Layout: flex 1, centered
- Label: 14px `#666666`
- Value: 20px Bold, margin-top 4px

## 5. 레이아웃 규칙

| 항목 | 값 |
|:---|:---|
| 화면 Padding | 16px (리스트), 24px (폼) |
| 카드 간격 | 12px (marginBottom) |
| 섹션 간격 | 24px |
| Safe Area | React Navigation 기본 적용 |

## 6. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세
- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md) - 사용자 흐름
- **Technical_Specs**: [Development Principles](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) - 개발 원칙
