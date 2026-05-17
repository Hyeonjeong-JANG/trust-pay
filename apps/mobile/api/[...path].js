const CONSUMER_ID = '00000000-0000-4000-a000-000000000001';
const CONSUMER_SEOYEON_ID = '00000000-0000-4000-a000-000000000002';
const CONSUMER_JIHUN_ID = '00000000-0000-4000-a000-000000000003';
const CONSUMER_YUNA_ID = '00000000-0000-4000-a000-000000000004';
const CONSUMER_HAJUN_ID = '00000000-0000-4000-a000-000000000005';
const CONSUMER_DAEUN_ID = '00000000-0000-4000-a000-000000000006';
const BUSINESS_CAFE_ID = '00000000-0000-4000-a000-000000000010';
const BUSINESS_GYM_ID = '00000000-0000-4000-a000-000000000020';
const BUSINESS_SALON_ID = '00000000-0000-4000-a000-000000000030';
const BUSINESS_LAUNDRY_ID = '00000000-0000-4000-a000-000000000040';
const BUSINESS_ACADEMY_ID = '00000000-0000-4000-a000-000000000050';
const PRODUCT_CAFE_PASS_ID = '00000000-0000-4000-a000-000000001010';
const PRODUCT_GYM_MEMBERSHIP_ID = '00000000-0000-4000-a000-000000001020';
const PRODUCT_SALON_PASS_ID = '00000000-0000-4000-a000-000000001030';
const PRODUCT_LAUNDRY_PASS_ID = '00000000-0000-4000-a000-000000001040';
const PRODUCT_ACADEMY_COURSE_ID = '00000000-0000-4000-a000-000000001050';
const MENU_CAFE_AMERICANO_ID = '00000000-0000-4000-a000-000000002011';
const MENU_CAFE_BRUNCH_ID = '00000000-0000-4000-a000-000000002012';
const MENU_CAFE_DRIP_BAG_ID = '00000000-0000-4000-a000-000000002013';
const MENU_CAFE_OFFICE_BOX_ID = '00000000-0000-4000-a000-000000002014';
const MENU_SALON_CUT_ID = '00000000-0000-4000-a000-000000002031';
const MENU_SALON_CLINIC_ID = '00000000-0000-4000-a000-000000002032';
const MENU_SALON_COLOR_ID = '00000000-0000-4000-a000-000000002033';
const MENU_LAUNDRY_SHIRTS_ID = '00000000-0000-4000-a000-000000002041';
const MENU_LAUNDRY_DRY_CLEANING_ID = '00000000-0000-4000-a000-000000002042';
const MENU_LAUNDRY_BEDDING_ID = '00000000-0000-4000-a000-000000002043';
const CHARGE_CAFE_COMPLETED_AMERICANO_ID = '00000000-0000-4000-a000-000000003011';
const CHARGE_CAFE_COMPLETED_BRUNCH_ID = '00000000-0000-4000-a000-000000003012';
const CHARGE_CAFE_COMPLETED_DRIP_BAG_ID = '00000000-0000-4000-a000-000000003013';
const CHARGE_CAFE_COMPLETED_OFFICE_BOX_1_ID = '00000000-0000-4000-a000-000000003014';
const CHARGE_CAFE_COMPLETED_OFFICE_BOX_2_ID = '00000000-0000-4000-a000-000000003015';
const CHARGE_CAFE_ACTIVE_AMERICANO_1_ID = '00000000-0000-4000-a000-000000003021';
const CHARGE_CAFE_ACTIVE_BRUNCH_1_ID = '00000000-0000-4000-a000-000000003022';
const CHARGE_CAFE_ACTIVE_AMERICANO_2_ID = '00000000-0000-4000-a000-000000003023';
const CHARGE_CAFE_ACTIVE_BRUNCH_2_ID = '00000000-0000-4000-a000-000000003024';
const CHARGE_SALON_DAEUN_COLOR_ID = '00000000-0000-4000-a000-000000003033';
const CHARGE_LAUNDRY_JIHUN_SHIRTS_ID = '00000000-0000-4000-a000-000000003041';
const CHARGE_LAUNDRY_JIHUN_DRY_CLEANING_ID = '00000000-0000-4000-a000-000000003042';
const CHARGE_LAUNDRY_DAEUN_BEDDING_ID = '00000000-0000-4000-a000-000000003043';
const REFUND_REVIEW_GYM_HAJUN_ID = '00000000-0000-4000-a000-000000004001';
const REFUND_REVIEW_LAUNDRY_DAEUN_ID = '00000000-0000-4000-a000-000000004002';
const REFUND_REVIEW_CAFE_PLATFORM_ID = '00000000-0000-4000-a000-000000004003';
const REFUND_REVIEW_SALON_RESPONDED_ID = '00000000-0000-4000-a000-000000004004';
const REFUND_REVIEW_ACADEMY_INVESTIGATION_ID = '00000000-0000-4000-a000-000000004005';
const REFUND_REVIEW_SALON_APPROVED_ID = '00000000-0000-4000-a000-000000004006';
const REFUND_REVIEW_ACADEMY_REJECTED_ID = '00000000-0000-4000-a000-000000004007';
const OPEN_REFUND_REVIEW_STATUSES = ['platform_review', 'merchant_response_requested', 'merchant_responded', 'merchant_review', 'platform_investigation'];
const WAITING_MERCHANT_STATUSES = new Set(['merchant_response_requested', 'merchant_review']);
const ACTIVE_REFUND_REVIEW_STATUSES = new Set([
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'merchant_review',
  'merchant_disputed',
  'platform_investigation',
  'closure_suspected',
  'closure_confirmed',
  'auto_approved',
  'platform_approved',
]);
const TERMINAL_REFUND_REVIEW_STATUSES = new Set(['platform_approved', 'rejected', 'refunded']);
const DASHBOARD_REFUND_REVIEW_STATUSES = new Set([...OPEN_REFUND_REVIEW_STATUSES, ...TERMINAL_REFUND_REVIEW_STATUSES]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES = new Set([
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'merchant_review',
  'merchant_disputed',
  'platform_investigation',
  'auto_approved',
  'platform_approved',
  'refunded',
  'rejected',
]);
const DEMO_REFUND_INVESTIGATION_REASON = '국세청 사업자등록번호 인증은 데모 환경에서 제한되어 TrustPay 자체 검토와 사업자 답변 기한으로 진행합니다.';
const APPROVED_PAYMENT_REQUEST_COOKIE = 'trustpay_demo_approved_qr';

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
  {
    id: CONSUMER_JIHUN_ID,
    name: '박지훈',
    phone: '010-2000-0003',
    email: 'jihun@demo.com',
    xrplAddress: 'rDemoConsumerJihun000000003',
  },
  {
    id: CONSUMER_YUNA_ID,
    name: '최유나',
    phone: '010-2000-0004',
    email: 'yuna@demo.com',
    xrplAddress: 'rDemoConsumerYuna0000000004',
  },
  {
    id: CONSUMER_HAJUN_ID,
    name: '오하준',
    phone: '010-2000-0005',
    email: 'hajun@demo.com',
    xrplAddress: 'rDemoConsumerHajun000000005',
  },
  {
    id: CONSUMER_DAEUN_ID,
    name: '정다은',
    phone: '010-2000-0006',
    email: 'daeun@demo.com',
    xrplAddress: 'rDemoConsumerDaeun000000006',
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
    id: BUSINESS_LAUNDRY_ID,
    name: '크린토피아 역삼점',
    category: '세탁소',
    address: '서울시 강남구 역삼로 50',
    phone: '010-1000-0004',
    email: 'laundry@demo.com',
    xrplAddress: 'rDemoBusiness4LaundryDEF12345',
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
    description: '음료와 브런치 메뉴를 ₩6,750 단위로 차감하는 카페 선불권',
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
    description: '매월 ₩135,000이 정산되는 월정액 회원권',
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
  {
    id: PRODUCT_LAUNDRY_PASS_ID,
    businessId: BUSINESS_LAUNDRY_ID,
    name: '세탁 정기 이용권',
    description: '와이셔츠, 드라이클리닝, 침구 세탁을 ₩13,500 단위로 차감합니다',
    escrowType: 'prepaid',
    totalAmount: 120,
    monthlyAmount: 10,
    months: 12,
    unitPrice: 10,
    validityMonths: 4,
    isActive: true,
    menuItems: [
      { id: MENU_LAUNDRY_SHIRTS_ID, productId: PRODUCT_LAUNDRY_PASS_ID, name: '와이셔츠 5벌', amount: 10, isActive: true },
      { id: MENU_LAUNDRY_DRY_CLEANING_ID, productId: PRODUCT_LAUNDRY_PASS_ID, name: '드라이클리닝', amount: 30, isActive: true },
      { id: MENU_LAUNDRY_BEDDING_ID, productId: PRODUCT_LAUNDRY_PASS_ID, name: '침구 세탁', amount: 40, isActive: true },
    ],
  },
  {
    id: PRODUCT_ACADEMY_COURSE_ID,
    businessId: BUSINESS_ACADEMY_ID,
    name: '영어 회화 6개월 과정',
    description: '매월 ₩202,500이 정산되는 학원 수강권',
    escrowType: 'monthly',
    totalAmount: 900,
    monthlyAmount: 150,
    months: 6,
    unitPrice: null,
    validityMonths: null,
    isActive: true,
    menuItems: [],
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
  makeSettledChargeRequest({
    id: CHARGE_SALON_DAEUN_COLOR_ID,
    escrowId: '00000000-0000-4000-a000-000000000800',
    consumerId: CONSUMER_DAEUN_ID,
    businessId: BUSINESS_SALON_ID,
    productId: PRODUCT_SALON_PASS_ID,
    menuItemId: MENU_SALON_COLOR_ID,
    menuName: '염색',
    amount: 80,
    entries: entryIds('00000000-0000-4000-a000-000000000800', 1, 8),
    approvedAt: '2026-05-12T06:20:00Z',
    txHash: 'DEMO_TX_HASH_SALON_DAEUN_COLOR',
  }),
  makeSettledChargeRequest({
    id: CHARGE_LAUNDRY_JIHUN_SHIRTS_ID,
    escrowId: '00000000-0000-4000-a000-000000000900',
    consumerId: CONSUMER_JIHUN_ID,
    businessId: BUSINESS_LAUNDRY_ID,
    productId: PRODUCT_LAUNDRY_PASS_ID,
    menuItemId: MENU_LAUNDRY_SHIRTS_ID,
    menuName: '와이셔츠 5벌',
    amount: 10,
    entries: entryIds('00000000-0000-4000-a000-000000000900', 1, 1),
    approvedAt: '2026-05-06T02:30:00Z',
    txHash: 'DEMO_TX_HASH_LAUNDRY_JIHUN_SHIRTS',
  }),
  makeSettledChargeRequest({
    id: CHARGE_LAUNDRY_JIHUN_DRY_CLEANING_ID,
    escrowId: '00000000-0000-4000-a000-000000000900',
    consumerId: CONSUMER_JIHUN_ID,
    businessId: BUSINESS_LAUNDRY_ID,
    productId: PRODUCT_LAUNDRY_PASS_ID,
    menuItemId: MENU_LAUNDRY_DRY_CLEANING_ID,
    menuName: '드라이클리닝',
    amount: 30,
    entries: entryIds('00000000-0000-4000-a000-000000000900', 2, 4),
    approvedAt: '2026-05-13T03:15:00Z',
    txHash: 'DEMO_TX_HASH_LAUNDRY_JIHUN_DRY',
  }),
  {
    id: CHARGE_LAUNDRY_DAEUN_BEDDING_ID,
    escrowId: '00000000-0000-4000-a000-000000000901',
    consumerId: CONSUMER_DAEUN_ID,
    businessId: BUSINESS_LAUNDRY_ID,
    productId: PRODUCT_LAUNDRY_PASS_ID,
    menuItemId: MENU_LAUNDRY_BEDDING_ID,
    menuName: '침구 세탁',
    amount: 40,
    status: 'pending_approval',
    entryIds: JSON.stringify(entryIds('00000000-0000-4000-a000-000000000901', 2, 5)),
    requestedAt: new Date('2026-05-15T04:00:00Z').toISOString(),
    approvedAt: null,
    settledAt: null,
    rejectedAt: null,
    txHash: null,
    menuItem: { id: MENU_LAUNDRY_BEDDING_ID, productId: PRODUCT_LAUNDRY_PASS_ID, name: '침구 세탁', amount: 40, isActive: true },
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

function normalizePaymentRequestCode(value) {
  return String(value || '').trim().toUpperCase();
}

function createStatelessDemoPaymentRequest(code) {
  if (!/^TP-\d{6}$/.test(code)) return null;
  const business = businesses.find((item) => item.id === BUSINESS_GYM_ID);
  if (!business) return null;
  return {
    id: `stateless-${code}`,
    code,
    businessId: business.id,
    businessName: business.name,
    businessCategory: business.category,
    productId: null,
    productName: null,
    paymentModel: 'monthly',
    paymentAmount: 600,
    totalAmount: 600,
    monthlyAmount: 100,
    months: 6,
    escrowType: 'monthly',
    unitPrice: null,
    validityMonths: null,
    validFrom: null,
    validUntil: null,
    status: 'pending',
    createdAt: '2026-05-15T00:00:00.000Z',
  };
}

function findPaymentRequestByCode(code) {
  const normalizedCode = normalizePaymentRequestCode(code);
  if (!normalizedCode) return null;
  return paymentRequests.find((item) => item.code === normalizedCode) || createStatelessDemoPaymentRequest(normalizedCode);
}

function createApprovedPaymentRequestEscrow(paymentRequest, consumerId) {
  const isPrepaid = paymentRequest.escrowType === 'prepaid';
  const entryCount = isPrepaid
    ? Math.max(1, Math.round(Number(paymentRequest.totalAmount) / Number(paymentRequest.unitPrice || paymentRequest.totalAmount)))
    : Number(paymentRequest.months || 1);
  const monthlyAmount = isPrepaid
    ? Number(paymentRequest.unitPrice || paymentRequest.totalAmount)
    : Number(paymentRequest.monthlyAmount || paymentRequest.totalAmount / entryCount);
  return makeEscrow({
    id: `demo-approved-${paymentRequest.code}`,
    consumerId,
    businessId: paymentRequest.businessId,
    productId: paymentRequest.productId || null,
    totalAmount: Number(paymentRequest.totalAmount),
    monthlyAmount,
    months: entryCount,
    escrowType: isPrepaid ? 'prepaid' : 'monthly',
    unitPrice: isPrepaid ? Number(paymentRequest.unitPrice || paymentRequest.totalAmount) : null,
    validityMonths: isPrepaid ? paymentRequest.validityMonths : null,
    validFrom: isPrepaid ? paymentRequest.validFrom || null : null,
    validUntil: isPrepaid ? paymentRequest.validUntil || null : null,
    status: 'active',
    entryStatuses: Array.from({ length: entryCount }, (_, index) => !isPrepaid && index === 0 ? 'released' : 'pending'),
  });
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
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000600',
    consumerId: CONSUMER_YUNA_ID,
    businessId: BUSINESS_GYM_ID,
    productId: PRODUCT_GYM_MEMBERSHIP_ID,
    totalAmount: 600,
    monthlyAmount: 100,
    months: 6,
    status: 'active',
    entryStatuses: ['released', 'released', 'pending', 'pending', 'pending', 'pending'],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000700',
    consumerId: CONSUMER_HAJUN_ID,
    businessId: BUSINESS_GYM_ID,
    productId: PRODUCT_GYM_MEMBERSHIP_ID,
    totalAmount: 600,
    monthlyAmount: 100,
    months: 6,
    status: 'active',
    entryStatuses: ['released', 'pending', 'pending', 'pending', 'pending', 'pending'],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000800',
    consumerId: CONSUMER_DAEUN_ID,
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
      ...Array.from({ length: 8 }, () => 'released'),
      ...Array.from({ length: 22 }, () => 'pending'),
    ],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000900',
    consumerId: CONSUMER_JIHUN_ID,
    businessId: BUSINESS_LAUNDRY_ID,
    productId: PRODUCT_LAUNDRY_PASS_ID,
    totalAmount: 120,
    monthlyAmount: 10,
    months: 12,
    escrowType: 'prepaid',
    unitPrice: 10,
    validityMonths: 4,
    status: 'active',
    entryStatuses: [
      ...Array.from({ length: 4 }, () => 'released'),
      ...Array.from({ length: 8 }, () => 'pending'),
    ],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000901',
    consumerId: CONSUMER_DAEUN_ID,
    businessId: BUSINESS_LAUNDRY_ID,
    productId: PRODUCT_LAUNDRY_PASS_ID,
    totalAmount: 120,
    monthlyAmount: 10,
    months: 12,
    escrowType: 'prepaid',
    unitPrice: 10,
    validityMonths: 4,
    status: 'active',
    entryStatuses: [
      'released',
      ...Array.from({ length: 11 }, () => 'pending'),
    ],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000902',
    consumerId: CONSUMER_YUNA_ID,
    businessId: BUSINESS_ACADEMY_ID,
    productId: PRODUCT_ACADEMY_COURSE_ID,
    totalAmount: 900,
    monthlyAmount: 150,
    months: 6,
    status: 'active',
    entryStatuses: ['released', 'pending', 'pending', 'pending', 'pending', 'pending'],
  }),
  makeEscrow({
    id: '00000000-0000-4000-a000-000000000903',
    consumerId: CONSUMER_HAJUN_ID,
    businessId: BUSINESS_ACADEMY_ID,
    productId: PRODUCT_ACADEMY_COURSE_ID,
    totalAmount: 900,
    monthlyAmount: 150,
    months: 6,
    status: 'completed',
    entryStatuses: Array.from({ length: 6 }, () => 'released'),
  }),
];

let refundReviewRequests = [
  {
    id: REFUND_REVIEW_CAFE_PLATFORM_ID,
    escrowId: '00000000-0000-4000-a000-000000000400',
    consumerId: CONSUMER_SEOYEON_ID,
    businessId: BUSINESS_CAFE_ID,
    status: 'platform_review',
    refundableAmount: 110,
    merchantRespondBy: '2026-05-19T09:00:00.000Z',
    businessClosureStatus: 'not_checked',
    consumerReason: '회사 이전으로 남은 커피 이용권을 더 쓰기 어려워 환불 검토를 요청합니다.',
    merchantNotice: '소비자가 남은 카페 선불권 환불 검토를 요청했습니다.',
    merchantResponse: null,
    merchantRespondedAt: null,
    adminResolutionReason: null,
    investigationReason: null,
    photoDataUrls: ['demo://refund/cafe-seoyeon-receipt.png'],
    requestedAt: '2026-05-13T02:15:00.000Z',
    resolvedAt: null,
  },
  {
    id: REFUND_REVIEW_LAUNDRY_DAEUN_ID,
    escrowId: '00000000-0000-4000-a000-000000000901',
    consumerId: CONSUMER_DAEUN_ID,
    businessId: BUSINESS_LAUNDRY_ID,
    status: 'merchant_response_requested',
    refundableAmount: 110,
    merchantRespondBy: '2026-05-21T09:00:00.000Z',
    businessClosureStatus: 'not_checked',
    consumerReason: '장기 출장으로 남은 세탁권 환불이 필요합니다.',
    merchantNotice: '소비자가 남은 세탁권 환불 검토를 요청했습니다.',
    merchantResponse: null,
    merchantRespondedAt: null,
    adminResolutionReason: null,
    investigationReason: null,
    photoDataUrls: ['demo://refund/laundry-daeun-receipt.png'],
    requestedAt: '2026-05-15T04:10:00.000Z',
    resolvedAt: null,
  },
  {
    id: REFUND_REVIEW_SALON_RESPONDED_ID,
    escrowId: '00000000-0000-4000-a000-000000000800',
    consumerId: CONSUMER_DAEUN_ID,
    businessId: BUSINESS_SALON_ID,
    status: 'merchant_responded',
    refundableAmount: 220,
    merchantRespondBy: '2026-05-18T09:00:00.000Z',
    businessClosureStatus: 'not_checked',
    consumerReason: '예약 가능한 시간이 계속 밀려 남은 선불권 환불을 요청합니다.',
    merchantNotice: '소비자가 예약 지연을 이유로 남은 선불권 환불 검토를 요청했습니다.',
    merchantResponse: '영업은 정상 진행 중이며 다음 주 우선 예약과 부분 환불 중 선택 가능하도록 안내했습니다.',
    merchantRespondedAt: '2026-05-16T05:20:00.000Z',
    adminResolutionReason: null,
    investigationReason: null,
    photoDataUrls: ['demo://refund/salon-daeun-booking.png'],
    requestedAt: '2026-05-14T03:35:00.000Z',
    resolvedAt: null,
  },
  {
    id: REFUND_REVIEW_GYM_HAJUN_ID,
    escrowId: '00000000-0000-4000-a000-000000000700',
    consumerId: CONSUMER_HAJUN_ID,
    businessId: BUSINESS_GYM_ID,
    status: 'merchant_review',
    refundableAmount: 500,
    merchantRespondBy: '2026-05-20T09:00:00.000Z',
    businessClosureStatus: 'not_checked',
    consumerReason: '개인 일정으로 이용이 어려워 남은 기간 환불을 요청합니다.',
    merchantNotice: '소비자가 남은 5개월분 환불 검토를 요청했습니다.',
    merchantResponse: null,
    merchantRespondedAt: null,
    adminResolutionReason: null,
    investigationReason: null,
    photoDataUrls: ['demo://refund/gym-hajun-membership.png'],
    requestedAt: '2026-05-14T08:30:00.000Z',
    resolvedAt: null,
  },
  {
    id: REFUND_REVIEW_ACADEMY_INVESTIGATION_ID,
    escrowId: '00000000-0000-4000-a000-000000000902',
    consumerId: CONSUMER_YUNA_ID,
    businessId: BUSINESS_ACADEMY_ID,
    status: 'platform_investigation',
    refundableAmount: 750,
    merchantRespondBy: '2026-05-22T09:00:00.000Z',
    businessClosureStatus: 'not_checked',
    consumerReason: '강사 변경 이후 수업 일정이 맞지 않아 남은 수강료 환불을 요청합니다.',
    merchantNotice: '수업 변경 내역과 출석 기록을 확인해 주세요.',
    merchantResponse: null,
    merchantRespondedAt: null,
    adminResolutionReason: null,
    investigationReason: '수업 일정 변경 고지와 출석 기록 확인이 필요합니다.',
    photoDataUrls: ['demo://refund/academy-yuna-schedule.png'],
    requestedAt: '2026-05-15T01:45:00.000Z',
    resolvedAt: null,
  },
  {
    id: REFUND_REVIEW_SALON_APPROVED_ID,
    escrowId: '00000000-0000-4000-a000-000000000300',
    consumerId: CONSUMER_ID,
    businessId: BUSINESS_SALON_ID,
    status: 'platform_approved',
    refundableAmount: 300,
    merchantRespondBy: '2026-05-12T09:00:00.000Z',
    businessClosureStatus: 'not_checked',
    consumerReason: '사용하지 않은 3회분 환불을 요청합니다.',
    merchantNotice: '취소 완료 건의 미사용분 환불 승인 내역입니다.',
    merchantResponse: null,
    merchantRespondedAt: null,
    adminResolutionReason: '미사용 3회분 환불 대상임을 확인했습니다.',
    investigationReason: null,
    photoDataUrls: ['demo://refund/salon-minsu-approved.png'],
    requestedAt: '2026-05-09T05:10:00.000Z',
    resolvedAt: '2026-05-10T06:20:00.000Z',
  },
  {
    id: REFUND_REVIEW_ACADEMY_REJECTED_ID,
    escrowId: '00000000-0000-4000-a000-000000000903',
    consumerId: CONSUMER_HAJUN_ID,
    businessId: BUSINESS_ACADEMY_ID,
    status: 'rejected',
    refundableAmount: 0,
    merchantRespondBy: '2026-04-20T09:00:00.000Z',
    businessClosureStatus: 'not_checked',
    consumerReason: '수강 완료 후 일부 금액 환불을 요청합니다.',
    merchantNotice: '완료된 수강권 환불 요청에 대한 검토 내역입니다.',
    merchantResponse: null,
    merchantRespondedAt: null,
    adminResolutionReason: '전체 수강과 정산이 완료되어 환불 대상이 아닙니다.',
    investigationReason: null,
    photoDataUrls: ['demo://refund/academy-hajun-rejected.png'],
    requestedAt: '2026-04-18T02:05:00.000Z',
    resolvedAt: '2026-04-19T04:30:00.000Z',
  },
];

function rippleTimeFromNow(month) {
  const rippleEpoch = 946684800;
  const date = new Date();
  date.setMonth(date.getMonth() + month);
  return Math.floor(date.getTime() / 1000) - rippleEpoch;
}

function rippleTimeFromDate(value) {
  if (!value) return null;
  const rippleEpoch = 946684800;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000) - rippleEpoch;
}

