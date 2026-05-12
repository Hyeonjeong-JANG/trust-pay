const CONSUMER_ID = '00000000-0000-4000-a000-000000000001';
const BUSINESS_GYM_ID = '00000000-0000-4000-a000-000000000020';
const BUSINESS_ACADEMY_ID = '00000000-0000-4000-a000-000000000050';

const consumers = [
  {
    id: CONSUMER_ID,
    name: '김민수',
    phone: '010-2000-0001',
    email: 'minsu@demo.com',
    xrplAddress: 'rDemoConsumer1234567890ABCDEF',
  },
];

const businesses = [
  {
    id: '00000000-0000-4000-a000-000000000010',
    name: '강남 블루보틀',
    category: '카페',
    address: '서울시 강남구 테헤란로 152',
    phone: '010-1000-0001',
    email: 'cafe@demo.com',
    xrplAddress: 'rDemoBusiness1CafeABCDEF12345',
    isActive: true,
  },
  {
    id: BUSINESS_GYM_ID,
    name: '파워짐 피트니스',
    category: '헬스장',
    address: '서울시 서초구 서초대로 100',
    phone: '010-1000-0002',
    email: 'gym@demo.com',
    xrplAddress: 'rDemoBusiness2GymABCDEF123456',
    isActive: true,
  },
  {
    id: '00000000-0000-4000-a000-000000000030',
    name: '헤어살롱 루나',
    category: '미용실',
    address: '서울시 마포구 홍대입구 22',
    phone: '010-1000-0003',
    email: 'salon@demo.com',
    xrplAddress: 'rDemoBusiness3SalonBCDEF12345',
    isActive: true,
  },
  {
    id: BUSINESS_ACADEMY_ID,
    name: '정상어학원',
    category: '학원',
    address: '서울시 송파구 올림픽로 300',
    phone: '010-1000-0005',
    email: 'academy@demo.com',
    xrplAddress: 'rDemoBusiness5AcademyEF12345',
    isActive: true,
  },
];

let escrows = [
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000100',
    businessId: BUSINESS_GYM_ID,
    totalAmount: 600,
    monthlyAmount: 100,
    months: 6,
    status: 'active',
    entryStatuses: ['released', 'released', 'released', 'pending', 'pending', 'pending'],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000200',
    businessId: '00000000-0000-4000-a000-000000000010',
    totalAmount: 450,
    monthlyAmount: 150,
    months: 3,
    status: 'completed',
    entryStatuses: ['released', 'released', 'released'],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000300',
    businessId: '00000000-0000-4000-a000-000000000030',
    totalAmount: 400,
    monthlyAmount: 100,
    months: 4,
    status: 'cancelled',
    entryStatuses: ['released', 'refunded', 'refunded', 'refunded'],
  }),
];

function rippleTimeFromNow(month) {
  const rippleEpoch = 946684800;
  const date = new Date();
  date.setMonth(date.getMonth() + month);
  return Math.floor(date.getTime() / 1000) - rippleEpoch;
}

function makeEscrow({ id, businessId, totalAmount, monthlyAmount, months, status, entryStatuses }) {
  const business = businesses.find((item) => item.id === businessId);
  return {
    id,
    consumerId: CONSUMER_ID,
    businessId,
    consumerAddress: consumers[0].xrplAddress,
    businessAddress: business.xrplAddress,
    totalAmount,
    monthlyAmount,
    months,
    currency: 'RLUSD',
    issuer: 'rDemoIssuerRLUSD000000000001',
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: entryStatuses.map((entryStatus, index) => ({
      id: `${id}-entry-${index + 1}`,
      escrowId: id,
      month: index + 1,
      sequence: Number(id.slice(-3)) * 10 + index + 1,
      amount: String(monthlyAmount),
      finishAfter: rippleTimeFromNow(index + 1),
      cancelAfter: rippleTimeFromNow(index + 2),
      status: entryStatus,
      txHash: entryStatus === 'pending' ? null : `DEMO_${entryStatus.toUpperCase()}_${id.slice(-3)}_${index + 1}`,
    })),
  };
}

