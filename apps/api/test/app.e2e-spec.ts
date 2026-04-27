import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { XrplService } from '../src/xrpl/xrpl.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Mock Wallet.fromSeed to avoid real XRPL seed validation
jest.mock('xrpl', () => ({
  Wallet: {
    fromSeed: jest.fn().mockReturnValue({
      classicAddress: 'rMockWallet',
      seed: 'sMockSeed',
    }),
  },
}));

describe('PrepaidShield E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Track created IDs for cleanup
  let consumerUserId: string;
  let businessId: string;
  let escrowId: string;

  const mockXrplService = {
    createWallet: jest.fn().mockResolvedValue({
      wallet: { classicAddress: 'rTestAddr' },
      address: 'rTestAddr_' + Math.random().toString(36).slice(2, 8),
      secret: 'sTestSecret',
    }),
    setTrustLine: jest.fn().mockResolvedValue('TRUST_TX'),
    createMonthlyEscrows: jest.fn().mockResolvedValue([
      { month: 1, sequence: 100, amount: '50000', finishAfter: 1000000, cancelAfter: 2000000, txHash: 'TX_M1' },
      { month: 2, sequence: 101, amount: '50000', finishAfter: 3000000, cancelAfter: 4000000, txHash: 'TX_M2' },
      { month: 3, sequence: 102, amount: '50000', finishAfter: 5000000, cancelAfter: 6000000, txHash: 'TX_M3' },
    ]),
    finishEscrow: jest.fn().mockResolvedValue('FINISH_TX'),
    cancelEscrow: jest.fn().mockResolvedValue('CANCEL_TX'),
    getClient: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    // Each createWallet call returns a unique address
    let addrCounter = 0;
    mockXrplService.createWallet.mockImplementation(async () => {
      addrCounter++;
      return {
        wallet: { classicAddress: `rAddr${addrCounter}` },
        address: `rAddr${addrCounter}`,
        secret: `sSecret${addrCounter}`,
      };
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(XrplService)
      .useValue(mockXrplService)
      .compile();

    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.escrowEntry.deleteMany();
    await prisma.escrow.deleteMany();
    await prisma.consumer.deleteMany();
    await prisma.business.deleteMany();
    await app.close();
  });

  // ─── 1. Business Registration ───
  describe('POST /business — 사업자 등록', () => {
    it('should register a new business', async () => {
      const res = await request(app.getHttpServer())
        .post('/business')
        .send({
          name: '테스트카페',
          category: '카페',
          address: '서울시 강남구 테헤란로 1',
          phone: '010-1111-2222',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('테스트카페');
      expect(res.body).not.toHaveProperty('xrplSecret');
      businessId = res.body.id;
    });

    it('should reject invalid registration', async () => {
      await request(app.getHttpServer())
        .post('/business')
        .send({ name: '' }) // missing required fields
        .expect(400);
    });
  });

  // ─── 2. Consumer Login (Auto-registration) ───
  describe('POST /auth/login — 소비자 자동 등록 로그인', () => {
    it('should auto-register and login a new consumer', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '010-3333-4444',
          role: 'consumer',
          name: '테스트소비자',
        })
        .expect(201);

      expect(res.body).toEqual({
        userId: expect.any(String),
        role: 'consumer',
        name: '테스트소비자',
      });
      consumerUserId = res.body.userId;
      expect(mockXrplService.createWallet).toHaveBeenCalled();
      expect(mockXrplService.setTrustLine).toHaveBeenCalled();
    });

    it('should return existing consumer on second login', async () => {
      mockXrplService.createWallet.mockClear();

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '010-3333-4444',
          role: 'consumer',
        })
        .expect(201);

      expect(res.body.userId).toBe(consumerUserId);
      expect(mockXrplService.createWallet).not.toHaveBeenCalled();
    });
  });

  // ─── 3. Business Login ───
  describe('POST /auth/login — 사업자 로그인', () => {
    it('should login existing business', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '010-1111-2222',
          role: 'business',
        })
        .expect(201);

      expect(res.body.role).toBe('business');
      expect(res.body.name).toBe('테스트카페');
    });

    it('should reject unregistered business', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '010-9999-0000',
          role: 'business',
        })
        .expect(400);

      expect(res.body.message).toContain('등록되지 않은 사업자');
    });
  });

  // ─── 4. Business List ───
  describe('GET /business — 사업자 목록 조회', () => {
    it('should return active businesses', async () => {
      const res = await request(app.getHttpServer())
        .get('/business')
        .set('x-user-id', consumerUserId)
        .set('x-user-role', 'consumer')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).not.toHaveProperty('xrplSecret');
    });
  });

  // ─── 5. Create Escrow ───
  describe('POST /escrow — 에스크로 생성', () => {
    it('should create escrow with monthly entries', async () => {
      const res = await request(app.getHttpServer())
        .post('/escrow')
        .set('x-user-id', consumerUserId)
        .set('x-user-role', 'consumer')
        .send({
          consumerId: consumerUserId,
          businessId,
          totalAmount: 150000,
          months: 3,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.totalAmount).toBe(150000);
      expect(res.body.monthlyAmount).toBe(50000);
      expect(res.body.entries).toHaveLength(3);
      expect(res.body.entries[0].status).toBe('pending');
      escrowId = res.body.id;
    });

    it('should reject with invalid consumerId (Zod validates UUID)', async () => {
      await request(app.getHttpServer())
        .post('/escrow')
        .set('x-user-id', 'test-user')
        .set('x-user-role', 'consumer')
        .send({
          consumerId: 'non-existent',
          businessId,
          totalAmount: 100000,
          months: 2,
        })
        .expect(400);
    });
  });

  // ─── 6. Get Escrow Detail ───
  describe('GET /escrow/:id — 에스크로 상세 조회', () => {
    it('should return escrow with entries and relations', async () => {
      const res = await request(app.getHttpServer())
        .get(`/escrow/${escrowId}`)
        .set('x-user-id', consumerUserId)
        .set('x-user-role', 'consumer')
        .expect(200);

      expect(res.body.id).toBe(escrowId);
      expect(res.body).toHaveProperty('entries');
      expect(res.body).toHaveProperty('business');
      expect(res.body).toHaveProperty('consumer');
    });

    it('should 404 for non-existent escrow', async () => {
      await request(app.getHttpServer())
        .get('/escrow/non-existent-id')
        .set('x-user-id', 'test-user')
        .set('x-user-role', 'consumer')
        .expect(404);
    });
  });

  // ─── 7. Consumer Escrows ───
  describe('GET /escrow/consumer/:id — 소비자 에스크로 목록', () => {
    it('should return escrows for consumer', async () => {
      const res = await request(app.getHttpServer())
        .get(`/escrow/consumer/${consumerUserId}`)
        .set('x-user-id', consumerUserId)
        .set('x-user-role', 'consumer')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('entries');
      expect(res.body[0]).toHaveProperty('business');
    });
  });

  // ─── 8. Finish Escrow Entry (Release) ───
  describe('POST /escrow/:id/finish — 에스크로 릴리즈', () => {
    it('should release month 1 entry', async () => {
      const res = await request(app.getHttpServer())
        .post(`/escrow/${escrowId}/finish`)
        .set('x-user-id', businessId)
        .set('x-user-role', 'business')
        .send({ entryMonth: 1 })
        .expect(201);

      expect(res.body).toHaveProperty('txHash', 'FINISH_TX');
    });

    it('should reject re-releasing month 1', async () => {
      await request(app.getHttpServer())
        .post(`/escrow/${escrowId}/finish`)
        .set('x-user-id', businessId)
        .set('x-user-role', 'business')
        .send({ entryMonth: 1 })
        .expect(400);
    });

    it('should verify entry status after release', async () => {
      const res = await request(app.getHttpServer())
        .get(`/escrow/${escrowId}`)
        .set('x-user-id', consumerUserId)
        .set('x-user-role', 'consumer')
        .expect(200);

      const entry1 = res.body.entries.find((e: any) => e.month === 1);
      const entry2 = res.body.entries.find((e: any) => e.month === 2);
      expect(entry1.status).toBe('released');
      expect(entry2.status).toBe('pending');
    });
  });

  // ─── 9. Cancel Escrow ───
  describe('POST /escrow/:id/cancel — 에스크로 취소', () => {
    it('should cancel remaining pending entries', async () => {
      const res = await request(app.getHttpServer())
        .post(`/escrow/${escrowId}/cancel`)
        .set('x-user-id', consumerUserId)
        .set('x-user-role', 'consumer')
        .expect(201);

      // month 1 was released, so only 2 pending entries should be cancelled
      expect(res.body.cancelled).toBe(2);
    });

    it('should verify escrow status is cancelled', async () => {
      const res = await request(app.getHttpServer())
        .get(`/escrow/${escrowId}`)
        .set('x-user-id', consumerUserId)
        .set('x-user-role', 'consumer')
        .expect(200);

      expect(res.body.status).toBe('cancelled');
      const pending = res.body.entries.filter((e: any) => e.status === 'pending');
      expect(pending).toHaveLength(0);
    });
  });

  // ─── 10. Business Dashboard ───
  describe('GET /business/:id/dashboard — 사업자 대시보드', () => {
    it('should return aggregated dashboard data', async () => {
      const res = await request(app.getHttpServer())
        .get(`/business/${businessId}/dashboard`)
        .set('x-user-id', businessId)
        .set('x-user-role', 'business')
        .expect(200);

      expect(res.body.business.name).toBe('테스트카페');
      expect(res.body).toHaveProperty('totalReceived');
      expect(res.body).toHaveProperty('totalPending');
      expect(res.body).toHaveProperty('activeEscrows');
      expect(res.body).toHaveProperty('escrows');
    });
  });
});
