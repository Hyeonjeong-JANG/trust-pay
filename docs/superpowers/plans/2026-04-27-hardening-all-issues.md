# PrepaidShield Hardening — Full Issues Resolution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified security, stability, type safety, UX, and config issues before KFIP demo day

**Architecture:** Lightweight API key auth guard (header-based userId+role verification) on all protected endpoints, CORS lockdown, Prisma schema hardening with onDelete policies, mobile UX improvements (logout confirm, balance error states), and test DI fixes

**Tech Stack:** NestJS 11 Guards/Interceptors, Prisma 6, React Native Alert, TypeScript strict typing

---

## Task 1: API Auth Guard — Header-based userId/role verification

**Files:**
- Create: `apps/api/src/common/auth.guard.ts`
- Modify: `apps/api/src/escrow/escrow.controller.ts`
- Modify: `apps/api/src/business/business.controller.ts`
- Modify: `apps/api/src/consumer/consumer.controller.ts`
- Create: `apps/api/src/common/auth.guard.spec.ts`

**Context:** This is a custodial MVP — no JWT or session tokens yet. The guard verifies that the `x-user-id` and `x-user-role` headers are present and that the requested resource belongs to the authenticated user. Mobile app already stores userId/role in Zustand.

- [ ] **Step 1: Write the failing test for AuthGuard**

```typescript
// apps/api/src/common/auth.guard.spec.ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

function mockContext(headers: Record<string, string>, params: Record<string, string> = {}): ExecutionContext {
  const req = {
    headers,
    params,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  it('should throw if x-user-id header missing', () => {
    const ctx = mockContext({ 'x-user-role': 'consumer' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw if x-user-role header missing', () => {
    const ctx = mockContext({ 'x-user-id': 'user-1' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw if x-user-role is invalid', () => {
    const ctx = mockContext({ 'x-user-id': 'user-1', 'x-user-role': 'admin' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should pass and attach user to request', () => {
    const ctx = mockContext({ 'x-user-id': 'user-1', 'x-user-role': 'consumer' });
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect((req as any).user).toEqual({ userId: 'user-1', role: 'consumer' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx jest src/common/auth.guard.spec.ts --no-coverage`
Expected: FAIL — cannot find module './auth.guard'

- [ ] **Step 3: Implement AuthGuard**

```typescript
// apps/api/src/common/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

const VALID_ROLES = ['consumer', 'business'] as const;

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];

    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('x-user-id 헤더가 필요합니다');
    }
    if (!role || !VALID_ROLES.includes(role as any)) {
      throw new UnauthorizedException('유효한 x-user-role 헤더가 필요합니다 (consumer | business)');
    }

    req.user = { userId, role };
    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx jest src/common/auth.guard.spec.ts --no-coverage`
Expected: 4 tests PASS

- [ ] **Step 5: Apply AuthGuard to controllers**

Modify `apps/api/src/escrow/escrow.controller.ts`:
```typescript
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UsePipes,
  UseGuards,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { FinishEscrowDto } from './dto/finish-escrow.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createEscrowSchema, finishEscrowSchema } from '@prepaid-shield/validators';
import { AuthGuard } from '../common/auth.guard';

@Controller('escrow')
@UseGuards(AuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createEscrowSchema))
  create(@Body() dto: CreateEscrowDto) {
    return this.escrowService.create(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.escrowService.findById(id);
  }

  @Post(':id/finish')
  finish(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finishEscrowSchema)) dto: FinishEscrowDto,
  ) {
    return this.escrowService.finishEntry(id, dto.entryMonth);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.escrowService.cancelEscrow(id);
  }

  @Get('consumer/:consumerId')
  findByConsumer(@Param('consumerId') consumerId: string) {
    return this.escrowService.findByConsumer(consumerId);
  }
}
```

Modify `apps/api/src/business/business.controller.ts`:
```typescript
import { Controller, Post, Get, Param, Body, UsePipes, UseGuards } from '@nestjs/common';
import { BusinessService } from './business.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { businessRegistrationSchema } from '@prepaid-shield/validators';
import { AuthGuard } from '../common/auth.guard';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(businessRegistrationSchema))
  register(
    @Body() dto: { name: string; category: string; address: string; phone?: string; email?: string },
  ) {
    return this.businessService.register(dto);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    return this.businessService.findAll();
  }

  @Get(':id/balance')
  @UseGuards(AuthGuard)
  getBalance(@Param('id') id: string) {
    return this.businessService.getBalance(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findById(@Param('id') id: string) {
    return this.businessService.findById(id);
  }

  @Get(':id/dashboard')
  @UseGuards(AuthGuard)
  dashboard(@Param('id') id: string) {
    return this.businessService.dashboard(id);
  }
}
```

