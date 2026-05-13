const CONSUMER_ID = '00000000-0000-4000-a000-000000000001';
const CONSUMER_SEOYEON_ID = '00000000-0000-4000-a000-000000000002';
const BUSINESS_CAFE_ID = '00000000-0000-4000-a000-000000000010';
const BUSINESS_GYM_ID = '00000000-0000-4000-a000-000000000020';
const BUSINESS_SALON_ID = '00000000-0000-4000-a000-000000000030';
const BUSINESS_ACADEMY_ID = '00000000-0000-4000-a000-000000000050';
const PRODUCT_CAFE_PASS_ID = '00000000-0000-4000-a000-000000001010';
const PRODUCT_GYM_MEMBERSHIP_ID = '00000000-0000-4000-a000-000000001020';
const PRODUCT_SALON_PASS_ID = '00000000-0000-4000-a000-000000001030';
const MENU_CAFE_AMERICANO_ID = '00000000-0000-4000-a000-000000002011';
const MENU_CAFE_BRUNCH_ID = '00000000-0000-4000-a000-000000002012';
const MENU_CAFE_DRIP_BAG_ID = '00000000-0000-4000-a000-000000002013';
const MENU_CAFE_OFFICE_BOX_ID = '00000000-0000-4000-a000-000000002014';
const MENU_SALON_CUT_ID = '00000000-0000-4000-a000-000000002031';
const MENU_SALON_CLINIC_ID = '00000000-0000-4000-a000-000000002032';
const MENU_SALON_COLOR_ID = '00000000-0000-4000-a000-000000002033';
const CHARGE_CAFE_COMPLETED_AMERICANO_ID = '00000000-0000-4000-a000-000000003011';
const CHARGE_CAFE_COMPLETED_BRUNCH_ID = '00000000-0000-4000-a000-000000003012';
const CHARGE_CAFE_COMPLETED_DRIP_BAG_ID = '00000000-0000-4000-a000-000000003013';
const CHARGE_CAFE_COMPLETED_OFFICE_BOX_1_ID = '00000000-0000-4000-a000-000000003014';
const CHARGE_CAFE_COMPLETED_OFFICE_BOX_2_ID = '00000000-0000-4000-a000-000000003015';
const CHARGE_CAFE_ACTIVE_AMERICANO_1_ID = '00000000-0000-4000-a000-000000003021';
const CHARGE_CAFE_ACTIVE_BRUNCH_1_ID = '00000000-0000-4000-a000-000000003022';
const CHARGE_CAFE_ACTIVE_AMERICANO_2_ID = '00000000-0000-4000-a000-000000003023';
const CHARGE_CAFE_ACTIVE_BRUNCH_2_ID = '00000000-0000-4000-a000-000000003024';

const consumers = [
  {
    id: CONSUMER_ID,
    name: '김민수',
    phone: '010-2000-0001',
    email: 'minsu@demo.com',
    xrplAddress: 'rDemoConsumer1234567890ABCDEF',
  },
  {
    id: CONSUMER_SEOYEON_ID,
    name: '이서연',
    phone: '010-2000-0002',
    email: 'seoyeon@demo.com',
    xrplAddress: 'rDemoConsumer2345678901BCDEFG',
  },
];

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function phoneMatches(storedPhone, inputPhone) {
  const stored = normalizePhone(storedPhone);
  const input = normalizePhone(inputPhone);
  return Boolean(stored && input && stored === input);
}

function findConsumerByIdentifier(body) {
  return consumers.find((item) => (
    body.phone ? phoneMatches(item.phone, body.phone) : item.email === body.email
  ));
}

function findBusinessByIdentifier(body) {
  return businesses.find((item) => (
    body.phone ? phoneMatches(item.phone, body.phone) : item.email === body.email
  ));
}

function createDemoConsumer(body) {
  const phone = body.phone ? normalizePhone(body.phone) : undefined;
  const consumer = {
    id: `demo-consumer-${phone || Date.now()}`,
    name: body.name || '소비자',
    phone,
    email: body.email,
    xrplAddress: `rDemoConsumer${phone || Date.now()}`,
  };
  consumers.push(consumer);
  return consumer;
}

