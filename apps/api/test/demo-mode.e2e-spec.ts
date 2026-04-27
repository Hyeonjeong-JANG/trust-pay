/**
 * 데모 모드 통합 테스트
 *
 * DEMO_MODE=true 상태에서 XrplService를 mock하지 않고 실행.
 * 실제 서비스 레이어를 통과하되 XRPL Testnet 연결 없이 전체 플로우 검증.
 *
 * 플로우: 사업자 등록 → 소비자 로그인 → 에스크로 생성 → 릴리즈 → 취소 → 대시보드
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('Demo Mode 통합 테스트 (XRPL 연결 없음)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let consumerId: string;
  let businessId: string;
  let escrowId: string;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);

    // Verify demo mode is active
    const config = moduleRef.get(ConfigService);
    expect(config.get('demoMode')).toBe(true);

    await app.init();
  });

  afterAll(async () => {
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
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('xrplAddress');
    expect(res.body).not.toHaveProperty('xrplSecret');
    expect(res.body.name).toBe('데모카페');
    businessId = res.body.id;
  });

  // ─── 2. 소비자 로그인 (자동 등록) ───
  it('소비자 로그인 — 최초 로그인 시 자동 등록 + 지갑 생성 (데모)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        phone: '010-7777-8888',
        role: 'consumer',
        name: '데모소비자',
      })
      .expect(201);

    expect(res.body).toEqual({
      userId: expect.any(String),
      role: 'consumer',
      name: '데모소비자',
    });
    consumerId = res.body.userId;
  });

  // ─── 3. 에스크로 생성 ───
  it('에스크로 생성 — 3개월 150,000 RLUSD (데모 모드: 월 2분)', async () => {
    const res = await request(app.getHttpServer())
      .post('/escrow')
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

    // Verify each entry has demo tx hash
    for (const entry of res.body.entries) {
      expect(entry.status).toBe('pending');
      expect(entry.txHash).toMatch(/^DEMO_ESCROW_/);
      expect(entry.finishAfter).toBeGreaterThan(0);
      expect(entry.cancelAfter).toBeGreaterThan(entry.finishAfter);
    }

    escrowId = res.body.id;
  });

  // ─── 4. 에스크로 상세 조회 ───
  it('에스크로 상세 조회 — 관계 데이터 포함', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/${escrowId}`)
      .expect(200);

    expect(res.body.id).toBe(escrowId);
    expect(res.body.business.name).toBe('데모카페');
    expect(res.body.consumer.name).toBe('데모소비자');
    expect(res.body.entries).toHaveLength(3);
  });

  // ─── 5. 소비자별 에스크로 목록 ───
  it('소비자별 에스크로 목록 조회', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/consumer/${consumerId}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(escrowId);
  });

  // ─── 6. Month 1 릴리즈 ───
  it('에스크로 릴리즈 — Month 1 (사업자가 월 대금 수령)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/escrow/${escrowId}/finish`)
      .send({ entryMonth: 1 })
      .expect(201);

    expect(res.body.txHash).toMatch(/^DEMO_FINISH_/);
  });

  it('릴리즈 후 상태 확인 — Month 1 released, 나머지 pending', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/${escrowId}`)
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
      .send({ entryMonth: 1 })
      .expect(400);

    expect(res.body.message).toContain('released');
  });

  // ─── 7. 에스크로 취소 ───
  it('에스크로 취소 — 남은 pending 항목 환불', async () => {
    const res = await request(app.getHttpServer())
      .post(`/escrow/${escrowId}/cancel`)
      .expect(201);

    expect(res.body.cancelled).toBe(2); // month 2, 3
  });

  it('취소 후 상태 확인 — cancelled, pending 없음', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/${escrowId}`)
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
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const biz of res.body) {
      expect(biz).not.toHaveProperty('xrplSecret');
      expect(biz).toHaveProperty('xrplAddress');
    }
  });

  // ─── 10. 사업자 로그인 ───
  it('사업자 로그인 — 등록된 사업자', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '010-5555-6666', role: 'business' })
      .expect(201);

    expect(res.body.role).toBe('business');
    expect(res.body.name).toBe('데모카페');
  });
});