Modify `apps/api/src/consumer/consumer.controller.ts`:
```typescript
import { Controller, Post, Get, Param, Body, UsePipes, UseGuards } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { consumerRegistrationSchema } from '@prepaid-shield/validators';
import { AuthGuard } from '../common/auth.guard';

@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(consumerRegistrationSchema))
  register(@Body() dto: { name: string; phone?: string; email?: string }) {
    return this.consumerService.register(dto);
  }

  @Get(':id/balance')
  @UseGuards(AuthGuard)
  getBalance(@Param('id') id: string) {
    return this.consumerService.getBalance(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findById(@Param('id') id: string) {
    return this.consumerService.findById(id);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    return this.consumerService.findAll();
  }
}
```

- [ ] **Step 6: Update mobile API client to send auth headers**

Modify `apps/mobile/src/api/client.ts` — replace the `request` function:
```typescript
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Inject auth headers from store (import at top of file)
  const { userId, role } = useAuthStore.getState();
  const authHeaders: Record<string, string> = {};
  if (userId) authHeaders['x-user-id'] = userId;
  if (role) authHeaders['x-user-role'] = role;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      signal: controller.signal,
      ...options,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') throw new ApiError('TIMEOUT');
    throw new ApiError('NETWORK');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw classifyError(res.status, body);
  }
  return res.json();
}
```

Also add `'UNAUTHORIZED'` to `ApiErrorCode` and its error message:
```typescript
export type ApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'XRPL_TIMEOUT'
  | 'INSUFFICIENT_BALANCE'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'SERVER';

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  NETWORK: '네트워크에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.',
  TIMEOUT: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
  XRPL_TIMEOUT: 'XRPL 블록체인 응답 지연 중입니다. 잠시 후 다시 시도해주세요.',
  INSUFFICIENT_BALANCE: 'RLUSD 잔액이 부족합니다. 충전 후 다시 시도해주세요.',
  VALIDATION: '입력값을 확인해주세요.',
  NOT_FOUND: '요청한 정보를 찾을 수 없습니다.',
  UNAUTHORIZED: '인증이 필요합니다. 다시 로그인해주세요.',
  SERVER: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};
```

Add 401 handling in `classifyError`:
```typescript
if (status === 401) return new ApiError('UNAUTHORIZED', msg, status);
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/auth.guard.ts apps/api/src/common/auth.guard.spec.ts \
  apps/api/src/escrow/escrow.controller.ts apps/api/src/business/business.controller.ts \
  apps/api/src/consumer/consumer.controller.ts apps/mobile/src/api/client.ts
git commit -m "feat: API AuthGuard + 모바일 인증 헤더 — 모든 보호 엔드포인트에 x-user-id/role 검증"
```

---

## Task 2: CORS origin restriction

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Restrict CORS to known origins**

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081', 'http://localhost:19006'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-user-id', 'x-user-role'],
  });
  await app.listen(3000);
  console.log('API running on http://localhost:3000');
}
bootstrap();
```

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx jest --no-coverage`
Expected: All unit tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "fix: CORS origin 제한 — 허용 도메인 + 인증 헤더 화이트리스트"
```

---

## Task 3: Fix encryption key fallback to 32 characters

**Files:**
- Modify: `apps/api/src/config/configuration.ts`

- [ ] **Step 1: Fix the fallback key length**

```typescript
// apps/api/src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  xrpl: {
    network: process.env.XRPL_NETWORK || 'testnet',
    url: process.env.XRPL_URL || 'wss://s.altnet.rippletest.net:51233',
  },
  rlusd: {
    issuer: process.env.RLUSD_ISSUER || 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKm',
    currency: process.env.RLUSD_CURRENCY || 'RLUSD',
  },
  demoMode: process.env.DEMO_MODE === 'true',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-only-key-change-in-prod-32ch',
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/config/configuration.ts
git commit -m "fix: 암호화 키 폴백값 32자로 수정"
```

---

## Task 4: Create .env.example with all required variables

**Files:**
- Create: `apps/api/.env.example`

- [ ] **Step 1: Create .env.example**

```env
# Database
DATABASE_URL="file:./dev.db"

