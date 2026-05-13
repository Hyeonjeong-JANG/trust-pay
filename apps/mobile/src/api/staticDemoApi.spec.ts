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

async function callApi(method: string, url: string, body?: unknown) {
  const response = createResponse();
  const payload = body === undefined ? '' : JSON.stringify(body);
  const request = {
    method,
    url,
    on(event: string, callback: (chunk?: string) => void) {
      if (event === 'data' && payload) callback(payload);
      if (event === 'end') callback();
      return request;
    },
  };
  await handler(request, response);
  return response;
}

describe('static Demo API fixture', () => {
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
      paymentAmount: 500,
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      paymentModel: 'monthly',
      escrowType: 'monthly',
    });
    const created = createResponse.body as any;
    const lookupResponse = await callApi('GET', `/api/payment-requests?code=${created.code}`);

    expect(createResponse.statusCode).toBe(201);
    expect(created).toMatchObject({
      businessName: '파워짐 피트니스',
      paymentAmount: 500,
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
});