function makeEscrow({ id, consumerId = CONSUMER_ID, businessId, productId = null, totalAmount, monthlyAmount, months, escrowType = 'monthly', unitPrice = null, validityMonths = null, validFrom = null, validUntil = null, status, entryStatuses, entryTxHashPrefix = null }) {
  const business = businesses.find((item) => item.id === businessId);
  const consumer = consumers.find((item) => item.id === consumerId) || consumers[0];
  const prepaidFinishAfter = rippleTimeFromDate(validFrom) ?? rippleTimeFromNow(0);
  const prepaidCancelAfter = rippleTimeFromDate(validUntil) ?? rippleTimeFromNow(validityMonths || 1);
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
    validFrom,
    validUntil,
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
      finishAfter: escrowType === 'prepaid' ? prepaidFinishAfter : rippleTimeFromNow(index),
      cancelAfter: escrowType === 'prepaid' ? prepaidCancelAfter : rippleTimeFromNow(index + 1),
      status: entryStatus,
      txHash: entryStatus === 'pending' ? null : entryTxHashPrefix ? `${entryTxHashPrefix}_${index + 1}` : `DEMO_${entryStatus.toUpperCase()}_${id.slice(-3)}_${index + 1}`,
    })),
  };
}

function withRelations(escrow, audience = 'consumer') {
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
    refundReviewRequests: refundReviewsForEscrow(escrow.id, audience),
  };
}