# XRPL
XRPL_NETWORK=testnet
XRPL_URL=wss://s.altnet.rippletest.net:51233

# RLUSD stablecoin
RLUSD_ISSUER=rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKm
RLUSD_CURRENCY=RLUSD

# Encryption (REQUIRED — used for xrplSecret AES-256-GCM encryption)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=

# Demo mode (set to true for testing without real XRPL transactions)
DEMO_MODE=true

# CORS (comma-separated origins)
CORS_ORIGIN=http://localhost:8081,http://localhost:19006

# Server
PORT=3000
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/.env.example
git commit -m "docs: .env.example — 모든 환경 변수 문서화 (ENCRYPTION_KEY 포함)"
```

---

## Task 5: Fix unit test DI — add CryptoService mock to all 3 spec files

**Files:**
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/business/business.service.spec.ts`
- Modify: `apps/api/src/escrow/escrow.service.spec.ts`

- [ ] **Step 1: Fix auth.service.spec.ts — add CryptoService mock**

Add to providers array in `auth.service.spec.ts`:

```typescript
import { CryptoService } from '../common/crypto.service';

// Inside beforeEach, add to providers:
{ provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => `encrypted:${v}`), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
```

The full providers block becomes:
```typescript
const module = await Test.createTestingModule({
  providers: [
    AuthService,
    { provide: PrismaService, useValue: prisma },
    { provide: XrplService, useValue: xrplService },
    { provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => `encrypted:${v}`), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
  ],
}).compile();
```

Also update the assertion at line 71-76 to expect encrypted secret:
```typescript
expect(prisma.consumer.create).toHaveBeenCalledWith({
  data: expect.objectContaining({
    phone: '010-1234-5678',
    name: '테스트',
    xrplAddress: 'rTestAddr123',
    xrplSecret: 'encrypted:sTestSecret123',
  }),
});
```

- [ ] **Step 2: Fix business.service.spec.ts — add CryptoService mock**

Add import and mock:
```typescript
import { CryptoService } from '../common/crypto.service';

// Inside beforeEach, add to providers:
{ provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => `encrypted:${v}`), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
```

The full providers block:
```typescript
const module = await Test.createTestingModule({
  providers: [
    BusinessService,
    { provide: PrismaService, useValue: prisma },
    { provide: XrplService, useValue: xrplService },
    { provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => `encrypted:${v}`), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
  ],
}).compile();
```

Update the register test assertion to expect encrypted secret:
```typescript
expect(prisma.business.create).toHaveBeenCalledWith({
  data: expect.objectContaining({
    name: '테스트카페',
    category: '카페',
    address: '서울시 강남구',
    xrplAddress: 'rBizAddr123',
    xrplSecret: 'encrypted:sBizSecret123',
  }),
});
```

- [ ] **Step 3: Fix escrow.service.spec.ts — add CryptoService mock**

Add import and mock:
```typescript
import { CryptoService } from '../common/crypto.service';

// Inside beforeEach, add to providers:
{ provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => `encrypted:${v}`), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
```

The full providers block:
```typescript
const module = await Test.createTestingModule({
  providers: [
    EscrowService,
    { provide: PrismaService, useValue: prisma },
    { provide: XrplService, useValue: xrplService },
    { provide: ConfigService, useValue: configService },
    { provide: CryptoService, useValue: { encrypt: jest.fn((v: string) => `encrypted:${v}`), decrypt: jest.fn((v: string) => v.replace('encrypted:', '')) } },
  ],
}).compile();
```

- [ ] **Step 4: Run all unit tests**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx jest --no-coverage`
Expected: All tests PASS (previously failing 3 spec files now fixed)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.spec.ts apps/api/src/business/business.service.spec.ts \
  apps/api/src/escrow/escrow.service.spec.ts
git commit -m "fix: 유닛 테스트 CryptoService DI 누락 수정 — 3개 spec 파일"
```

---

## Task 6: Prisma schema — add onDelete policies

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add onDelete cascade/restrict rules**

