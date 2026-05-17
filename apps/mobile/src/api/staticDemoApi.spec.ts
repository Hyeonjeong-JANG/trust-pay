const handler = require('../../api/[...path].js');
const vercelConfig = require('../../../../vercel.json');
const fs = require('fs');
const path = require('path');

const mockBlobStorage = new Map<string, string>();
const mockPublicBlobStorage = new Map<string, string>();
const mockBlobUploadedAt = new Map<string, string>();

jest.mock('@vercel/blob', () => ({
  get: jest.fn(async () => {
    throw new Error('pathname get is unavailable for this linked Blob token');
  }),
  list: jest.fn(async ({ prefix, cursor, limit = 1000 } = {}) => {
    const start = Number(cursor || 0);
    const pathnames = Array.from(mockBlobStorage.keys())
      .filter((pathname) => !prefix || pathname.startsWith(prefix));
    const page = pathnames.slice(start, start + limit);
    const next = start + page.length;
    return {
      blobs: page.map((pathname) => ({
        pathname,
        url: `https://blob.test/${pathname}`,
        downloadUrl: `https://blob.test/${pathname}`,
        uploadedAt: mockBlobUploadedAt.get(pathname),
      })),
      cursor: next < pathnames.length ? String(next) : undefined,
      hasMore: next < pathnames.length,
    };
  }),
  put: jest.fn(async (pathname: string, body: string) => {
    mockBlobStorage.set(pathname, String(body));
    if (!mockPublicBlobStorage.has(pathname)) mockPublicBlobStorage.set(pathname, String(body));
    mockBlobUploadedAt.set(pathname, new Date(Date.now() + mockBlobUploadedAt.size).toISOString());
    return { pathname, url: `https://blob.test/${pathname}` };
  }),
}), { virtual: true });

function loadFreshHandler() {
  jest.resetModules();
  return require('../../api/[...path].js');
}

function createResponse() {
  const response = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(payload: string) {
      this.body = JSON.parse(payload);
    },
  };

  return response;
}

async function callApiWith(apiHandler: any, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = createResponse();
  const payload = body === undefined ? '' : JSON.stringify(body);
  const request = {
    method,
    url,
    headers,
    on(event: string, callback: (chunk?: string) => void) {
      if (event === 'data' && payload) callback(payload);
      if (event === 'end') callback();
      return request;
    },
  };
  await apiHandler(request, response);
  return response;
}

async function callApi(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return callApiWith(handler, method, url, body, headers);
}

function callAdminApi(method: string, url: string, body?: unknown) {
  return callApi(method, url, body, { 'x-admin-id': 'admin', 'x-admin-secret': 'admin1234' });
}

function isoDateToRippleTime(value: string) {
  const rippleEpoch = 946684800;
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 1000) - rippleEpoch;
}

function rippleTimeToIsoDate(value: number) {
  const rippleEpoch = 946684800;
  return new Date((value + rippleEpoch) * 1000).toISOString().slice(0, 10);
}