const businesses = [
  {
    id: BUSINESS_CAFE_ID,
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
    id: BUSINESS_SALON_ID,
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

const products = [
  {
    id: PRODUCT_CAFE_PASS_ID,
    businessId: BUSINESS_CAFE_ID,
    name: '커피 30잔 이용권',
    description: '음료와 브런치 메뉴를 5 RLUSD 단위로 차감하는 카페 선불권',
    escrowType: 'prepaid',
    totalAmount: 150,
    monthlyAmount: 5,
    months: 30,
    unitPrice: 5,
    validityMonths: 3,
    isActive: true,
    menuItems: [
      { id: MENU_CAFE_AMERICANO_ID, productId: PRODUCT_CAFE_PASS_ID, name: '아메리카노', amount: 5, isActive: true },
      { id: MENU_CAFE_BRUNCH_ID, productId: PRODUCT_CAFE_PASS_ID, name: '브런치 세트', amount: 15, isActive: true },
      { id: MENU_CAFE_DRIP_BAG_ID, productId: PRODUCT_CAFE_PASS_ID, name: '드립백 세트', amount: 30, isActive: true },
      { id: MENU_CAFE_OFFICE_BOX_ID, productId: PRODUCT_CAFE_PASS_ID, name: '오피스 커피 박스', amount: 50, isActive: true },
    ],
  },
  {
    id: PRODUCT_GYM_MEMBERSHIP_ID,
    businessId: BUSINESS_GYM_ID,
    name: '6개월 헬스 회원권',
    description: '매월 100 RLUSD가 정산되는 월정액 회원권',
    escrowType: 'monthly',
    totalAmount: 600,
    monthlyAmount: 100,
    months: 6,
    unitPrice: null,
    validityMonths: null,
    isActive: true,
    menuItems: [],
  },
  {
    id: PRODUCT_SALON_PASS_ID,
    businessId: BUSINESS_SALON_ID,
    name: '헤어살롱 루나 선불권',
    description: '커트, 클리닉, 염색을 메뉴 금액만큼 소비자 승인 후 차감합니다',
    escrowType: 'prepaid',
    totalAmount: 300,
    monthlyAmount: 10,
    months: 30,
    unitPrice: 10,
    validityMonths: 6,
    isActive: true,
    menuItems: [
      { id: MENU_SALON_CUT_ID, productId: PRODUCT_SALON_PASS_ID, name: '커트', amount: 30, isActive: true },
      { id: MENU_SALON_CLINIC_ID, productId: PRODUCT_SALON_PASS_ID, name: '클리닉', amount: 50, isActive: true },
      { id: MENU_SALON_COLOR_ID, productId: PRODUCT_SALON_PASS_ID, name: '염색', amount: 80, isActive: true },
    ],
  },
];

function entryIds(escrowId, start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => `${escrowId}-entry-${start + index}`);
}

function findMenuItem(productId, menuItemId) {
  return products.find((product) => product.id === productId)?.menuItems.find((menu) => menu.id === menuItemId) || null;
}

function makeSettledChargeRequest({ id, escrowId, consumerId = CONSUMER_ID, businessId, productId, menuItemId, menuName, amount, entries, approvedAt, txHash }) {
  const approvedDate = new Date(approvedAt);
  const requestedDate = new Date(approvedDate.getTime() - 3 * 60 * 1000);
  return {
    id,
    escrowId,
    consumerId,
    businessId,
    productId,
    menuItemId,
    menuName,
    amount,
    status: 'settled',
    entryIds: JSON.stringify(entries),
    requestedAt: requestedDate.toISOString(),
    approvedAt: approvedDate.toISOString(),
    settledAt: approvedDate.toISOString(),
    rejectedAt: null,
    txHash,
    menuItem: findMenuItem(productId, menuItemId),
  };
}

let chargeRequests = [
  makeSettledChargeRequest({
    id: CHARGE_CAFE_COMPLETED_AMERICANO_ID,
    escrowId: '00000000-0000-4000-a000-000000000200',
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_AMERICANO_ID,
    menuName: '아메리카노',
    amount: 5,
    entries: entryIds('00000000-0000-4000-a000-000000000200', 1, 1),
    approvedAt: '2026-05-03T02:03:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_011',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_COMPLETED_BRUNCH_ID,
    escrowId: '00000000-0000-4000-a000-000000000200',
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_BRUNCH_ID,
    menuName: '브런치 세트',
    amount: 15,
    entries: entryIds('00000000-0000-4000-a000-000000000200', 2, 4),
    approvedAt: '2026-05-05T03:12:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_012',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_COMPLETED_DRIP_BAG_ID,
    escrowId: '00000000-0000-4000-a000-000000000200',
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_DRIP_BAG_ID,
    menuName: '드립백 세트',
    amount: 30,
    entries: entryIds('00000000-0000-4000-a000-000000000200', 5, 10),
    approvedAt: '2026-05-18T06:20:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_013',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_COMPLETED_OFFICE_BOX_1_ID,
    escrowId: '00000000-0000-4000-a000-000000000200',
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_OFFICE_BOX_ID,
    menuName: '오피스 커피 박스',
    amount: 50,
    entries: entryIds('00000000-0000-4000-a000-000000000200', 11, 20),
    approvedAt: '2026-06-03T05:40:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_014',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_COMPLETED_OFFICE_BOX_2_ID,
    escrowId: '00000000-0000-4000-a000-000000000200',
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_OFFICE_BOX_ID,
    menuName: '오피스 커피 박스',
    amount: 50,
    entries: entryIds('00000000-0000-4000-a000-000000000200', 21, 30),
    approvedAt: '2026-06-24T05:25:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_015',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_ACTIVE_AMERICANO_1_ID,
    escrowId: '00000000-0000-4000-a000-000000000400',
    consumerId: CONSUMER_SEOYEON_ID,
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_AMERICANO_ID,
    menuName: '아메리카노',
    amount: 5,
    entries: entryIds('00000000-0000-4000-a000-000000000400', 1, 1),
    approvedAt: '2026-05-06T02:10:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_ACTIVE_021',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_ACTIVE_BRUNCH_1_ID,
    escrowId: '00000000-0000-4000-a000-000000000400',
    consumerId: CONSUMER_SEOYEON_ID,
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_BRUNCH_ID,
    menuName: '브런치 세트',
    amount: 15,
    entries: entryIds('00000000-0000-4000-a000-000000000400', 2, 4),
    approvedAt: '2026-05-09T03:25:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_ACTIVE_022',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_ACTIVE_AMERICANO_2_ID,
    escrowId: '00000000-0000-4000-a000-000000000400',
    consumerId: CONSUMER_SEOYEON_ID,
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_AMERICANO_ID,
    menuName: '아메리카노',
    amount: 5,
    entries: entryIds('00000000-0000-4000-a000-000000000400', 5, 5),
    approvedAt: '2026-05-15T01:50:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_ACTIVE_023',
  }),
  makeSettledChargeRequest({
    id: CHARGE_CAFE_ACTIVE_BRUNCH_2_ID,
    escrowId: '00000000-0000-4000-a000-000000000400',
    consumerId: CONSUMER_SEOYEON_ID,
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    menuItemId: MENU_CAFE_BRUNCH_ID,
    menuName: '브런치 세트',
    amount: 15,
    entries: entryIds('00000000-0000-4000-a000-000000000400', 6, 8),
    approvedAt: '2026-05-21T03:40:00Z',
    txHash: 'DEMO_TX_HASH_CAFE_ACTIVE_024',
  }),
  {
    id: '00000000-0000-4000-a000-000000003001',
    escrowId: '00000000-0000-4000-a000-000000000500',
    consumerId: CONSUMER_ID,
    businessId: BUSINESS_SALON_ID,
    productId: PRODUCT_SALON_PASS_ID,
    menuItemId: MENU_SALON_CUT_ID,
    menuName: '커트',
    amount: 30,
    status: 'settled',
    entryIds: JSON.stringify([
      '00000000-0000-4000-a000-000000000500-entry-1',
      '00000000-0000-4000-a000-000000000500-entry-2',
      '00000000-0000-4000-a000-000000000500-entry-3',
    ]),
    requestedAt: new Date('2026-05-10T09:00:00Z').toISOString(),
    approvedAt: new Date('2026-05-10T09:10:00Z').toISOString(),
    settledAt: new Date('2026-05-10T09:12:00Z').toISOString(),
    rejectedAt: null,
    txHash: 'DEMO_TX_HASH_SALON_CUT_SETTLED',
    menuItem: { id: MENU_SALON_CUT_ID, productId: PRODUCT_SALON_PASS_ID, name: '커트', amount: 30, isActive: true },
  },
  {
    id: '00000000-0000-4000-a000-000000003002',
    escrowId: '00000000-0000-4000-a000-000000000500',
    consumerId: CONSUMER_ID,
    businessId: BUSINESS_SALON_ID,
    productId: PRODUCT_SALON_PASS_ID,
    menuItemId: MENU_SALON_CLINIC_ID,
    menuName: '클리닉',
    amount: 50,
    status: 'pending_approval',
    entryIds: JSON.stringify([
      '00000000-0000-4000-a000-000000000500-entry-4',
      '00000000-0000-4000-a000-000000000500-entry-5',
      '00000000-0000-4000-a000-000000000500-entry-6',
      '00000000-0000-4000-a000-000000000500-entry-7',
      '00000000-0000-4000-a000-000000000500-entry-8',
    ]),
    requestedAt: new Date().toISOString(),
    approvedAt: null,
    settledAt: null,
    rejectedAt: null,
    txHash: null,
    menuItem: { id: MENU_SALON_CLINIC_ID, productId: PRODUCT_SALON_PASS_ID, name: '클리닉', amount: 50, isActive: true },
  },
];

let paymentRequests = [];

function createPaymentRequest(body) {
  const business = businesses.find((item) => item.id === body.businessId);
  if (!business) return null;
  const product = body.productId ? products.find((item) => item.id === body.productId) : null;
  const escrowType = product?.escrowType || body.escrowType || 'monthly';
  const totalAmount = product?.totalAmount || Number(body.totalAmount);
  const months = product?.months || body.months || null;
  const monthlyAmount = product?.monthlyAmount || body.monthlyAmount || (
    escrowType === 'monthly' && Number.isFinite(totalAmount) && Number(months) > 0
      ? Math.round((totalAmount / Number(months)) * 1_000_000) / 1_000_000
      : null
  );
  const request = {
    id: `payment-request-${Date.now()}`,
    code: `TP-${String(paymentRequests.length + 1).padStart(6, '0')}`,
    businessId: business.id,
    businessName: business.name,
    businessCategory: business.category,
    productId: product?.id || null,
    productName: product?.name || null,
    paymentModel: body.paymentModel || (escrowType === 'prepaid' ? 'voucher' : 'monthly'),
    paymentAmount: product?.totalAmount || body.paymentAmount || totalAmount,
    totalAmount,
    monthlyAmount,
    months,
    escrowType,
    unitPrice: product?.unitPrice || body.unitPrice || null,
    validityMonths: product?.validityMonths || body.validityMonths || null,
    validFrom: body.validFrom || null,
    validUntil: body.validUntil || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  paymentRequests = [request, ...paymentRequests];
  return request;
}

let escrows = [
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000100',
    businessId: BUSINESS_GYM_ID,
    productId: PRODUCT_GYM_MEMBERSHIP_ID,
    totalAmount: 600,
    monthlyAmount: 100,
    months: 6,
    status: 'active',
    entryStatuses: ['released', 'released', 'released', 'pending', 'pending', 'pending'],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000200',
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    totalAmount: 150,
    monthlyAmount: 5,
    months: 30,
    escrowType: 'prepaid',
    unitPrice: 5,
    validityMonths: 3,
    status: 'completed',
    entryStatuses: Array.from({ length: 30 }, () => 'released'),
    entryTxHashPrefix: 'DEMO_TX_HASH_CAFE_UNIT_COMPLETED',
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000300',
    businessId: BUSINESS_SALON_ID,
    productId: PRODUCT_SALON_PASS_ID,
    totalAmount: 400,
    monthlyAmount: 100,
    months: 4,
    escrowType: 'prepaid',
    unitPrice: 100,
    validityMonths: 4,
    status: 'cancelled',
    entryStatuses: ['released', 'refunded', 'refunded', 'refunded'],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000400',
    consumerId: CONSUMER_SEOYEON_ID,
    businessId: BUSINESS_CAFE_ID,
    productId: PRODUCT_CAFE_PASS_ID,
    totalAmount: 150,
    monthlyAmount: 5,
    months: 30,
    escrowType: 'prepaid',
    unitPrice: 5,
    validityMonths: 3,
    status: 'active',
    entryStatuses: [
      ...Array.from({ length: 8 }, () => 'released'),
      ...Array.from({ length: 22 }, () => 'pending'),
    ],
    entryTxHashPrefix: 'DEMO_TX_HASH_CAFE_PREPAID',
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000500',
    businessId: BUSINESS_SALON_ID,
    productId: PRODUCT_SALON_PASS_ID,
    totalAmount: 300,
    monthlyAmount: 10,
    months: 30,
    escrowType: 'prepaid',
    unitPrice: 10,
    validityMonths: 6,
    status: 'active',
    entryStatuses: [
      ...Array.from({ length: 3 }, () => 'released'),
      ...Array.from({ length: 27 }, () => 'pending'),
    ],
  }),
];