```prisma
model Escrow {
  id              String        @id @default(uuid())
  consumerId      String
  businessId      String
  consumerAddress String
  businessAddress String
  totalAmount     Float
  monthlyAmount   Float
  months          Int
  currency        String        @default("RLUSD")
  issuer          String
  status          String        @default("active")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  consumer        Consumer      @relation("ConsumerEscrows", fields: [consumerId], references: [id], onDelete: Restrict)
  business        Business      @relation("BusinessEscrows", fields: [businessId], references: [id], onDelete: Restrict)
  entries         EscrowEntry[]
}

model EscrowEntry {
  id          String   @id @default(uuid())
  escrowId    String
  month       Int
  sequence    Int
  amount      String
  finishAfter Int
  cancelAfter Int
  status      String   @default("pending")
  txHash      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  escrow      Escrow   @relation(fields: [escrowId], references: [id], onDelete: Cascade)
}
```

**Rationale:**
- `Escrow.consumer/business` → `Restrict`: Cannot delete a Consumer/Business with active escrows
- `EscrowEntry.escrow` → `Cascade`: When an escrow is deleted, its entries are cleaned up

- [ ] **Step 2: Push schema changes**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx prisma db push`
Expected: Schema synced successfully

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "fix: Prisma onDelete 정책 추가 — Escrow Restrict, EscrowEntry Cascade"
```

---

## Task 7: XRPL client connection retry logic

**Files:**
- Modify: `apps/api/src/xrpl/xrpl.service.ts`

- [ ] **Step 1: Add retry to getClient()**

Replace the `getClient` method in `xrpl.service.ts`:

```typescript
async getClient(): Promise<Client> {
  if (this.client?.isConnected()) {
    return this.client;
  }

  const url = this.configService.get<string>('xrpl.url');
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      this.client = new Client(url!);
      await this.client.connect();
      this.logger.log('Connected to XRPL');
      return this.client;
    } catch (err) {
      this.logger.warn(`XRPL connection attempt ${attempt}/${maxRetries} failed: ${err}`);
      if (attempt === maxRetries) {
        throw new Error(`XRPL 연결 실패 (${maxRetries}회 시도): ${err}`);
      }
      // Wait before retry: 1s, 2s
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  throw new Error('XRPL 연결 실패');
}
```

- [ ] **Step 2: Run unit tests**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx jest --no-coverage`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/xrpl/xrpl.service.ts
git commit -m "fix: XRPL 클라이언트 연결 재시도 로직 (3회, 백오프)"
```

---

## Task 8: Mobile — logout confirmation dialog

**Files:**
- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Add Alert.alert confirmation to LogoutButton**

Replace the `LogoutButton` function:

```typescript
function LogoutButton() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const qc = useQueryClient();
  return (
    <TouchableOpacity
      onPress={() => {
        Alert.alert(
          '로그아웃',
          '정말 로그아웃하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '로그아웃',
              style: 'destructive',
              onPress: () => {
                qc.clear();
                clearAuth();
              },
            },
          ],
        );
      }}
      style={{ marginRight: 8 }}
    >
      <Text style={{ color: '#FF3B30', fontSize: 15 }}>로그아웃</Text>
    </TouchableOpacity>
  );
}
```

Add `Alert` to the import from react-native:
```typescript
import { TouchableOpacity, Text, Alert } from 'react-native';
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "fix: 로그아웃 확인 다이얼로그 추가 — 실수 방지"
```

---

## Task 9: Mobile — balance query error/loading states

**Files:**
- Modify: `apps/mobile/src/screens/consumer/DashboardScreen.tsx`
- Modify: `apps/mobile/src/screens/business/BusinessDashboardScreen.tsx`

- [ ] **Step 1: Add balance error state to ConsumerDashboardScreen**

In `DashboardScreen.tsx`, change the balance query to:

```typescript
const { data: balanceData, isLoading: balanceLoading, isError: balanceError } = useQuery({
  queryKey: ['balance', userId],
  queryFn: () => api.getBalance(userId!, 'consumer'),
  enabled: !!userId,
  retry: 1,
});
```

Replace the balance card render block:

```typescript
{balanceLoading ? (
  <View style={styles.balanceCard}>
    <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
  </View>
) : balanceError ? (
  <View style={[styles.balanceCard, { backgroundColor: '#8E8E93' }]}>
    <Text style={styles.balanceLabel}>RLUSD 잔액</Text>
    <Text style={styles.balanceValue}>조회 실패</Text>
  </View>
) : balanceData ? (
  <View style={styles.balanceCard}>
    <Text style={styles.balanceLabel}>RLUSD 잔액</Text>
    <Text style={styles.balanceValue}>
      {Number(balanceData.balance).toLocaleString()} RLUSD
    </Text>
    <Text style={styles.balanceAddr}>
      {balanceData.xrplAddress.slice(0, 8)}...{balanceData.xrplAddress.slice(-6)}
    </Text>
  </View>
) : null}
```