describe('static Demo API fixture', () => {
  it('routes nested API paths through a single Vercel demo function', () => {
    expect(vercelConfig.rewrites).toContainEqual({
      source: '/api/:path*',
      destination: '/api/demo?path=:path*',
    });
  });

  it('keeps only the catch-all root API shim so all demo API paths share one serverless function', () => {
    const apiRoot = path.resolve(__dirname, '../../../../api');
    const listJsFiles = (dir: string, prefix = ''): string[] => fs.readdirSync(dir).flatMap((name: string) => {
      const fullPath = path.join(dir, name);
      const relativePath = prefix ? `${prefix}/${name}` : name;
      return fs.statSync(fullPath).isDirectory() ? listJsFiles(fullPath, relativePath) : relativePath.endsWith('.js') ? [relativePath] : [];
    });

    expect(listJsFiles(apiRoot)).toEqual(['[...path].js']);
  });

  it('serves admin API requests after Vercel rewrites them to the single demo path', async () => {
    const dashboardResponse = await callAdminApi('GET', '/api/demo?path=admin/dashboard');
    const dashboard = dashboardResponse.body as any;

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboard.refundReviews.open).toBe(5);

    const reviewResponse = await callAdminApi('GET', '/api/demo?path=admin/refund-reviews&status=platform_review');
    const reviews = reviewResponse.body as any[];

    expect(reviewResponse.statusCode).toBe(200);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ status: 'platform_review' });
  });

  it('rejects unknown merchant QR codes instead of fabricating monthly payment details', async () => {
    const response = await callApi('GET', '/api/payment-requests?code=TP-999999');

    expect(response.statusCode).toBe(404);
    expect(response.body).toMatchObject({ message: 'Payment request not found' });
  });

  it('uses the public Testnet wallet addresses in demo balance and escrow payloads', async () => {
    const consumerBalanceResponse = await callApi('GET', '/api/consumer/00000000-0000-4000-a000-000000000001/balance');
    const businessBalanceResponse = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000020/balance');
    const escrowsResponse = await callAdminApi('GET', '/api/admin/escrows');
    const escrows = escrowsResponse.body as any[];
    const publicDemoEscrow = escrows.find((escrow) => escrow.id === '00000000-0000-4000-a000-000000000100');

    expect(consumerBalanceResponse.body).toMatchObject({ xrplAddress: 'r3mmH7k7tsShoMBxhyvjWxmJtKnbqrEYK6' });
    expect(businessBalanceResponse.body).toMatchObject({ xrplAddress: 'rwX7on8RojAX9uV3KqqENTWdmJKDwJe3aw' });
    expect(publicDemoEscrow).toMatchObject({
      consumerAddress: 'r3mmH7k7tsShoMBxhyvjWxmJtKnbqrEYK6',
      businessAddress: 'rwX7on8RojAX9uV3KqqENTWdmJKDwJe3aw',
      issuer: 'rNabsmcozdd6jAjDQdBjTdGNomgxH3dySP',
    });
  });

  it('keeps public Testnet wallet addresses after restoring persisted demo state', async () => {
    const originalFetch = globalThis.fetch;
    const legacyStatePath = 'trustpay-demo-state/legacy-wallets.json';
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    const legacyState = JSON.stringify({
      version: 1,
      savedAt: '2026-05-16T00:00:00.000Z',
      consumers: [
        {
          id: '00000000-0000-4000-a000-000000000001',
          name: '김민수',
          phone: '010-2000-0001',
          email: 'minsu@demo.com',
          xrplAddress: 'rDemoConsumer1234567890ABCDEF',
        },
      ],
      paymentRequests: [],
      escrows: [
        {
          id: 'legacy-wallet-escrow',
          consumerId: '00000000-0000-4000-a000-000000000001',
          businessId: '00000000-0000-4000-a000-000000000020',
          consumerAddress: 'rDemoConsumer1234567890ABCDEF',
          businessAddress: 'rDemoBusiness2GymABCDEF123456',
          totalAmount: 100,
          monthlyAmount: 100,
          months: 1,
          escrowType: 'monthly',
          currency: 'RLUSD',
          issuer: 'rDemoIssuerRLUSD000000000001',
          status: 'active',
          createdAt: '2026-05-16T00:00:00.000Z',
          updatedAt: '2026-05-16T00:00:00.000Z',
          entries: [],
        },
      ],
      chargeRequests: [],
      refundReviewRequests: [],
    });
    mockBlobStorage.set(legacyStatePath, legacyState);
    mockPublicBlobStorage.set(legacyStatePath, legacyState);
    mockBlobUploadedAt.set(legacyStatePath, '2026-05-16T00:00:00.000Z');
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const apiHandler = loadFreshHandler();
      const consumerBalanceResponse = await callApiWith(apiHandler, 'GET', '/api/consumer/00000000-0000-4000-a000-000000000001/balance');
      const escrowsResponse = await callApiWith(
        apiHandler,
        'GET',
        '/api/admin/escrows',
        undefined,
        { 'x-admin-id': 'admin', 'x-admin-secret': 'admin1234' },
      );
      const legacyEscrow = (escrowsResponse.body as any[]).find((escrow) => escrow.id === 'legacy-wallet-escrow');

      expect(consumerBalanceResponse.body).toMatchObject({ xrplAddress: 'r3mmH7k7tsShoMBxhyvjWxmJtKnbqrEYK6' });
      expect(legacyEscrow).toMatchObject({
        consumerAddress: 'r3mmH7k7tsShoMBxhyvjWxmJtKnbqrEYK6',
        businessAddress: 'rwX7on8RojAX9uV3KqqENTWdmJKDwJe3aw',
        issuer: 'rNabsmcozdd6jAjDQdBjTdGNomgxH3dySP',
      });
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('serves demo admin refund cases for every queue filter', async () => {
    const dashboardResponse = await callAdminApi('GET', '/api/admin/dashboard');
    const dashboard = dashboardResponse.body as any;

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboard.refundReviews).toMatchObject({
      open: 5,
      merchantResponseRequested: 1,
      merchantResponded: 1,
      platformInvestigation: 1,
    });

    const openResponse = await callAdminApi('GET', '/api/admin/refund-reviews');
    const openReviews = openResponse.body as any[];

    expect(openResponse.statusCode).toBe(200);
    expect(new Set(openReviews.map((review) => review.status))).toEqual(new Set([
      'platform_review',
      'merchant_response_requested',
      'merchant_responded',
      'merchant_review',
      'platform_investigation',
    ]));

    for (const status of [
      'platform_review',
      'merchant_response_requested',
      'merchant_responded',
      'merchant_review',
      'platform_investigation',
      'platform_approved',
      'rejected',
    ]) {
      const response = await callAdminApi('GET', `/api/admin/refund-reviews?status=${status}`);
      const reviews = response.body as any[];

      expect(response.statusCode).toBe(200);
      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toMatchObject({ status, escrow: { business: expect.any(Object), consumer: expect.any(Object) } });
    }
  });

  it('paginates demo admin list endpoints while keeping array responses', async () => {
    const businessesResponse = await callAdminApi('GET', '/api/admin/businesses?page=2&pageSize=2');
    const reviewsResponse = await callAdminApi('GET', '/api/admin/refund-reviews?page=1&pageSize=2');

    expect(businessesResponse.statusCode).toBe(200);
    expect(businessesResponse.body).toHaveLength(2);
    expect(reviewsResponse.statusCode).toBe(200);
    expect(reviewsResponse.body).toHaveLength(2);
  });

  it('serves chart-ready demo admin dashboard metrics', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T00:00:00.000Z'));

    try {
      const response = await callAdminApi('GET', '/api/admin/dashboard');
      const dashboard = response.body as any;

      expect(response.statusCode).toBe(200);
      expect(dashboard.refundReviews.byStatus).toEqual({
        platformReview: 1,
        waitingMerchant: 2,
        merchantResponded: 1,
        platformInvestigation: 1,
        resolved: 2,
      });
      expect(dashboard.refundReviews.slaRisks.slice(0, 2)).toEqual([
        expect.objectContaining({ businessName: '파워짐 피트니스', consumerName: '오하준', daysRemaining: 5, status: 'merchant_review' }),
        expect.objectContaining({ businessName: '크린토피아 역삼점', consumerName: '정다은', daysRemaining: 6, status: 'merchant_response_requested' }),
      ]);
      expect(dashboard.escrows).toMatchObject({
        active: 9,
        releasedAmount: 2100,
        pendingAmount: 1050,
        frozenByRefundReviewAmount: 1690,
        refundedAmount: 300,
      });
      expect(dashboard.recentEvents[0]).toMatchObject({
        type: 'merchant_responded',
        label: '사업자 답변 도착',
        businessName: '헤어살롱 루나',
        consumerName: '정다은',
        amount: 220,
        occurredAt: '2026-05-16T05:20:00.000Z',
      });
      expect(JSON.stringify(dashboard)).not.toContain('consumerReason');
      expect(JSON.stringify(dashboard)).not.toContain('photoDataUrls');
    } finally {
      jest.useRealTimers();
    }
  });

  it('serves varied demo customers across every bundled business dashboard', async () => {
    const businessesResponse = await callApi('GET', '/api/business');
    const businesses = businessesResponse.body as any[];

    expect(businesses.map((business) => business.name)).toEqual([
      '강남 블루보틀',
      '파워짐 피트니스',
      '헤어살롱 루나',
      '크린토피아 역삼점',
      '정상어학원',
    ]);

    const dashboardCases = [
      ['00000000-0000-4000-a000-000000000010', 2],
      ['00000000-0000-4000-a000-000000000020', 3],
      ['00000000-0000-4000-a000-000000000030', 2],
      ['00000000-0000-4000-a000-000000000040', 2],
      ['00000000-0000-4000-a000-000000000050', 2],
    ] as const;

    for (const [businessId, minimumCustomers] of dashboardCases) {
      const response = await callApi('GET', `/api/business/${businessId}/dashboard`);
      const dashboard = response.body as any;
      const customerNames = new Set(dashboard.escrows.map((escrow: any) => escrow.consumer.name));

      expect(response.statusCode).toBe(200);
      expect(customerNames.size).toBeGreaterThanOrEqual(minimumCustomers);
    }
  });

  it('includes merchant-visible refund reviews on bundled business dashboards', async () => {
    const response = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000020/dashboard');
    const dashboard = response.body as any;
    const refundEscrow = dashboard.escrows.find((escrow: any) => escrow.id === '00000000-0000-4000-a000-000000000700');
    const review = refundEscrow?.refundReviewRequests?.[0];

    expect(response.statusCode).toBe(200);
    expect(review).toMatchObject({
      id: '00000000-0000-4000-a000-000000004001',
      status: 'merchant_review',
      merchantNotice: '소비자가 남은 5개월분 환불 검토를 요청했습니다.',
    });
    expect(review).not.toHaveProperty('consumerReason');
    expect(review).not.toHaveProperty('photoDataUrls');
  });

  it('keeps consumer-created refund reviews visible to admin and merchant dashboards', async () => {
    const consumerHeaders = { authorization: 'Bearer demo-token-consumer-00000000-0000-4000-a000-000000000001' };
    const businessHeaders = { authorization: 'Bearer demo-token-business-00000000-0000-4000-a000-000000000020' };
    const reason = '2주째 헬스장을 열지 않아 환불 검토를 요청합니다.';
    const photoDataUrls = ['data:image/png;base64,ZmFrZQ=='];

    const createResponse = await callApi(
      'POST',
      '/api/demo?path=escrow/00000000-0000-4000-a000-000000000100/refund-review-requests',
      { reason, photoDataUrls },
      consumerHeaders,
    );
    const created = createResponse.body as any;

    expect(createResponse.statusCode).toBe(201);
    expect(created).toMatchObject({
      escrowId: '00000000-0000-4000-a000-000000000100',
      consumerId: '00000000-0000-4000-a000-000000000001',
      businessId: '00000000-0000-4000-a000-000000000020',
      status: 'platform_review',
      refundableAmount: 300,
      consumerReason: reason,
      photoDataUrls,
    });

    const adminResponse = await callAdminApi('GET', '/api/demo?path=admin/refund-reviews&status=platform_review');
    const adminReview = (adminResponse.body as any[]).find((review) => review.id === created.id);

    expect(adminResponse.statusCode).toBe(200);
    expect(adminReview).toMatchObject({ id: created.id, consumerReason: reason, escrow: { consumer: { name: '김민수' }, business: { name: '파워짐 피트니스' } } });

    const businessDashboardResponse = await callApi(
      'GET',
      '/api/demo?path=business/00000000-0000-4000-a000-000000000020/dashboard',
      undefined,
      businessHeaders,
    );
    const dashboard = businessDashboardResponse.body as any;
    const businessReview = dashboard.escrows
      .find((escrow: any) => escrow.id === '00000000-0000-4000-a000-000000000100')
      ?.refundReviewRequests?.find((review: any) => review.id === created.id);

    expect(businessDashboardResponse.statusCode).toBe(200);
    expect(businessReview).toMatchObject({ id: created.id, status: 'platform_review', refundableAmount: 300 });
    expect(businessReview).not.toHaveProperty('consumerReason');
    expect(businessReview).not.toHaveProperty('photoDataUrls');

    const merchantNotice = '영업 여부와 남은 이용권 처리 방안을 답변해주세요.';
    const requestMerchantResponse = await callAdminApi(
      'POST',
      `/api/demo?path=admin/refund-reviews/${created.id}/request-merchant-response`,
      { merchantNotice },
    );

    expect(requestMerchantResponse.statusCode).toBe(200);
    expect(requestMerchantResponse.body).toMatchObject({ id: created.id, status: 'merchant_response_requested', merchantNotice });

    const merchantResponse = await callApi(
      'POST',
      `/api/demo?path=escrow/refund-review-requests/${created.id}/merchant-response`,
      { response: '정상 영업 중이며 미사용 기간 처리 방안을 TrustPay에 전달합니다.' },
      businessHeaders,
    );

    expect(merchantResponse.statusCode).toBe(200);
    expect(merchantResponse.body).toMatchObject({ id: created.id, status: 'merchant_responded' });
    expect(merchantResponse.body).not.toHaveProperty('consumerReason');
    expect(merchantResponse.body).not.toHaveProperty('photoDataUrls');
  });

  it('matches digit-only demo phone login to the existing hyphenated consumer', async () => {
    const codeResponse = await callApi('POST', '/api/auth/request-code', {
      phone: '01020000001',
      role: 'consumer',
    });
    const loginResponse = await callApi('POST', '/api/auth/verify-code', {
      phone: '01020000001',
      role: 'consumer',
      code: '123456',
    });

    expect(codeResponse.body).toMatchObject({ isNewUser: false });
    expect(loginResponse.body).toMatchObject({
      userId: '00000000-0000-4000-a000-000000000001',
      name: '김민수',
      role: 'consumer',
    });
  });

  it('marks unknown consumer phones as new instead of falling back to a demo account', async () => {
    const codeResponse = await callApi('POST', '/api/auth/request-code', {
      phone: '01099990000',
      role: 'consumer',
    });
    const loginResponse = await callApi('POST', '/api/auth/verify-code', {
      phone: '01099990000',
      role: 'consumer',
      code: '123456',
    });
    const loginBody = loginResponse.body as any;

    expect(codeResponse.body).toMatchObject({ isNewUser: true });
    expect(loginBody.userId).not.toBe('00000000-0000-4000-a000-000000000001');
    expect(loginBody.name).toBe('소비자');
  });

  it('serves all Blue Bottle menu options from the products endpoint', async () => {
    const response = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000010/products');
    const products = response.body as any[];
    const cafePass = products.find((product) => product.id === '00000000-0000-4000-a000-000000001010');

    expect(response.statusCode).toBe(200);
    expect(cafePass.menuItems.map((item: any) => `${item.name}:${item.amount}`)).toEqual([
      '아메리카노:5',
      '브런치 세트:15',
      '드립백 세트:30',
      '오피스 커피 박스:50',
    ]);
  });

  it('serves Blue Bottle completed prepaid history as menu-based 5 RLUSD unit charges', async () => {
    const response = await callApi('GET', '/api/escrow/00000000-0000-4000-a000-000000000200');
    const escrow = response.body as any;

    expect(response.statusCode).toBe(200);
    expect(escrow.totalAmount).toBe(150);
    expect(escrow.monthlyAmount).toBe(5);
    expect(escrow.unitPrice).toBe(5);
    expect(escrow.months).toBe(30);
    expect(escrow.entries).toHaveLength(30);
    expect(escrow.entries.every((entry: any) => entry.amount === '5')).toBe(true);
    expect(escrow.chargeRequests.map((request: any) => `${request.menuName}:${request.amount}`)).toEqual([
      '아메리카노:5',
      '브런치 세트:15',
      '드립백 세트:30',
      '오피스 커피 박스:50',
      '오피스 커피 박스:50',
    ]);
  });

  it('serves Blue Bottle active prepaid usage as settled menu charges', async () => {
    const response = await callApi('GET', '/api/escrow/consumer/00000000-0000-4000-a000-000000000002');
    const escrows = response.body as any[];
    const cafePass = escrows.find((escrow) => escrow.id === '00000000-0000-4000-a000-000000000400');

    expect(response.statusCode).toBe(200);
    expect(cafePass.entries.filter((entry: any) => entry.status === 'released')).toHaveLength(8);
    expect(cafePass.chargeRequests.map((request: any) => `${request.menuName}:${request.amount}`)).toEqual([
      '아메리카노:5',
      '브런치 세트:15',
      '아메리카노:5',
      '브런치 세트:15',
    ]);
  });

  it('creates manual prepaid usage charge requests with business-entered amount', async () => {
    const response = await callApi('POST', '/api/escrow/00000000-0000-4000-a000-000000000400/charge-requests', {
      menuName: '직접 입력 이용금액',
      amount: 10,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({
      menuItemId: null,
      menuName: '직접 입력 이용금액',
      amount: 10,
      status: 'pending_approval',
    });
  });

  it('keeps usage charge approval state consistent across consumer, merchant, and admin views', async () => {
    const requestResponse = await callApi('POST', '/api/escrow/00000000-0000-4000-a000-000000000500/charge-requests', {
      menuName: '직접 입력 이용금액',
      amount: 10,
    });
    const request = requestResponse.body as any;
    const approveResponse = await callApi('POST', `/api/escrow/charge-requests/${request.id}/approve`);
    const consumerEscrowsResponse = await callApi('GET', '/api/escrow/consumer/00000000-0000-4000-a000-000000000001');
    const businessDashboardResponse = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000030/dashboard');
    const adminEscrowsResponse = await callAdminApi('GET', '/api/admin/escrows');

    const consumerEscrow = (consumerEscrowsResponse.body as any[]).find((escrow) => escrow.id === '00000000-0000-4000-a000-000000000500');
    const businessEscrow = (businessDashboardResponse.body as any).escrows.find((escrow: any) => escrow.id === '00000000-0000-4000-a000-000000000500');
    const adminEscrow = (adminEscrowsResponse.body as any[]).find((escrow) => escrow.id === '00000000-0000-4000-a000-000000000500');

    expect(requestResponse.statusCode).toBe(201);
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.body).toMatchObject({ id: request.id, status: 'settled' });
    const approvedEntryIds = JSON.parse(request.entryIds);
    for (const escrow of [consumerEscrow, businessEscrow, adminEscrow]) {
      expect(escrow.chargeRequests).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: request.id, status: 'settled' })]),
      );
      expect(escrow.entries.filter((entry: any) => approvedEntryIds.includes(entry.id))).toEqual(
        expect.arrayContaining(approvedEntryIds.map((id: string) => expect.objectContaining({ id, status: 'released' }))),
      );
    }
  });

  it('blocks demo monthly settlement while refund review is open', async () => {
    const response = await callApi('POST', '/api/escrow/00000000-0000-4000-a000-000000000700/finish', {
      entryMonth: 2,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({ message: '환불 검토가 진행 중인 보호 결제는 정산할 수 없습니다' });
  });

  it('creates and resolves merchant-originated QR payment requests', async () => {
    const createResponse = await callApi('POST', '/api/payment-requests', {
      businessId: '00000000-0000-4000-a000-000000000020',
      paymentAmount: 600,
      totalAmount: 600,
      months: 6,
      paymentModel: 'monthly',
      escrowType: 'monthly',
    });
    const created = createResponse.body as any;
    const lookupResponse = await callApi('GET', `/api/payment-requests?code=${created.code}`);
    const dashboardResponse = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000020/dashboard');
    const approvalResponse = await callApi('POST', '/api/escrow', {
      consumerId: '00000000-0000-4000-a000-000000000001',
      businessId: '00000000-0000-4000-a000-000000000020',
      paymentRequestCode: created.code,
      totalAmount: 600,
      months: 6,
    });
    const dashboardAfterApprovalResponse = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000020/dashboard');
    const dashboard = dashboardResponse.body as any;
    const dashboardAfterApproval = dashboardAfterApprovalResponse.body as any;

    expect(createResponse.statusCode).toBe(201);
    expect(created).toMatchObject({
      businessName: '파워짐 피트니스',
      paymentAmount: 600,
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      paymentModel: 'monthly',
      escrowType: 'monthly',
      status: 'pending',
    });
    expect(created.code).toMatch(/^TP-/);
    expect(lookupResponse.statusCode).toBe(200);
    expect(lookupResponse.body).toMatchObject({ code: created.code, businessName: '파워짐 피트니스' });
    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboard.pendingPaymentRequests).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: created.code, status: 'pending' })]),
    );
    expect(approvalResponse.statusCode).toBe(201);
    expect(dashboardAfterApproval.pendingPaymentRequests).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: created.code })]),
    );
  });

  it('resolves merchant-originated QR requests after a serverless cold start', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const createHandler = loadFreshHandler();
      const lookupHandler = loadFreshHandler();
      const approveHandler = loadFreshHandler();
      const createResponse = await callApiWith(createHandler, 'POST', '/api/payment-requests', {
        businessId: '00000000-0000-4000-a000-000000000020',
        paymentAmount: 600,
        totalAmount: 600,
        months: 6,
        paymentModel: 'monthly',
        escrowType: 'monthly',
      });
      const created = createResponse.body as any;
      const lookupResponse = await callApiWith(lookupHandler, 'GET', `/api/payment-requests?code=${created.code}`);
      const approvalResponse = await callApiWith(approveHandler, 'POST', '/api/escrow', {
        consumerId: '00000000-0000-4000-a000-000000000001',
        businessId: '00000000-0000-4000-a000-000000000020',
        paymentRequestCode: created.code,
        totalAmount: 600,
        months: 6,
      });
      const approvedCookie = String(approvalResponse.headers['Set-Cookie'] || approvalResponse.headers['set-cookie'] || '').split(';')[0];
      const dashboardHandler = loadFreshHandler();
      const consumerEscrowsResponse = await callApiWith(
        dashboardHandler,
        'GET',
        '/api/escrow/consumer/00000000-0000-4000-a000-000000000001',
        undefined,
        { cookie: approvedCookie },
      );
      const businessDashboardResponse = await callApiWith(
        dashboardHandler,
        'GET',
        '/api/business/00000000-0000-4000-a000-000000000020/dashboard',
        undefined,
        { cookie: approvedCookie },
      );
      const adminEscrowsResponse = await callApiWith(
        dashboardHandler,
        'GET',
        '/api/admin/escrows',
        undefined,
        { cookie: approvedCookie, 'x-admin-id': 'admin', 'x-admin-secret': 'admin1234' },
      );
      const adminDashboardResponse = await callApiWith(
        dashboardHandler,
        'GET',
        '/api/admin/dashboard',
        undefined,
        { cookie: approvedCookie, 'x-admin-id': 'admin', 'x-admin-secret': 'admin1234' },
      );
      const businessDashboard = businessDashboardResponse.body as any;
      const adminEscrows = adminEscrowsResponse.body as any[];
      const adminDashboard = adminDashboardResponse.body as any;

      expect(createResponse.statusCode).toBe(201);
      expect(created.code).toMatch(/^TP-\d{6}$/);
      expect(lookupResponse.statusCode).toBe(200);
      expect(lookupResponse.body).toMatchObject({ code: created.code, businessName: '파워짐 피트니스', status: 'pending' });
      expect(approvalResponse.statusCode).toBe(201);
      expect(approvalResponse.body).toMatchObject({ businessId: '00000000-0000-4000-a000-000000000020', status: 'active' });
      expect(approvedCookie).toBe(`trustpay_demo_approved_qr=${encodeURIComponent(`${created.code}|00000000-0000-4000-a000-000000000001`)}`);
      expect(consumerEscrowsResponse.statusCode).toBe(200);
      expect(consumerEscrowsResponse.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `demo-approved-${created.code}`,
            businessId: '00000000-0000-4000-a000-000000000020',
            totalAmount: 600,
            status: 'active',
          }),
        ]),
      );
      expect(businessDashboardResponse.statusCode).toBe(200);
      expect(businessDashboard.pendingPaymentRequests).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: created.code })]),
      );
      expect(businessDashboard.escrows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `demo-approved-${created.code}`,
            consumerId: '00000000-0000-4000-a000-000000000001',
            businessId: '00000000-0000-4000-a000-000000000020',
            status: 'active',
          }),
        ]),
      );
      expect(adminEscrowsResponse.statusCode).toBe(200);
      expect(adminEscrows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `demo-approved-${created.code}`,
            consumerId: '00000000-0000-4000-a000-000000000001',
            businessId: '00000000-0000-4000-a000-000000000020',
            status: 'active',
          }),
        ]),
      );
      expect(adminDashboardResponse.statusCode).toBe(200);
      expect(adminDashboard.escrows.active).toBeGreaterThanOrEqual(10);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('generates merchant QR codes from the highest persisted TP number to avoid direct-entry collisions', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(7);

    const persistedState = {
      version: 1,
      savedAt: '2026-05-17T10:00:00.000Z',
      consumers: [],
      paymentRequests: [
        {
          id: 'payment-request-existing-high-code',
          code: 'TP-000007',
          businessId: '00000000-0000-4000-a000-000000000020',
          businessName: '파워짐 피트니스',
          paymentModel: 'monthly',
          paymentAmount: 600,
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          escrowType: 'monthly',
          status: 'pending',
          createdAt: '2026-05-17T10:00:00.000Z',
        },
      ],
      escrows: [],
      chargeRequests: [],
      refundReviewRequests: [],
    };

    mockBlobStorage.set('trustpay-demo-state/high-code.json', JSON.stringify(persistedState));
    mockPublicBlobStorage.set('trustpay-demo-state/high-code.json', JSON.stringify(persistedState));
    mockBlobUploadedAt.set('trustpay-demo-state/high-code.json', '2026-05-17T10:00:00.000Z');

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const apiHandler = loadFreshHandler();
      const createResponse = await callApiWith(apiHandler, 'POST', '/api/payment-requests', {
        businessId: '00000000-0000-4000-a000-000000000020',
        paymentAmount: 300,
        totalAmount: 300,
        months: 3,
        paymentModel: 'monthly',
        escrowType: 'monthly',
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.body).toMatchObject({ code: 'TP-000008', status: 'pending' });
    } finally {
      dateNowSpy.mockRestore();
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('uses a timestamp floor for persistent QR codes when recent Blob state is stale', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1779014999999);

    const staleState = {
      version: 1,
      savedAt: '2026-05-17T10:00:00.000Z',
      consumers: [],
      paymentRequests: [
        {
          id: 'payment-request-stale-low-code',
          code: 'TP-000003',
          businessId: '00000000-0000-4000-a000-000000000020',
          businessName: '파워짐 피트니스',
          paymentModel: 'voucher',
          paymentAmount: 100,
          totalAmount: 100,
          monthlyAmount: null,
          months: null,
          escrowType: 'prepaid',
          unitPrice: 10,
          validityMonths: 3,
          status: 'pending',
          createdAt: '2026-05-17T10:00:00.000Z',
        },
      ],
      escrows: [],
      chargeRequests: [],
      refundReviewRequests: [],
    };

    mockBlobStorage.set('trustpay-demo-state/stale-low-code.json', JSON.stringify(staleState));
    mockPublicBlobStorage.set('trustpay-demo-state/stale-low-code.json', JSON.stringify(staleState));
    mockBlobUploadedAt.set('trustpay-demo-state/stale-low-code.json', '2026-05-17T10:00:00.000Z');

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const apiHandler = loadFreshHandler();
      const createResponse = await callApiWith(apiHandler, 'POST', '/api/payment-requests', {
        businessId: '00000000-0000-4000-a000-000000000020',
        paymentAmount: 100,
        totalAmount: 100,
        unitPrice: 10,
        validityMonths: 3,
        paymentModel: 'voucher',
        escrowType: 'prepaid',
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.body).toMatchObject({ code: 'TP-999999', status: 'pending' });
    } finally {
      dateNowSpy.mockRestore();
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('approves merchant QR checkout from submitted details when persisted QR state is temporarily unavailable', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const approveHandler = loadFreshHandler();
      const approvalResponse = await callApiWith(approveHandler, 'POST', '/api/escrow', {
        consumerId: '00000000-0000-4000-a000-000000000001',
        businessId: '00000000-0000-4000-a000-000000000020',
        paymentRequestCode: 'TP-123456',
        totalAmount: 300,
        months: 3,
      });
      const lookupHandler = loadFreshHandler();
      const lookupResponse = await callApiWith(lookupHandler, 'GET', '/api/payment-requests?code=TP-123456');

      expect(approvalResponse.statusCode).toBe(201);
      expect(approvalResponse.body).toMatchObject({
        id: 'demo-approved-TP-123456',
        businessId: '00000000-0000-4000-a000-000000000020',
        totalAmount: 300,
        monthlyAmount: 100,
        status: 'active',
      });
      expect(lookupResponse.statusCode).toBe(200);
      expect(lookupResponse.body).toMatchObject({ code: 'TP-123456', status: 'used' });
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('accepts merchant refund review responses from submitted context when persisted review state is temporarily unavailable', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const responseHandler = loadFreshHandler();
      const response = await callApiWith(
        responseHandler,
        'POST',
        '/api/escrow/refund-review-requests/demo-refund-review-1779016302244/merchant-response',
        {
          response: '현재 리모델링 중이며 다음 주부터 이용 가능합니다. 미사용분 환불 협의 가능합니다.',
          escrowId: '00000000-0000-4000-a000-000000000500',
          consumerId: '00000000-0000-4000-a000-000000000001',
          businessId: '00000000-0000-4000-a000-000000000020',
          refundableAmount: 100,
          merchantNotice: '영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
          merchantRespondBy: '2026-05-20T00:00:00.000Z',
          requestedAt: '2026-05-17T10:00:00.000Z',
        },
        { authorization: 'Bearer demo-token-business-00000000-0000-4000-a000-000000000020' },
      );
      const lookupHandler = loadFreshHandler();
      const detailResponse = await callApiWith(
        lookupHandler,
        'GET',
        '/api/admin/refund-reviews/demo-refund-review-1779016302244',
        undefined,
        { 'x-admin-id': 'admin', 'x-admin-secret': 'admin1234' },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: 'demo-refund-review-1779016302244',
        status: 'merchant_responded',
        businessId: '00000000-0000-4000-a000-000000000020',
        merchantResponse: '현재 리모델링 중이며 다음 주부터 이용 가능합니다. 미사용분 환불 협의 가능합니다.',
      });
      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.body).toMatchObject({ id: 'demo-refund-review-1779016302244', status: 'merchant_responded' });
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('resolves admin refund approval from submitted review context when persisted review state is temporarily unavailable', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const responseHandler = loadFreshHandler();
      const response = await callApiWith(
        responseHandler,
        'POST',
        '/api/admin/refund-reviews/demo-refund-review-admin-recover/resolve',
        {
          decision: 'approve',
          reason: '사업자 답변과 미사용 잔액 확인 후 환불 승인',
          escrowId: '00000000-0000-4000-a000-000000000500',
          consumerId: '00000000-0000-4000-a000-000000000001',
          businessId: '00000000-0000-4000-a000-000000000030',
          refundableAmount: 270,
          merchantNotice: '영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
          merchantResponse: '미사용분 환불 가능합니다.',
          merchantRespondBy: '2026-05-20T00:00:00.000Z',
          requestedAt: '2026-05-17T10:00:00.000Z',
        },
        { 'x-admin-id': 'admin', 'x-admin-secret': 'admin1234' },
      );
      const detailHandler = loadFreshHandler();
      const escrowResponse = await callApiWith(detailHandler, 'GET', '/api/escrow/00000000-0000-4000-a000-000000000500');
      const escrow = escrowResponse.body as any;

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ id: 'demo-refund-review-admin-recover', status: 'refunded' });
      expect(escrowResponse.statusCode).toBe(200);
      expect(escrow.status).toBe('cancelled');
      expect(escrow.refundReviewRequests).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'demo-refund-review-admin-recover', status: 'refunded' })]),
      );
      expect(escrow.entries).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'refunded', txHash: expect.stringMatching(/^DEMO_ADMIN_REFUND_/) })]),
      );
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('persists QR approval across fresh serverless instances without relying on cookies', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const parsedUrl = new URL(url);
        if (parsedUrl.searchParams.get('cache') === '0') {
          return {
            ok: false,
            status: 400,
            json: async () => ({}),
            text: async () => 'cache=0 is only available for private stores',
          } as Response;
        }
        const pathname = decodeURIComponent(parsedUrl.pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const createHandler = loadFreshHandler();
      const createResponse = await callApiWith(createHandler, 'POST', '/api/payment-requests', {
        businessId: '00000000-0000-4000-a000-000000000020',
        paymentAmount: 185.185185,
        totalAmount: 185.185185,
        months: 6,
        paymentModel: 'monthly',
        escrowType: 'monthly',
      });
      const created = createResponse.body as any;

      const approveHandler = loadFreshHandler();
      const approvalResponse = await callApiWith(approveHandler, 'POST', '/api/escrow', {
        consumerId: '00000000-0000-4000-a000-000000000001',
        businessId: '00000000-0000-4000-a000-000000000020',
        paymentRequestCode: created.code,
        totalAmount: 185.185185,
        months: 6,
      });

      const dashboardHandler = loadFreshHandler();
      const businessDashboardResponse = await callApiWith(
        dashboardHandler,
        'GET',
        '/api/business/00000000-0000-4000-a000-000000000020/dashboard',
      );
      const adminEscrowsResponse = await callApiWith(
        dashboardHandler,
        'GET',
        '/api/admin/escrows',
        undefined,
        { 'x-admin-id': 'admin', 'x-admin-secret': 'admin1234' },
      );
      const businessDashboard = businessDashboardResponse.body as any;
      const adminEscrows = adminEscrowsResponse.body as any[];

      expect(createResponse.statusCode).toBe(201);
      expect(created).toMatchObject({ paymentAmount: 185.185185, months: 6, status: 'pending' });
      expect(created.code).toMatch(/^TP-\d{6}$/);
      expect(approvalResponse.statusCode).toBe(201);
      expect(businessDashboardResponse.statusCode).toBe(200);
      expect(businessDashboard.pendingPaymentRequests).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: created.code })]),
      );
      expect(businessDashboard.escrows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `demo-approved-${created.code}`,
            consumerId: '00000000-0000-4000-a000-000000000001',
            businessId: '00000000-0000-4000-a000-000000000020',
            totalAmount: 185.185185,
            status: 'active',
          }),
        ]),
      );
      expect(adminEscrowsResponse.statusCode).toBe(200);
      expect(adminEscrows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `demo-approved-${created.code}`,
            consumerId: '00000000-0000-4000-a000-000000000001',
            businessId: '00000000-0000-4000-a000-000000000020',
            status: 'active',
          }),
        ]),
      );
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('merges recent persistent snapshots so stale pending QR snapshots do not hide approved voucher escrows', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    const baseState = {
      version: 1,
      savedAt: '2026-05-17T10:00:00.000Z',
      consumers: [
        {
          id: '00000000-0000-4000-a000-000000000001',
          name: '김민수',
          phone: '010-2000-0001',
          email: 'minsu@demo.com',
          xrplAddress: 'rDemoConsumer1234567890ABCDEF',
        },
      ],
      paymentRequests: [],
      escrows: [],
      chargeRequests: [],
      refundReviewRequests: [],
    };
    const approvedState = {
      ...baseState,
      savedAt: '2026-05-17T10:01:00.000Z',
      paymentRequests: [
        {
          id: 'payment-request-approved-race',
          code: 'TP-000003',
          businessId: '00000000-0000-4000-a000-000000000020',
          businessName: '파워짐 피트니스',
          paymentModel: 'voucher',
          paymentAmount: 66.666667,
          totalAmount: 74.074074,
          monthlyAmount: null,
          months: null,
          escrowType: 'prepaid',
          unitPrice: 7.407407,
          validityMonths: 3,
          validFrom: '2026-05-17',
          validUntil: '2026-08-17',
          status: 'used',
          createdAt: '2026-05-17T10:00:00.000Z',
        },
      ],
      escrows: [
        {
          id: 'demo-approved-TP-000003',
          consumerId: '00000000-0000-4000-a000-000000000001',
          businessId: '00000000-0000-4000-a000-000000000020',
          consumerAddress: 'rDemoConsumer1234567890ABCDEF',
          businessAddress: 'rDemoBusiness2GymABCDEF123456',
          totalAmount: 74.074074,
          monthlyAmount: 7.407407,
          months: 10,
          escrowType: 'prepaid',
          unitPrice: 7.407407,
          validityMonths: 3,
          validFrom: '2026-05-17',
          validUntil: '2026-08-17',
          currency: 'RLUSD',
          issuer: 'rDemoIssuerRLUSD000000000001',
          status: 'active',
          createdAt: '2026-05-17T10:01:00.000Z',
          updatedAt: '2026-05-17T10:01:00.000Z',
          entries: [{ id: 'race-entry-1', escrowId: 'demo-approved-TP-000003', month: 1, sequence: 1, amount: '7.407407', status: 'pending', txHash: null }],
        },
      ],
    };
    const stalePendingState = {
      ...baseState,
      savedAt: '2026-05-17T10:02:00.000Z',
      paymentRequests: [{ ...approvedState.paymentRequests[0], status: 'pending' }],
      escrows: [],
    };

    mockBlobStorage.set('trustpay-demo-state/approved-race.json', JSON.stringify(approvedState));
    mockPublicBlobStorage.set('trustpay-demo-state/approved-race.json', JSON.stringify(approvedState));
    mockBlobUploadedAt.set('trustpay-demo-state/approved-race.json', '2026-05-17T10:01:00.000Z');
    mockBlobStorage.set('trustpay-demo-state/stale-pending-race.json', JSON.stringify(stalePendingState));
    mockPublicBlobStorage.set('trustpay-demo-state/stale-pending-race.json', JSON.stringify(stalePendingState));
    mockBlobUploadedAt.set('trustpay-demo-state/stale-pending-race.json', '2026-05-17T10:02:00.000Z');

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const apiHandler = loadFreshHandler();
      const detailResponse = await callApiWith(apiHandler, 'GET', '/api/escrow/demo-approved-TP-000003');
      const dashboardResponse = await callApiWith(apiHandler, 'GET', '/api/business/00000000-0000-4000-a000-000000000020/dashboard');
      const lookupResponse = await callApiWith(apiHandler, 'GET', '/api/payment-requests?code=TP-000003');
      const chargeResponse = await callApiWith(apiHandler, 'POST', '/api/escrow/demo-approved-TP-000003/charge-requests', {
        menuName: '직접 입력 이용금액',
        amount: 7.407407,
      });
      const dashboard = dashboardResponse.body as any;

      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.body).toMatchObject({ id: 'demo-approved-TP-000003', escrowType: 'prepaid', status: 'active' });
      expect(lookupResponse.body).toMatchObject({ code: 'TP-000003', status: 'used' });
      expect(dashboard.pendingPaymentRequests).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'TP-000003' })]),
      );
      expect(dashboard.escrows).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'demo-approved-TP-000003' })]),
      );
      expect(chargeResponse.statusCode).toBe(201);
      expect(chargeResponse.body).toMatchObject({ escrowId: 'demo-approved-TP-000003', status: 'pending_approval' });
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('loads the newest persisted demo state beyond the first Blob list page', async () => {
    const originalFetch = globalThis.fetch;
    mockBlobStorage.clear();
    mockPublicBlobStorage.clear();
    mockBlobUploadedAt.clear();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

    const baseState = {
      version: 1,
      savedAt: '2026-05-16T00:00:00.000Z',
      consumers: [
        {
          id: '00000000-0000-4000-a000-000000000001',
          name: '김민수',
          phone: '010-2000-0001',
          email: 'minsu@demo.com',
          xrplAddress: 'rDemoConsumer1234567890ABCDEF',
        },
      ],
      paymentRequests: [],
      escrows: [],
      chargeRequests: [],
      refundReviewRequests: [],
    };
    for (let index = 0; index < 1000; index += 1) {
      const pathname = `trustpay-demo-state/stale-${String(index).padStart(4, '0')}.json`;
      mockBlobStorage.set(pathname, JSON.stringify(baseState));
      mockPublicBlobStorage.set(pathname, JSON.stringify(baseState));
      mockBlobUploadedAt.set(pathname, new Date(Date.UTC(2026, 4, 16, 0, 0, index)).toISOString());
    }

    const latestState = {
      ...baseState,
      savedAt: '2026-05-17T09:30:00.000Z',
      paymentRequests: [
        {
          id: 'payment-request-approval-pagination',
          code: 'TP-PAGED',
          businessId: '00000000-0000-4000-a000-000000000020',
          businessName: '파워짐 피트니스',
          paymentModel: 'voucher',
          paymentAmount: 100,
          totalAmount: 150,
          escrowType: 'prepaid',
          unitPrice: 15,
          validityMonths: 3,
          validFrom: '2026-05-17',
          validUntil: '2026-08-17',
          status: 'used',
          createdAt: '2026-05-17T09:00:00.000Z',
        },
      ],
      escrows: [
        {
          id: 'demo-approved-TP-PAGED',
          consumerId: '00000000-0000-4000-a000-000000000001',
          businessId: '00000000-0000-4000-a000-000000000020',
          consumerAddress: 'rDemoConsumer1234567890ABCDEF',
          businessAddress: 'rDemoBusiness2GymABCDEF123456',
          totalAmount: 150,
          monthlyAmount: 15,
          months: 10,
          escrowType: 'prepaid',
          unitPrice: 15,
          validityMonths: 3,
          validFrom: '2026-05-17',
          validUntil: '2026-08-17',
          currency: 'RLUSD',
          issuer: 'rDemoIssuerRLUSD000000000001',
          status: 'active',
          createdAt: '2026-05-17T09:30:00.000Z',
          updatedAt: '2026-05-17T09:30:00.000Z',
          entries: [{ id: 'paged-entry-1', escrowId: 'demo-approved-TP-PAGED', month: 1, sequence: 1, amount: '15', status: 'pending', txHash: null }],
        },
      ],
    };
    const latestPathname = 'trustpay-demo-state/latest-approval.json';
    mockBlobStorage.set(latestPathname, JSON.stringify(latestState));
    mockPublicBlobStorage.set(latestPathname, JSON.stringify(latestState));
    mockBlobUploadedAt.set(latestPathname, '2026-05-17T09:30:00.000Z');

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(url).pathname.slice(1));
        const body = mockPublicBlobStorage.get(pathname);
        return {
          ok: body !== undefined,
          status: body === undefined ? 404 : 200,
          json: async () => JSON.parse(body || '{}'),
          text: async () => body || '',
        } as Response;
      }
      if (originalFetch) return originalFetch(input);
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const apiHandler = loadFreshHandler();
      const businessDashboardResponse = await callApiWith(
        apiHandler,
        'GET',
        '/api/business/00000000-0000-4000-a000-000000000020/dashboard',
      );
      const dashboard = businessDashboardResponse.body as any;

      expect(businessDashboardResponse.statusCode).toBe(200);
      expect(dashboard.pendingPaymentRequests).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'TP-PAGED' })]),
      );
      expect(dashboard.escrows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'demo-approved-TP-PAGED', escrowType: 'prepaid', status: 'active' }),
        ]),
      );
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      mockBlobStorage.clear();
      mockPublicBlobStorage.clear();
      mockBlobUploadedAt.clear();
    }
  });

  it('cancels merchant-originated QR payment requests before customer approval', async () => {
    const businessHeaders = { authorization: 'Bearer demo-token-business-00000000-0000-4000-a000-000000000020' };
    const createResponse = await callApi('POST', '/api/payment-requests', {
      businessId: '00000000-0000-4000-a000-000000000020',
      paymentAmount: 720,
      totalAmount: 720,
      months: 6,
      paymentModel: 'monthly',
      escrowType: 'monthly',
    });
    const created = createResponse.body as any;
    const cancelResponse = await callApi(
      'POST',
      `/api/payment-requests/${created.id}/cancel`,
      undefined,
      businessHeaders,
    );
    const approvalResponse = await callApi('POST', '/api/escrow', {
      consumerId: '00000000-0000-4000-a000-000000000001',
      businessId: '00000000-0000-4000-a000-000000000020',
      paymentRequestCode: created.code,
      totalAmount: 720,
      months: 6,
    });
    const dashboardResponse = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000020/dashboard');
    const dashboard = dashboardResponse.body as any;

    expect(createResponse.statusCode).toBe(201);
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.body).toMatchObject({ id: created.id, status: 'cancelled' });
    expect(approvalResponse.statusCode).toBe(400);
    expect(approvalResponse.body).toMatchObject({ message: '이미 처리된 결제 QR입니다' });
    expect(dashboard.pendingPaymentRequests).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: created.code })]),
    );
  });

  it('creates monthly escrows from the approval date on calendar month boundaries', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-13T09:00:00.000Z'));

    try {
      const response = await callApi('POST', '/api/escrow', {
        consumerId: '00000000-0000-4000-a000-000000000001',
        businessId: '00000000-0000-4000-a000-000000000020',
        totalAmount: 111.111111,
        months: 5,
      });
      const escrow = response.body as any;

      expect(response.statusCode).toBe(201);
      expect(escrow.entries.map((entry: any) => rippleTimeToIsoDate(entry.finishAfter))).toEqual([
        '2026-05-13',
        '2026-06-13',
        '2026-07-13',
        '2026-08-13',
        '2026-09-13',
      ]);
      expect(escrow.entries.map((entry: any) => rippleTimeToIsoDate(entry.cancelAfter))).toEqual([
        '2026-06-13',
        '2026-07-13',
        '2026-08-13',
        '2026-09-13',
        '2026-10-13',
      ]);
      expect(escrow.entries.map((entry: any) => entry.status)).toEqual([
        'released',
        'pending',
        'pending',
        'pending',
        'pending',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('creates prepaid QR-approved escrows with merchant validity dates visible on the business dashboard', async () => {
    const createResponse = await callApi('POST', '/api/escrow', {
      consumerId: '00000000-0000-4000-a000-000000000002',
      businessId: '00000000-0000-4000-a000-000000000010',
      totalAmount: 100,
      escrowType: 'prepaid',
      unitPrice: 10,
      validityMonths: 4,
      validFrom: '2026-06-01',
      validUntil: '2026-09-15',
    });
    const escrow = createResponse.body as any;

    expect(createResponse.statusCode).toBe(201);
    expect(escrow).toMatchObject({
      consumerId: '00000000-0000-4000-a000-000000000002',
      businessId: '00000000-0000-4000-a000-000000000010',
      escrowType: 'prepaid',
      validFrom: '2026-06-01',
      validUntil: '2026-09-15',
    });
    expect(escrow.entries).toHaveLength(10);
    expect(new Set(escrow.entries.map((entry: any) => entry.finishAfter))).toEqual(new Set([isoDateToRippleTime('2026-06-01')]));
    expect(new Set(escrow.entries.map((entry: any) => entry.cancelAfter))).toEqual(new Set([isoDateToRippleTime('2026-09-15')]));

    const dashboardResponse = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000010/dashboard');
    const visibleEscrow = (dashboardResponse.body as any).escrows.find((item: any) => item.id === escrow.id);

    expect(dashboardResponse.statusCode).toBe(200);
    expect(visibleEscrow).toMatchObject({
      id: escrow.id,
      consumer: { name: '이서연' },
      validFrom: '2026-06-01',
      validUntil: '2026-09-15',
    });
  });

  it('executes demo admin refund approval by refunding pending escrow entries', async () => {
    const response = await callAdminApi(
      'POST',
      '/api/admin/refund-reviews/00000000-0000-4000-a000-000000004003/resolve',
      { decision: 'approve' },
    );
    const review = response.body as any;
    const consumerEscrowsResponse = await callApi('GET', '/api/escrow/consumer/00000000-0000-4000-a000-000000000002');
    const businessDashboardResponse = await callApi('GET', '/api/business/00000000-0000-4000-a000-000000000010/dashboard');
    const adminEscrowsResponse = await callAdminApi('GET', '/api/admin/escrows');
    const adminRefundedReviewsResponse = await callAdminApi('GET', '/api/admin/refund-reviews?status=refunded');

    const consumerEscrow = (consumerEscrowsResponse.body as any[]).find((escrow) => escrow.id === '00000000-0000-4000-a000-000000000400');
    const businessEscrow = (businessDashboardResponse.body as any).escrows.find((escrow: any) => escrow.id === '00000000-0000-4000-a000-000000000400');
    const adminEscrow = (adminEscrowsResponse.body as any[]).find((escrow) => escrow.id === '00000000-0000-4000-a000-000000000400');
    const refundedReview = (adminRefundedReviewsResponse.body as any[]).find((item) => item.id === '00000000-0000-4000-a000-000000004003');

    expect(response.statusCode).toBe(200);
    expect(review.status).toBe('refunded');
    expect(review.escrow.status).toBe('cancelled');
    expect(review.escrow.entries.filter((entry: any) => entry.status === 'pending')).toHaveLength(0);
    expect(review.escrow.entries.filter((entry: any) => entry.status === 'refunded')).toHaveLength(22);
    for (const escrow of [consumerEscrow, businessEscrow, adminEscrow]) {
      expect(escrow.status).toBe('cancelled');
      expect(escrow.entries.filter((entry: any) => entry.status === 'pending')).toHaveLength(0);
      expect(escrow.entries.filter((entry: any) => entry.status === 'refunded')).toHaveLength(22);
    }
    expect(refundedReview).toMatchObject({ id: '00000000-0000-4000-a000-000000004003', status: 'refunded' });
  });
});