function rippleTimeFromNow(month) {
  const rippleEpoch = 946684800;
  const date = new Date();
  date.setMonth(date.getMonth() + month);
  return Math.floor(date.getTime() / 1000) - rippleEpoch;
}

function makeEscrow({ id, consumerId = CONSUMER_ID, businessId, productId = null, totalAmount, monthlyAmount, months, escrowType = 'monthly', unitPrice = null, validityMonths = null, status, entryStatuses, entryTxHashPrefix = null }) {
  const business = businesses.find((item) => item.id === businessId);
  const consumer = consumers.find((item) => item.id === consumerId) || consumers[0];
  const prepaidFinishAfter = rippleTimeFromNow(0);
  const prepaidCancelAfter = rippleTimeFromNow(validityMonths || 1);
  return {
    id,
    consumerId,
    businessId,
    productId,
    consumerAddress: consumer.xrplAddress,
    businessAddress: business.xrplAddress,
    totalAmount,
    monthlyAmount,
    months,
    escrowType,
    unitPrice,
    validityMonths,
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
      finishAfter: escrowType === 'prepaid' ? prepaidFinishAfter : rippleTimeFromNow(index + 1),
      cancelAfter: escrowType === 'prepaid' ? prepaidCancelAfter : rippleTimeFromNow(index + 2),
      status: entryStatus,
      txHash: entryStatus === 'pending' ? null : entryTxHashPrefix ? `${entryTxHashPrefix}_${index + 1}` : `DEMO_${entryStatus.toUpperCase()}_${id.slice(-3)}_${index + 1}`,
    })),
  };
}