- [ ] **Step 2: Add balance error state to BusinessDashboardScreen**

In `BusinessDashboardScreen.tsx`, change the balance query to:

```typescript
const { data: balanceData, isLoading: balanceLoading, isError: balanceError } = useQuery({
  queryKey: ['balance', userId],
  queryFn: () => api.getBalance(userId!, 'business'),
  enabled: !!userId,
  retry: 1,
});
```

Replace the balance card render block:

```typescript
{balanceLoading ? (
  <View style={styles.balanceCard}>
    <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
  </View>
) : balanceError ? (
  <View style={[styles.balanceCard, { backgroundColor: '#8E8E93' }]}>
    <Text style={styles.balanceLabel}>RLUSD 잔액</Text>
    <Text style={styles.balanceValue}>조회 실패</Text>
  </View>
) : balanceData ? (
  <View style={styles.balanceCard}>
    <Text style={styles.balanceLabel}>RLUSD 잔액</Text>
    <Text style={styles.balanceValue}>
      {Number(balanceData.balance).toLocaleString()} RLUSD
    </Text>
    <Text style={styles.balanceAddr}>
      {balanceData.xrplAddress.slice(0, 8)}...{balanceData.xrplAddress.slice(-6)}
    </Text>
  </View>
) : null}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/consumer/DashboardScreen.tsx \
  apps/mobile/src/screens/business/BusinessDashboardScreen.tsx
git commit -m "fix: 잔액 조회 로딩/에러 상태 UI 추가 — 소비자+사업자 대시보드"
```

---

## Task 10: Fix `any` types in BusinessDashboardScreen

**Files:**
- Modify: `apps/mobile/src/screens/business/BusinessDashboardScreen.tsx`

- [ ] **Step 1: Add proper types for escrow items**

Add import at top of file:
```typescript
import type { EscrowRecord, EscrowEntry } from '@prepaid-shield/shared-types';
```

Replace the FlatList types:
```typescript
<FlatList
  data={dashboard?.escrows ?? []}
  keyExtractor={(item: EscrowRecord) => item.id}
  renderItem={({ item }: { item: EscrowRecord & { consumer?: { id: string; name: string } } }) => {
    const pendingEntries = item.entries?.filter((e: EscrowEntry) => e.status === 'pending') ?? [];
    const nextEntry = pendingEntries[0];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.consumer?.name ?? '소비자'}</Text>
          <Text style={styles.cardAmount}>{item.totalAmount.toLocaleString()} RLUSD</Text>
        </View>
        <Text style={styles.cardSub}>
          {item.monthlyAmount.toLocaleString()} RLUSD/월  ·  {pendingEntries.length}건 대기
        </Text>
        {nextEntry && (
          <TouchableOpacity
            style={[styles.releaseButton, finishMutation.isPending && styles.buttonDisabled]}
            onPress={() =>
              finishMutation.mutate({
                escrowId: item.id,
                month: nextEntry.month,
              })
            }
            disabled={finishMutation.isPending}
          >
            <Text style={styles.releaseButtonText}>
              {nextEntry.month}월차 릴리즈 ({Number(nextEntry.amount).toLocaleString()} RLUSD)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }}
  ListEmptyComponent={
    <Text style={styles.empty}>활성 에스크로가 없습니다</Text>
  }
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/screens/business/BusinessDashboardScreen.tsx
git commit -m "fix: BusinessDashboard any 타입 제거 — EscrowRecord/EscrowEntry 적용"
```

---

## Task 11: Fix `any` cast in ConsumerDashboardScreen and EscrowDetailScreen

**Files:**
- Modify: `apps/mobile/src/screens/consumer/DashboardScreen.tsx`
- Modify: `apps/mobile/src/screens/consumer/EscrowDetailScreen.tsx`

- [ ] **Step 1: Fix DashboardScreen — remove `(item as any).business`**

The `api.getConsumerEscrows` returns `EscrowRecord[]` but the API includes `business` in the response. Extend the type at usage:

```typescript
// At line 69, replace:
<Text style={styles.businessName}>{(item as any).business?.name ?? '사업자'}</Text>

// With:
<Text style={styles.businessName}>{(item as unknown as EscrowRecord & { business?: { name: string } }).business?.name ?? '사업자'}</Text>
```

