/**
 * 데모 모드 통합 테스트
 *
 * DEMO_MODE=true 상태에서 XrplService를 mock하지 않고 실행.
 * 실제 서비스 레이어를 통과하되 XRPL Testnet 연결 없이 전체 플로우 검증.
 *
 * 플로우: 사업자 등록 → 소비자 로그인 → 에스크로 생성 → 릴리즈 → 취소 → 대시보드
 */
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { configureHttpApp } from '../src/http-app.config';

function expectNoWalletSecret(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('xrplSecret');
  expect(serialized).not.toContain('sMock');
  expect(serialized).not.toContain('sDemo');
}

describe('Demo Mode 통합 테스트 (XRPL 연결 없음)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  let consumerId: string;
  let consumerToken: string;
  let businessId: string;
  let businessToken: string;
  let escrowId: string;

  async function loginWithDemoOtp(data: {
    phone?: string;
    email?: string;
    role: 'consumer' | 'business';
    name?: string;
  }) {
    const codeRes = await request(app.getHttpServer())
      .post('/auth/request-code')
      .send(data)
      .expect(201);

    expect(codeRes.body.code).toBe('123456');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify-code')
      .send({ ...data, code: codeRes.body.code })
      .expect(201);

    expect(loginRes.body.token).toEqual(expect.any(String));
    expectNoWalletSecret(loginRes.body);
    return loginRes.body;
  }

  function auth(token: string) {
    return `Bearer ${token}`;
  }

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(app);
    prisma = moduleRef.get(PrismaService);

    // Verify demo mode is active
    const config = moduleRef.get(ConfigService);
    expect(config.get('demoMode')).toBe(true);

    await app.init();
  });

  afterAll(async () => {
    await prisma.chargeRequest.deleteMany();
    await prisma.refundReviewRequest.deleteMany();
    await prisma.escrowEntry.deleteMany();
    await prisma.escrow.deleteMany();
    await prisma.consumer.deleteMany();
    await prisma.business.deleteMany();
    await app.close();
    delete process.env.DEMO_MODE;
  });

  // ─── 1. 사업자 등록 ───
  it('사업자 등록 — XRPL 지갑 자동 생성 (데모)', async () => {
    const res = await request(app.getHttpServer())
      .post('/business')
      .send({
        name: '데모카페',
        category: '카페',
        address: '서울시 강남구 역삼로 1',
        phone: '010-5555-6666',
        registrationNumber: '1234567890',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('xrplAddress');
    expect(res.body).not.toHaveProperty('xrplSecret');
    expectNoWalletSecret(res.body);
    expect(res.body.name).toBe('데모카페');
    expect(res.body.registrationVerificationStatus).toBe('demo_verified');
    businessId = res.body.id;
  });

  // ─── 2. 소비자 로그인 (자동 등록) ───
  it('소비자 로그인 — 최초 로그인 시 자동 등록 + 지갑 생성 (데모)', async () => {
    const body = await loginWithDemoOtp({
      phone: '010-7777-8888',
      role: 'consumer',
      name: '데모소비자',
    });

    expect(body).toEqual({
      userId: expect.any(String),
      role: 'consumer',
      name: '데모소비자',
      token: expect.any(String),
      isNewUser: true,
    });
    consumerId = body.userId;
    consumerToken = body.token;
  });

  it('사업자 로그인 — 등록된 사업자', async () => {
    const body = await loginWithDemoOtp({ phone: '010-5555-6666', role: 'business' });

    expect(body.role).toBe('business');
    expect(body.name).toBe('데모카페');
    businessToken = body.token;
  });

  // ─── 3. 에스크로 생성 ───
  it('에스크로 생성 — 3개월 150,000 RLUSD', async () => {
    const res = await request(app.getHttpServer())
      .post('/escrow')
      .set('Authorization', auth(consumerToken))
      .send({
        consumerId,
        businessId,
        totalAmount: 150000,
        months: 3,
      })
      .expect(201);

    expect(res.body.totalAmount).toBe(150000);
    expect(res.body.monthlyAmount).toBe(50000);
    expect(res.body.entries).toHaveLength(3);
    expect(res.body.status).toBe('active');

    const entries = res.body.entries.sort((a: any, b: any) => a.month - b.month);
    expect(entries[0].status).toBe('released');
    expect(entries[0].txHash).toMatch(/^DEMO_FINISH_/);
    expect(entries[1].status).toBe('pending');
    expect(entries[2].status).toBe('pending');

    for (const entry of entries) {
      expect(entry.finishAfter).toBeGreaterThan(0);
      expect(entry.cancelAfter).toBeGreaterThan(entry.finishAfter);
    }

    escrowId = res.body.id;
  });

  // ─── 4. 에스크로 상세 조회 ───
  it('에스크로 상세 조회 — 관계 데이터 포함', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/${escrowId}`)
      .set('Authorization', auth(consumerToken))
      .expect(200);

    expect(res.body.id).toBe(escrowId);
    expect(res.body.business.name).toBe('데모카페');
    expect(res.body.consumer.name).toBe('데모소비자');
    expect(res.body.entries).toHaveLength(3);
    expectNoWalletSecret(res.body);
  });

  // ─── 5. 소비자별 에스크로 목록 ───
  it('소비자별 에스크로 목록 조회', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/consumer/${consumerId}`)
      .set('Authorization', auth(consumerToken))
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(escrowId);
    expectNoWalletSecret(res.body);
  });

  // ─── 6. Month 1 자동 릴리즈 ───
  it('생성 후 상태 확인 — Month 1 released, 나머지 pending', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/${escrowId}`)
      .set('Authorization', auth(consumerToken))
      .expect(200);

    const entries = res.body.entries.sort((a: any, b: any) => a.month - b.month);
    expect(entries[0].status).toBe('released');
    expect(entries[1].status).toBe('pending');
    expect(entries[2].status).toBe('pending');
    expect(res.body.status).toBe('active');
  });

  it('중복 릴리즈 방지 — 이미 릴리즈된 항목 거부', async () => {
    const res = await request(app.getHttpServer())
      .post(`/escrow/${escrowId}/finish`)
      .set('Authorization', auth(businessToken))
      .send({ entryMonth: 1 })
      .expect(400);

    expect(res.body.message).toContain('released');
  });

  // ─── 7. 에스크로 취소 ───
  it('에스크로 취소 — 남은 pending 항목 환불', async () => {
    const res = await request(app.getHttpServer())
      .post(`/escrow/${escrowId}/cancel`)
      .set('Authorization', auth(consumerToken))
      .expect(201);

    expect(res.body.cancelled).toBe(2); // month 2, 3
  });

  it('취소 후 상태 확인 — cancelled, pending 없음', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/${escrowId}`)
      .set('Authorization', auth(consumerToken))
      .expect(200);

    expect(res.body.status).toBe('cancelled');
    const entries = res.body.entries.sort((a: any, b: any) => a.month - b.month);
    expect(entries[0].status).toBe('released');
    expect(entries[1].status).toBe('refunded');
    expect(entries[2].status).toBe('refunded');
  });

  // ─── 8. 사업자 대시보드 ───
  it('사업자 대시보드 — 수령/대기 금액 집계', async () => {
    const res = await request(app.getHttpServer())
      .get(`/business/${businessId}/dashboard`)
      .set('Authorization', auth(businessToken))
      .expect(200);

    expect(res.body.business.name).toBe('데모카페');
    expect(res.body.totalReceived).toBe(50000); // month 1 released
    expect(res.body.totalPending).toBe(0); // all refunded or released
    expect(res.body.activeEscrows).toBe(0); // cancelled
  });

  // ─── 9. 사업자 목록 ───
  it('사업자 목록 — xrplSecret 미노출', async () => {
    const res = await request(app.getHttpServer())
      .get('/business')
      .set('Authorization', auth(consumerToken))
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const biz of res.body) {
      expect(biz).not.toHaveProperty('xrplSecret');
      expect(biz).toHaveProperty('xrplAddress');
    }
    expectNoWalletSecret(res.body);
  });

  // ─── 10. 사업자 세션 확인 ───
  it('사업자 세션 — 서명 토큰으로 보호 API 접근', async () => {
    const res = await request(app.getHttpServer())
      .get(`/business/${businessId}/dashboard`)
      .set('Authorization', auth(businessToken))
      .expect(200);

    expect(res.body.business.id).toBe(businessId);
  });
});
