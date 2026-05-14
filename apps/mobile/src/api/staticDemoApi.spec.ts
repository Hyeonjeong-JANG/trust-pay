const handler = require('../../api/[...path].js');

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

async function callApi(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
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
  await handler(request, response);
  return response;
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
});