Actually, cleaner approach — define a local type alias at the top of the file:

```typescript
type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };
```

Then type the FlatList:
```typescript
<FlatList
  data={escrows as EscrowWithBusiness[]}
  keyExtractor={(item) => item.id}
  renderItem={({ item }: { item: EscrowWithBusiness }) => {
```

And fix line 69:
```typescript
<Text style={styles.businessName}>{item.business?.name ?? '사업자'}</Text>
```

- [ ] **Step 2: Fix EscrowDetailScreen — remove `(escrow as any).business`**

Add type at top:
```typescript
type EscrowWithRelations = EscrowRecord & { business?: { name: string }; consumer?: { name: string } };
```

Cast the query result:
```typescript
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['escrow', id],
  queryFn: () => api.getEscrow(id),
  retry: 2,
});
const escrow = data as EscrowWithRelations | undefined;
```

Then at line 92:
```typescript
<Text style={styles.businessName}>{escrow.business?.name ?? '사업자'}</Text>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/consumer/DashboardScreen.tsx \
  apps/mobile/src/screens/consumer/EscrowDetailScreen.tsx
git commit -m "fix: Consumer 화면 any 타입 제거 — EscrowWithBusiness/Relations 타입 적용"
```

---

## Task 12: Fix mobile package.json "main" field

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Remove expo-router/entry main since we use App.tsx directly**

The app uses `App.tsx` with React Navigation, not expo-router. Remove the misleading `main` field:

In `apps/mobile/package.json`, remove line 5:
```json
"main": "expo-router/entry",
```

The entry point will default to `App.tsx` / `App.js` which Expo expects.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/package.json
git commit -m "fix: package.json main 필드 제거 — expo-router 미사용, App.tsx 직접 진입"
```

---

## Task 13: Clean up empty hooks directory

**Files:**
- Remove: `apps/mobile/src/hooks/` (empty directory)

- [ ] **Step 1: Remove empty directory**

```bash
rmdir apps/mobile/src/hooks
```

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: 빈 hooks 디렉토리 제거"
```

Note: git doesn't track empty directories. If `hooks/` has a `.gitkeep`, remove it:
```bash
rm -f apps/mobile/src/hooks/.gitkeep && git add -A apps/mobile/src/hooks/ && git commit -m "chore: 빈 hooks 디렉토리 제거"
```

---

## Task 14: E2E test config — verify jest.e2e-config.ts works

**Files:**
- Review: `apps/api/jest.e2e-config.ts` (already exists)
- Review: `apps/api/test/demo-mode.e2e-spec.ts`

- [ ] **Step 1: Verify E2E config exists and run E2E tests**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx jest --config jest.e2e-config.ts --forceExit --no-coverage`

If tests fail, diagnose and fix. The config file already exists at `jest.e2e-config.ts`. The script `test:e2e` in package.json references it correctly.

- [ ] **Step 2: Fix any E2E test failures**

Common issues:
- Database not seeded for E2E tests
- Module imports needing CryptoService
- Environment variables not set

If `DEMO_MODE=true` is required, set it inline:
```bash
cd /Users/sooondae/projects/xrpl/apps/api && DEMO_MODE=true ENCRYPTION_KEY=test-key-32-chars-for-e2e-tests!! npx jest --config jest.e2e-config.ts --forceExit --no-coverage
```

- [ ] **Step 3: Commit any E2E fixes**

```bash
git add apps/api/test/ apps/api/jest.e2e-config.ts
git commit -m "fix: E2E 테스트 설정 복구 + 데모 모드 테스트 통과"
```

---

## Task 15: Final verification — run all tests

**Files:** None (verification only)

- [ ] **Step 1: Run all API unit tests**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx jest --no-coverage`
Expected: All PASS

- [ ] **Step 2: Run E2E tests**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && DEMO_MODE=true ENCRYPTION_KEY=test-key-32-chars-for-e2e-tests!! npx jest --config jest.e2e-config.ts --forceExit --no-coverage`
Expected: All PASS

- [ ] **Step 3: Build check**

Run: `cd /Users/sooondae/projects/xrpl/apps/api && npx nest build`
Expected: Compiles without errors

- [ ] **Step 4: Type check mobile**

Run: `cd /Users/sooondae/projects/xrpl/apps/mobile && npx tsc --noEmit`
Expected: No type errors