function withRelations(escrow) {
  const product = products.find((item) => item.id === escrow.productId) || null;
  return {
    ...escrow,
    business: businesses.find((item) => item.id === escrow.businessId),
    consumer: consumers.find((item) => item.id === escrow.consumerId),
    product,
    chargeRequests: chargeRequests
      .filter((item) => item.escrowId === escrow.id)
      .map((item) => ({
        ...item,
        menuItem: product?.menuItems.find((menu) => menu.id === item.menuItemId) || item.menuItem || null,
      })),
  };
}

function parseEntryIds(request) {
  try {
    const parsed = JSON.parse(request.entryIds);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    const isNewUser = body.role === 'consumer' && !findConsumerByIdentifier(body);
    return send(res, 200, { delivery: 'demo', code: '123456', expiresInSeconds: 300, isNewUser });
  }

  if (req.method === 'POST' && path === '/auth/verify-code') {
    if (body.code !== '123456') return send(res, 400, { message: '인증코드가 올바르지 않습니다' });
    const user = body.role === 'business'
      ? findBusinessByIdentifier(body)
      : findConsumerByIdentifier(body) || createDemoConsumer(body);
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

  if (req.method === 'POST' && path === '/payment-requests') {
    const request = createPaymentRequest(body);
    if (!request || !Number.isFinite(request.totalAmount) || request.totalAmount <= 0) {
      return send(res, 400, { message: '결제 QR 요청 정보를 확인해주세요' });
    }
    return send(res, 201, request);
  }

  if (req.method === 'GET' && parts[0] === 'payment-requests' && parts[1]) {
    const code = decodeURIComponent(parts[1]).toUpperCase();
    const request = paymentRequests.find((item) => item.code === code);
    return request ? send(res, 200, request) : send(res, 404, { message: 'Payment request not found' });
  }

  if (req.method === 'GET' && path === '/payment-requests') {
    const code = (url.searchParams.get('code') || '').toUpperCase();
    const request = paymentRequests.find((item) => item.code === code);
    return request ? send(res, 200, request) : send(res, 404, { message: 'Payment request not found' });
  }

  if (req.method === 'GET' && parts[0] === 'business' && parts[2] === 'balance') {
    const business = businesses.find((item) => item.id === parts[1]);
    return send(res, 200, { xrplAddress: business?.xrplAddress ?? '', balance: '10000.00' });
  }

  if (req.method === 'GET' && parts[0] === 'business' && parts[2] === 'products') {
    return send(res, 200, products.filter((item) => item.businessId === parts[1] && item.isActive));
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
    const product = products.find((item) => item.id === body.productId);
    const escrowType = product?.escrowType || body.escrowType || 'monthly';
    const totalAmount = product?.totalAmount || body.totalAmount;
    const unitPrice = product?.unitPrice || body.unitPrice;
    const validityMonths = product?.validityMonths || body.validityMonths;
    const months = product?.months || body.months;
    const isPrepaid = escrowType === 'prepaid';
    const entryCount = isPrepaid ? totalAmount / unitPrice : months;
    const monthlyAmount = isPrepaid ? unitPrice : totalAmount / months;
    const escrow = makeEscrow({
      id: `demo-created-${Date.now()}`,
      businessId: body.businessId,
      productId: product?.id || null,
      totalAmount,
      monthlyAmount,
      months: entryCount,
      escrowType: isPrepaid ? 'prepaid' : 'monthly',
      unitPrice: isPrepaid ? unitPrice : null,
      validityMonths: isPrepaid ? validityMonths : null,
      status: 'active',
      entryStatuses: Array.from({ length: entryCount }, () => 'pending'),
    });
    escrows = [escrow, ...escrows];
    return send(res, 201, withRelations(escrow));
  }

  if (req.method === 'POST' && parts[0] === 'escrow' && parts[2] === 'charge-requests') {
    const escrow = escrows.find((item) => item.id === parts[1]);
    if (!escrow) return send(res, 404, { message: 'Escrow not found' });
    const product = products.find((item) => item.id === escrow.productId);
    const menuItem = body.menuItemId
      ? product?.menuItems.find((item) => item.id === body.menuItemId)
      : null;
    if (body.menuItemId && !menuItem) return send(res, 404, { message: 'Menu item not found' });

    const requestAmount = Number(menuItem?.amount ?? body.amount);
    const requestMenuName = menuItem?.name ?? body.menuName;
    if (!requestMenuName || !Number.isFinite(requestAmount) || requestAmount <= 0) {
      return send(res, 400, { message: '차감 요청 금액을 확인해주세요' });
    }

    const requiredEntryCount = requestAmount / escrow.monthlyAmount;
    const reservedEntryIds = new Set(
      chargeRequests
        .filter((item) => item.escrowId === escrow.id && item.status === 'pending_approval')
        .flatMap(parseEntryIds),
    );
    const availableEntries = escrow.entries.filter((entry) => entry.status === 'pending' && !reservedEntryIds.has(entry.id));
    if (!Number.isInteger(requiredEntryCount) || availableEntries.length < requiredEntryCount) {
      return send(res, 400, { message: '차감 가능한 이용권 잔액이 부족합니다' });
    }

    const selectedEntryIds = availableEntries.slice(0, requiredEntryCount).map((entry) => entry.id);
    const request = {
      id: `demo-charge-${Date.now()}`,
      escrowId: escrow.id,
      consumerId: escrow.consumerId,
      businessId: escrow.businessId,
      productId: escrow.productId,
      menuItemId: menuItem?.id ?? null,
      menuName: requestMenuName,
      amount: requestAmount,
      status: 'pending_approval',
      entryIds: JSON.stringify(selectedEntryIds),
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      settledAt: null,
      rejectedAt: null,
      txHash: null,
      menuItem,
    };
    chargeRequests = [request, ...chargeRequests];
    return send(res, 201, request);
  }

  if (req.method === 'POST' && parts[0] === 'escrow' && parts[1] === 'charge-requests' && parts[3] === 'approve') {
    const request = chargeRequests.find((item) => item.id === parts[2]);
    if (!request || request.status !== 'pending_approval') return send(res, 400, { message: '승인 가능한 차감 요청이 없습니다' });
    const escrow = escrows.find((item) => item.id === request.escrowId);
    const txHashes = [];
    parseEntryIds(request).forEach((entryId, index) => {
      const entry = escrow?.entries.find((item) => item.id === entryId);
      if (entry && entry.status === 'pending') {
        entry.status = 'released';
        entry.txHash = `DEMO_CHARGE_FINISH_${Date.now()}_${index + 1}`;
        txHashes.push(entry.txHash);
      }
    });
    if (escrow?.entries.every((item) => item.status === 'released')) escrow.status = 'completed';
    request.status = 'settled';
    request.approvedAt = new Date().toISOString();
    request.settledAt = request.approvedAt;
    request.txHash = txHashes.join(',');
    return send(res, 200, request);
  }

  if (req.method === 'POST' && parts[0] === 'escrow' && parts[1] === 'charge-requests' && parts[3] === 'reject') {
    const request = chargeRequests.find((item) => item.id === parts[2]);
    if (!request || request.status !== 'pending_approval') return send(res, 400, { message: '거절 가능한 차감 요청이 없습니다' });
    request.status = 'rejected';
    request.rejectedAt = new Date().toISOString();
    return send(res, 200, request);
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