function withRelations(escrow) {
  return {
    ...escrow,
    business: businesses.find((item) => item.id === escrow.businessId),
    consumer: consumers.find((item) => item.id === escrow.consumerId),
  };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 200, {});
  }

  const url = new URL(req.url, 'https://trustpay.demo');
  const path = url.pathname.replace(/^\/api/, '');
  const parts = path.split('/').filter(Boolean);
  const body = req.method === 'POST' ? await parseBody(req) : {};

  if (req.method === 'POST' && path === '/auth/request-code') {
    return send(res, 200, { delivery: 'demo', code: '123456', expiresInSeconds: 300 });
  }

  if (req.method === 'POST' && path === '/auth/verify-code') {
    if (body.code !== '123456') return send(res, 400, { message: '인증코드가 올바르지 않습니다' });
    const user = body.role === 'business'
      ? businesses.find((item) => item.phone === body.phone || item.email === body.email)
      : consumers.find((item) => item.phone === body.phone || item.email === body.email) || consumers[0];
    if (!user) return send(res, 400, { message: '등록되지 않은 계정입니다' });
    return send(res, 200, {
      userId: user.id,
      role: body.role,
      name: user.name,
      token: `demo-token-${body.role}-${user.id}`,
    });
  }

  if (req.method === 'GET' && path === '/business') {
    return send(res, 200, businesses);
  }

  if (req.method === 'GET' && parts[0] === 'business' && parts[2] === 'balance') {
    const business = businesses.find((item) => item.id === parts[1]);
    return send(res, 200, { xrplAddress: business?.xrplAddress ?? '', balance: '10000.00' });
  }

  if (req.method === 'GET' && parts[0] === 'business' && parts[2] === 'dashboard') {
    const businessId = parts[1];
    const scoped = escrows.filter((item) => item.businessId === businessId).map(withRelations);
    return send(res, 200, {
      business: businesses.find((item) => item.id === businessId),
      totalReceived: scoped.reduce((sum, escrow) => sum + escrow.entries.filter((entry) => entry.status === 'released').length * escrow.monthlyAmount, 0),
      totalPending: scoped.reduce((sum, escrow) => sum + escrow.entries.filter((entry) => entry.status === 'pending').length * escrow.monthlyAmount, 0),
      activeEscrows: scoped.filter((item) => item.status === 'active').length,
      escrows: scoped,
    });
  }

  if (req.method === 'GET' && parts[0] === 'business' && parts[1]) {
    return send(res, 200, businesses.find((item) => item.id === parts[1]));
  }

  if (req.method === 'GET' && parts[0] === 'consumer' && parts[2] === 'balance') {
    return send(res, 200, { xrplAddress: consumers[0].xrplAddress, balance: '10000.00' });
  }

  if (req.method === 'GET' && parts[0] === 'escrow' && parts[1] === 'consumer') {
    return send(res, 200, escrows.filter((item) => item.consumerId === parts[2]).map(withRelations));
  }

  if (req.method === 'GET' && parts[0] === 'escrow' && parts[1]) {
    const escrow = escrows.find((item) => item.id === parts[1]);
    return escrow ? send(res, 200, withRelations(escrow)) : send(res, 404, { message: 'Escrow not found' });
  }

  if (req.method === 'POST' && path === '/escrow') {
    const monthlyAmount = body.totalAmount / body.months;
    const escrow = makeEscrow({
      id: `demo-created-${Date.now()}`,
      businessId: body.businessId,
      totalAmount: body.totalAmount,
      monthlyAmount,
      months: body.months,
      status: 'active',
      entryStatuses: Array.from({ length: body.months }, () => 'pending'),
    });
    escrows = [escrow, ...escrows];
    return send(res, 201, withRelations(escrow));
  }

  if (req.method === 'POST' && parts[0] === 'escrow' && parts[2] === 'finish') {
    const escrow = escrows.find((item) => item.id === parts[1]);
    const entry = escrow?.entries.find((item) => item.month === body.entryMonth && item.status === 'pending');
    if (!entry) return send(res, 400, { message: '정산 가능한 월차가 없습니다' });
    entry.status = 'released';
    entry.txHash = `DEMO_FINISH_${Date.now()}`;
    if (escrow.entries.every((item) => item.status === 'released')) escrow.status = 'completed';
    return send(res, 200, { txHash: entry.txHash });
  }

  if (req.method === 'POST' && parts[0] === 'escrow' && parts[2] === 'cancel') {
    const escrow = escrows.find((item) => item.id === parts[1]);
    if (!escrow) return send(res, 404, { message: 'Escrow not found' });
    let cancelled = 0;
    escrow.entries.forEach((entry) => {
      if (entry.status === 'pending') {
        entry.status = 'refunded';
        entry.txHash = `DEMO_CANCEL_${Date.now()}_${entry.month}`;
        cancelled += 1;
      }
    });
    escrow.status = 'cancelled';
    return send(res, 200, { cancelled });
  }

  return send(res, 404, { message: 'Not found' });
};