function refundReviewsForEscrow(escrowId, audience) {
  const reviews = refundReviewRequests
    .filter((item) => item.escrowId === escrowId)
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  if (audience === 'merchant') {
    return reviews
      .filter((item) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(item.status))
      .map(stripRefundReviewForMerchant);
  }
  return reviews.map((review) => ({ ...review }));
}

function stripRefundReviewForMerchant(review) {
  const { consumerReason: _consumerReason, photoDataUrls: _photoDataUrls, photoDataUrlsJson: _photoDataUrlsJson, ...rest } = review;
  return rest;
}

function parseEntryIds(request) {
  try {
    const parsed = JSON.parse(request.entryIds);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function selectEntriesCoveringAmount(entries, amount) {
  const selectedIds = [];
  let coveredAmount = 0;
  for (const entry of entries) {
    selectedIds.push(entry.id);
    coveredAmount += Number(entry.amount);
    if (Number(coveredAmount.toFixed(6)) + 1e-4 >= amount) return selectedIds;
  }
  return null;
}

function getHeader(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getCookie(req, name) {
  const cookieHeader = getHeader(req, 'cookie') || '';
  const prefix = `${name}=`;
  const match = String(cookieHeader).split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : '';
}

function getApprovedPaymentRequestContext(req) {
  const raw = getCookie(req, APPROVED_PAYMENT_REQUEST_COOKIE);
  const [rawCode, consumerId = null] = String(raw || '').split('|');
  const code = normalizePaymentRequestCode(rawCode);
  if (!code) return null;
  const request = findPaymentRequestByCode(code);
  return request ? { code, consumerId, request } : null;
}

function setApprovedPaymentRequestCookie(res, code, consumerId) {
  const value = [normalizePaymentRequestCode(code), consumerId].filter(Boolean).join('|');
  res.setHeader('Set-Cookie', `${APPROVED_PAYMENT_REQUEST_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=3600; SameSite=Lax`);
}

function getContextualEscrows(req) {
  const approvedPaymentRequest = getApprovedPaymentRequestContext(req);
  if (!approvedPaymentRequest) return escrows;

  const approvedEscrowId = `demo-approved-${approvedPaymentRequest.code}`;
  if (escrows.some((item) => item.id === approvedEscrowId)) return escrows;

  return [
    createApprovedPaymentRequestEscrow(
      approvedPaymentRequest.request,
      approvedPaymentRequest.consumerId || CONSUMER_ID,
    ),
    ...escrows,
  ];
}

function pendingPaymentRequestsForBusiness(req, businessId) {
  const approvedPaymentRequest = getApprovedPaymentRequestContext(req);
  return paymentRequests.filter((item) => (
    item.businessId === businessId
    && item.status === 'pending'
    && item.code !== approvedPaymentRequest?.code
  ));
}

function isAdminRequest(req) {
  const expectedId = process.env.ADMIN_ID || 'admin';
  const expectedSecret = process.env.ADMIN_API_SECRET || 'admin1234';
  return getHeader(req, 'x-admin-id') === expectedId && getHeader(req, 'x-admin-secret') === expectedSecret;
}

function getDemoSession(req) {
  const authorization = getHeader(req, 'authorization') || '';
  const match = authorization.match(/^Bearer demo-token-(consumer|business)-(.+)$/);
  return match ? { role: match[1], userId: match[2] } : null;
}

function addBusinessDays(value, days) {
  const result = new Date(value);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

function reviewWithoutEscrow(review) {
  const { escrow: _escrow, ...rest } = review;
  return rest;
}

function paginateRows(rows, url) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

function serializeAdminReview(review, scopedEscrows = escrows) {
  const escrow = scopedEscrows.find((item) => item.id === review.escrowId);
  return {
    ...review,
    escrow: escrow ? withRelations(escrow, 'consumer') : null,
  };
}

function adminBusinessRows(scopedEscrows = escrows) {
  return businesses.map((business) => ({
    ...business,
    registrationVerificationStatus: 'demo_verified',
    _count: {
      products: products.filter((product) => product.businessId === business.id).length,
      escrows: scopedEscrows.filter((escrow) => escrow.businessId === business.id).length,
      refundReviewRequests: refundReviewRequests.filter((review) => review.businessId === business.id).length,
    },
  }));
}

function adminConsumerRows(scopedEscrows = escrows) {
  return consumers.map((consumer) => ({
    ...consumer,
    _count: {
      escrows: scopedEscrows.filter((escrow) => escrow.consumerId === consumer.id).length,
      chargeRequests: chargeRequests.filter((request) => request.consumerId === consumer.id).length,
      refundReviewRequests: refundReviewRequests.filter((review) => review.consumerId === consumer.id).length,
    },
  }));
}

function adminEscrowRows(scopedEscrows = escrows) {
  return scopedEscrows.map((escrow) => ({
    ...withRelations(escrow, 'consumer'),
    refundReviewRequests: refundReviewRequests
      .filter((review) => review.escrowId === escrow.id)
      .map(reviewWithoutEscrow),
  }));
}

function asNumber(value) {
  return Number(value || 0);
}

function daysUntil(value, now = new Date()) {
  const deadline = value ? new Date(value).getTime() : now.getTime();
  return Math.floor((deadline - now.getTime()) / ONE_DAY_MS);
}

function dashboardParticipantName(review, role) {
  const collection = role === 'business' ? businesses : consumers;
  const id = role === 'business' ? review.businessId : review.consumerId;
  return collection.find((item) => item.id === id)?.name || `${role === 'business' ? '사업자' : '소비자'} 미확인`;
}

function dashboardByStatus(reviews) {
  return {
    platformReview: reviews.filter((review) => review.status === 'platform_review').length,
    waitingMerchant: reviews.filter((review) => WAITING_MERCHANT_STATUSES.has(review.status)).length,
    merchantResponded: reviews.filter((review) => review.status === 'merchant_responded').length,
    platformInvestigation: reviews.filter((review) => review.status === 'platform_investigation').length,
    resolved: reviews.filter((review) => TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)).length,
  };
}

function dashboardSlaMetrics(reviews) {
  const slaRisks = reviews
    .filter((review) => WAITING_MERCHANT_STATUSES.has(review.status))
    .map((review) => ({
      id: review.id,
      businessName: dashboardParticipantName(review, 'business'),
      consumerName: dashboardParticipantName(review, 'consumer'),
      refundableAmount: asNumber(review.refundableAmount),
      daysRemaining: daysUntil(review.merchantRespondBy),
      status: review.status,
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    slaRisks,
    slaOverdue: slaRisks.filter((risk) => risk.daysRemaining < 0).length,
    slaDueSoon: slaRisks.filter((risk) => risk.daysRemaining >= 0 && risk.daysRemaining <= 1).length,
  };
}

function dashboardEscrowAmounts(scopedEscrows = escrows) {
  return scopedEscrows.reduce((totals, escrow) => {
    const released = escrow.entries.filter((entry) => entry.status === 'released').reduce((sum, entry) => sum + asNumber(entry.amount), 0);
    const pending = escrow.entries.filter((entry) => entry.status === 'pending').reduce((sum, entry) => sum + asNumber(entry.amount), 0);
    const refunded = escrow.entries.filter((entry) => entry.status === 'refunded').reduce((sum, entry) => sum + asNumber(entry.amount), 0);
    const frozen = Math.max(0, ...refundReviewRequests
      .filter((review) => review.escrowId === escrow.id && OPEN_REFUND_REVIEW_STATUSES.includes(review.status))
      .map((review) => asNumber(review.refundableAmount)));

    totals.releasedAmount += released;
    totals.pendingAmount += Math.max(pending - frozen, 0);
    totals.frozenByRefundReviewAmount += frozen;
    totals.refundedAmount += refunded;
    return totals;
  }, { releasedAmount: 0, pendingAmount: 0, frozenByRefundReviewAmount: 0, refundedAmount: 0 });
}

function dashboardRecentEvents(reviews) {
  return reviews
    .map((review) => {
      const isResolved = TERMINAL_REFUND_REVIEW_STATUSES.has(review.status);
      const isMerchantResponded = review.status === 'merchant_responded' || review.merchantRespondedAt;
      const type = isResolved ? review.status : isMerchantResponded ? 'merchant_responded' : review.status;
      const label = isResolved
        ? review.status === 'platform_approved' ? '환불 승인' : review.status === 'rejected' ? '환불 거절' : '환불 완료'
        : isMerchantResponded ? '사업자 답변 도착' : review.status === 'platform_investigation' ? '추가 확인' : '환불 검토 접수';
      const occurredAt = (isResolved ? review.resolvedAt : isMerchantResponded ? review.merchantRespondedAt : review.requestedAt) || review.requestedAt;
      return {
        id: review.id,
        type,
        label,
        businessName: dashboardParticipantName(review, 'business'),
        consumerName: dashboardParticipantName(review, 'consumer'),
        amount: asNumber(review.refundableAmount),
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
        status: review.status,
      };
    })
    .filter((event) => event.occurredAt)
    .sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime())
    .slice(0, 6);
}

function adminDashboard(scopedEscrows = escrows) {
  const dashboardReviews = refundReviewRequests.filter((review) => DASHBOARD_REFUND_REVIEW_STATUSES.has(review.status));
  const slaMetrics = dashboardSlaMetrics(dashboardReviews);
  return {
    refundReviews: {
      open: refundReviewRequests.filter((review) => OPEN_REFUND_REVIEW_STATUSES.includes(review.status)).length,
      merchantResponseRequested: refundReviewRequests.filter((review) => review.status === 'merchant_response_requested').length,
      merchantResponded: refundReviewRequests.filter((review) => review.status === 'merchant_responded').length,
      platformInvestigation: refundReviewRequests.filter((review) => review.status === 'platform_investigation').length,
      byStatus: dashboardByStatus(dashboardReviews),
      ...slaMetrics,
    },
    businesses: { total: businesses.length },
    consumers: { total: consumers.length },
    escrows: { active: scopedEscrows.filter((escrow) => escrow.status === 'active').length, ...dashboardEscrowAmounts(scopedEscrows) },
    recentEvents: dashboardRecentEvents(dashboardReviews),
  };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Id, X-Admin-Secret');
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
  let path = url.pathname.replace(/^\/api/, '');
  const rewrittenPath = path === '/demo' || path === '/admin' ? url.searchParams.get('path') : null;
  if (rewrittenPath) {
    // Vercel rewrites nested demo API paths here so state stays in one function.
    url.searchParams.delete('path');
    path = `/${rewrittenPath.replace(/^\//, '')}`;
  }
  const parts = path.split('/').filter(Boolean);
  const body = req.method === 'POST' ? await parseBody(req) : {};

  if (parts[0] === 'admin') {
    if (!isAdminRequest(req)) return send(res, 401, { message: '운영자 권한이 필요합니다' });
    const scopedEscrows = getContextualEscrows(req);

    if (req.method === 'GET' && path === '/admin/dashboard') {
      return send(res, 200, adminDashboard(scopedEscrows));
    }

    if (req.method === 'GET' && path === '/admin/businesses') {
      return send(res, 200, paginateRows(adminBusinessRows(scopedEscrows), url));
    }

    if (req.method === 'GET' && path === '/admin/consumers') {
      return send(res, 200, paginateRows(adminConsumerRows(scopedEscrows), url));
    }

    if (req.method === 'GET' && path === '/admin/escrows') {
      return send(res, 200, paginateRows(adminEscrowRows(scopedEscrows), url));
    }

    if (req.method === 'GET' && parts[1] === 'refund-reviews' && !parts[2]) {
      const status = url.searchParams.get('status');
      const reviews = refundReviewRequests
        .filter((review) => status ? review.status === status : OPEN_REFUND_REVIEW_STATUSES.includes(review.status))
        .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())
        .map((review) => serializeAdminReview(review, scopedEscrows));
      return send(res, 200, paginateRows(reviews, url));
    }

    if (req.method === 'GET' && parts[1] === 'refund-reviews' && parts[2]) {
      const review = refundReviewRequests.find((item) => item.id === parts[2]);
      return review ? send(res, 200, serializeAdminReview(review, scopedEscrows)) : send(res, 404, { message: 'Refund review not found' });
    }

    if (req.method === 'POST' && parts[1] === 'refund-reviews' && parts[3] === 'request-merchant-response') {
      const review = refundReviewRequests.find((item) => item.id === parts[2]);
      if (!review) return send(res, 404, { message: 'Refund review not found' });
      if (TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)) return send(res, 400, { message: '이미 종료된 환불 검토입니다' });
      review.status = 'merchant_response_requested';
      review.merchantNotice = body.merchantNotice;
      review.merchantRespondBy = addBusinessDays(new Date(), 3).toISOString();
      return send(res, 200, serializeAdminReview(review, scopedEscrows));
    }

    if (req.method === 'POST' && parts[1] === 'refund-reviews' && parts[3] === 'resolve') {
      const review = refundReviewRequests.find((item) => item.id === parts[2]);
      if (!review) return send(res, 404, { message: 'Refund review not found' });
      if (TERMINAL_REFUND_REVIEW_STATUSES.has(review.status)) return send(res, 400, { message: '이미 종료된 환불 검토입니다' });
      if (body.decision === 'approve') {
        const escrow = escrows.find((item) => item.id === review.escrowId);
        if (!escrow) return send(res, 400, { message: '환불 대상 보호 결제를 확인할 수 없습니다' });
        escrow.entries.forEach((entry) => {
          if (entry.status === 'pending') {
            entry.status = 'refunded';
            entry.txHash = `DEMO_ADMIN_REFUND_${Date.now()}_${entry.month}`;
          }
        });
        escrow.status = 'cancelled';
        review.status = 'refunded';
      } else {
        review.status = body.decision === 'reject' ? 'rejected' : 'platform_investigation';
      }
      review.adminResolutionReason = body.reason;
      review.resolvedAt = body.decision === 'investigate' ? null : new Date().toISOString();
      return send(res, 200, serializeAdminReview(review, scopedEscrows));
    }
  }

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

  if (req.method === 'POST' && parts[0] === 'payment-requests' && parts[2] === 'cancel') {
    const session = getDemoSession(req);
    const request = paymentRequests.find((item) => item.id === parts[1]);
    if (!request) return send(res, 404, { message: 'Payment request not found' });
    if (!session || session.role !== 'business' || session.userId !== request.businessId) {
      return send(res, 403, { message: '해당 사업자만 결제 QR을 취소할 수 있습니다' });
    }
    if (request.status !== 'pending') {
      return send(res, 400, { message: '이미 처리된 결제 QR입니다' });
    }
    request.status = 'cancelled';
    return send(res, 200, request);
  }

  if (req.method === 'GET' && parts[0] === 'payment-requests' && parts[1]) {
    const code = decodeURIComponent(parts[1]);
    const request = findPaymentRequestByCode(code);
    return request ? send(res, 200, request) : send(res, 404, { message: 'Payment request not found' });
  }

  if (req.method === 'GET' && path === '/payment-requests') {
    const code = url.searchParams.get('code') || '';
    const request = findPaymentRequestByCode(code);
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
    const scopedEscrows = getContextualEscrows(req).filter((item) => item.businessId === businessId);
    const scoped = scopedEscrows.map((escrow) => withRelations(escrow, 'merchant'));
    return send(res, 200, {
      business: businesses.find((item) => item.id === businessId),
      totalReceived: scoped.reduce((sum, escrow) => {
        if (escrow.escrowType === 'prepaid') {
          const settledCharges = escrow.chargeRequests
            .filter((request) => request.status === 'settled')
            .reduce((chargeSum, request) => chargeSum + Number(request.amount), 0);
          if (settledCharges > 0) return sum + settledCharges;
        }
        return sum + escrow.entries
          .filter((entry) => entry.status === 'released')
          .reduce((entrySum, entry) => entrySum + Number(entry.amount || escrow.monthlyAmount), 0);
      }, 0),
      totalPending: scoped.reduce((sum, escrow) => {
        if (escrow.escrowType === 'prepaid') {
          const settledCharges = escrow.chargeRequests
            .filter((request) => request.status === 'settled')
            .reduce((chargeSum, request) => chargeSum + Number(request.amount), 0);
          const refundedAmount = escrow.entries
            .filter((entry) => entry.status === 'refunded')
            .reduce((entrySum, entry) => entrySum + Number(entry.amount), 0);
          return sum + Math.max(Number(escrow.totalAmount) - settledCharges - refundedAmount, 0);
        }
        return sum + escrow.entries
          .filter((entry) => entry.status === 'pending')
          .reduce((entrySum, entry) => entrySum + Number(entry.amount || escrow.monthlyAmount), 0);
      }, 0),
      activeEscrows: scoped.filter((item) => item.status === 'active').length,
      escrows: scoped,
      pendingPaymentRequests: pendingPaymentRequestsForBusiness(req, businessId),
    });
  }

  if (req.method === 'GET' && parts[0] === 'business' && parts[1]) {
    return send(res, 200, businesses.find((item) => item.id === parts[1]));
  }

  if (req.method === 'GET' && parts[0] === 'consumer' && parts[2] === 'balance') {
    return send(res, 200, { xrplAddress: consumers[0].xrplAddress, balance: '10000.00' });
  }

  if (req.method === 'GET' && parts[0] === 'escrow' && parts[1] === 'consumer') {
    const scoped = getContextualEscrows(req).filter((item) => item.consumerId === parts[2]);
    return send(res, 200, scoped.map((escrow) => withRelations(escrow, 'consumer')));
  }

  if (req.method === 'POST' && parts[0] === 'escrow' && parts[1] === 'refund-review-requests' && parts[3] === 'merchant-response') {
    const session = getDemoSession(req);
    const review = refundReviewRequests.find((item) => item.id === parts[2]);
    if (!review) return send(res, 404, { message: 'Refund review not found' });
    if (!session || session.role !== 'business' || session.userId !== review.businessId) {
      return send(res, 403, { message: '해당 사업자만 환불 검토 답변을 제출할 수 있습니다' });
    }
    if (review.status !== 'merchant_response_requested') {
      return send(res, 400, { message: '사업자 답변 요청 상태에서만 응답할 수 있습니다' });
    }
    const response = typeof body.response === 'string' ? body.response.trim() : '';
    if (response.length < 10) return send(res, 400, { message: '답변 내용을 10자 이상 입력해주세요' });

    review.status = 'merchant_responded';
    review.merchantResponse = response;
    review.merchantRespondedAt = new Date().toISOString();
    const escrow = escrows.find((item) => item.id === review.escrowId);
    return send(res, 200, { ...stripRefundReviewForMerchant(review), escrow: escrow ? withRelations(escrow, 'merchant') : null });
  }

  if (req.method === 'POST' && parts[0] === 'escrow' && parts[2] === 'refund-review-requests') {
    const session = getDemoSession(req);
    const escrow = escrows.find((item) => item.id === parts[1]);
    if (!escrow) return send(res, 404, { message: 'Escrow not found' });
    if (!session || session.role !== 'consumer' || session.userId !== escrow.consumerId) {
      return send(res, 403, { message: '해당 소비자만 환불 검토를 요청할 수 있습니다' });
    }
    if (escrow.status !== 'active') {
      return send(res, 400, { message: '진행 중인 보호 결제만 환불 검토를 요청할 수 있습니다' });
    }

    const existing = refundReviewRequests
      .filter((review) => review.escrowId === escrow.id && ACTIVE_REFUND_REVIEW_STATUSES.has(review.status))
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
    if (existing) return send(res, 200, { ...existing, escrow: withRelations(escrow, 'consumer') });

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 10) return send(res, 400, { message: '환불 사유를 10자 이상 입력해주세요' });
    const refundableAmount = escrow.entries
      .filter((entry) => entry.status === 'pending')
      .reduce((sum, entry) => sum + Number(entry.amount || escrow.monthlyAmount), 0);
    if (refundableAmount <= 0) return send(res, 400, { message: '환불 검토 가능한 미사용 잔액이 없습니다' });

    const now = new Date();
    const review = {
      id: `demo-refund-review-${now.getTime()}`,
      escrowId: escrow.id,
      consumerId: escrow.consumerId,
      businessId: escrow.businessId,
      status: 'platform_review',
      refundableAmount,
      merchantRespondBy: addBusinessDays(now, 3).toISOString(),
      businessClosureStatus: 'unavailable',
      businessClosureSource: 'demo',
      businessClosureCheckedAt: now.toISOString(),
      investigationReason: DEMO_REFUND_INVESTIGATION_REASON,
      consumerReason: reason,
      merchantNotice: null,
      merchantResponse: null,
      merchantRespondedAt: null,
      adminResolutionReason: null,
      photoDataUrls: Array.isArray(body.photoDataUrls) ? body.photoDataUrls.filter((item) => typeof item === 'string') : [],
      requestedAt: now.toISOString(),
      resolvedAt: null,
    };
    refundReviewRequests = [review, ...refundReviewRequests];
    return send(res, 201, { ...review, escrow: withRelations(escrow, 'consumer') });
  }

  if (req.method === 'GET' && parts[0] === 'escrow' && parts[1]) {
    const escrow = escrows.find((item) => item.id === parts[1]);
    const session = getDemoSession(req);
    const audience = session?.role === 'business' ? 'merchant' : 'consumer';
    return escrow ? send(res, 200, withRelations(escrow, audience)) : send(res, 404, { message: 'Escrow not found' });
  }

  if (req.method === 'POST' && path === '/escrow') {
    const paymentRequestCode = normalizePaymentRequestCode(body.paymentRequestCode);
    const paymentRequest = paymentRequestCode
      ? findPaymentRequestByCode(paymentRequestCode)
      : null;
    if (paymentRequest && paymentRequest.businessId !== body.businessId) return send(res, 404, { message: 'Payment request not found' });
    if (paymentRequestCode && !paymentRequest) return send(res, 404, { message: 'Payment request not found' });
    if (paymentRequest && paymentRequest.status !== 'pending') return send(res, 400, { message: '이미 처리된 결제 QR입니다' });

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
      id: paymentRequestCode ? `demo-approved-${paymentRequestCode}` : `demo-created-${Date.now()}`,
      consumerId: body.consumerId,
      businessId: body.businessId,
      productId: product?.id || null,
      totalAmount,
      monthlyAmount,
      months: entryCount,
      escrowType: isPrepaid ? 'prepaid' : 'monthly',
      unitPrice: isPrepaid ? unitPrice : null,
      validityMonths: isPrepaid ? validityMonths : null,
      validFrom: isPrepaid ? body.validFrom || null : null,
      validUntil: isPrepaid ? body.validUntil || null : null,
      status: 'active',
      entryStatuses: Array.from({ length: entryCount }, (_, index) => !isPrepaid && index === 0 ? 'released' : 'pending'),
    });
    escrows = [escrow, ...escrows];
    if (paymentRequest) {
      paymentRequest.status = 'used';
      setApprovedPaymentRequestCookie(res, paymentRequest.code, body.consumerId);
    }
    return send(res, 201, withRelations(escrow, 'consumer'));
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

    const reservedEntryIds = new Set(
      chargeRequests
        .filter((item) => item.escrowId === escrow.id && item.status === 'pending_approval')
        .flatMap(parseEntryIds),
    );
    const availableEntries = escrow.entries.filter((entry) => entry.status === 'pending' && !reservedEntryIds.has(entry.id));
    const selectedEntryIds = selectEntriesCoveringAmount(availableEntries, requestAmount);
    if (!selectedEntryIds) {
      return send(res, 400, { message: '차감 가능한 이용권 잔액이 부족합니다' });
    }

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
    const hasOpenRefundReview = refundReviewRequests.some((review) => (
      review.escrowId === escrow?.id && ACTIVE_REFUND_REVIEW_STATUSES.has(review.status)
    ));
    if (hasOpenRefundReview) return send(res, 400, { message: '환불 검토가 진행 중인 보호 결제는 정산할 수 없습니다' });
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
    return send(res, 200, { cancelled, failed: 0 });
  }

  return send(res, 404, { message: 'Not found' });
};
