import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RIPPLE_EPOCH = 946684800;
function isoToRippleTime(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000) - RIPPLE_EPOCH;
}

// Stable UUIDs for seed data (deterministic for demo scripts)
const CONSUMER_MINSU_ID = '00000000-0000-4000-a000-000000000001';
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
const ESCROW_ACTIVE_ID = '00000000-0000-4000-a000-000000000100';
const ESCROW_COMPLETED_ID = '00000000-0000-4000-a000-000000000200';
const ESCROW_CANCELLED_ID = '00000000-0000-4000-a000-000000000300';
const ESCROW_PREPAID_CAFE_ID = '00000000-0000-4000-a000-000000000400';
const ESCROW_PREPAID_SALON_ID = '00000000-0000-4000-a000-000000000500';
const ESCROW_GYM_YUNA_ID = '00000000-0000-4000-a000-000000000600';
const ESCROW_GYM_HAJUN_ID = '00000000-0000-4000-a000-000000000700';
const ESCROW_SALON_DAEUN_ID = '00000000-0000-4000-a000-000000000800';
const ESCROW_LAUNDRY_JIHUN_ID = '00000000-0000-4000-a000-000000000900';
const ESCROW_LAUNDRY_DAEUN_ID = '00000000-0000-4000-a000-000000000901';
const ESCROW_ACADEMY_YUNA_ID = '00000000-0000-4000-a000-000000000902';
const ESCROW_ACADEMY_HAJUN_ID = '00000000-0000-4000-a000-000000000903';
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
const CHARGE_SALON_SETTLED_ID = '00000000-0000-4000-a000-000000003001';
const CHARGE_SALON_PENDING_ID = '00000000-0000-4000-a000-000000003002';
const CHARGE_SALON_DAEUN_COLOR_ID = '00000000-0000-4000-a000-000000003033';
const CHARGE_LAUNDRY_JIHUN_SHIRTS_ID = '00000000-0000-4000-a000-000000003041';
const CHARGE_LAUNDRY_JIHUN_DRY_CLEANING_ID = '00000000-0000-4000-a000-000000003042';
const CHARGE_LAUNDRY_DAEUN_BEDDING_ID = '00000000-0000-4000-a000-000000003043';
const REFUND_REVIEW_GYM_HAJUN_ID = '00000000-0000-4000-a000-000000004001';
const REFUND_REVIEW_LAUNDRY_DAEUN_ID = '00000000-0000-4000-a000-000000004002';

function entryIds(escrowId: string, start: number, end: number): string[] {
  return Array.from({ length: end - start + 1 }, (_, index) => `${escrowId}-entry-${start + index}`);
}

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.refundReviewRequest.deleteMany();
  await prisma.chargeRequest.deleteMany();
  await prisma.escrowEntry.deleteMany();
  await prisma.escrow.deleteMany();
  await prisma.productMenuItem.deleteMany();
  await prisma.businessProduct.deleteMany();
  await prisma.consumer.deleteMany();
  await prisma.business.deleteMany();

  // ─── Consumers ───
  const minsu = await prisma.consumer.create({
    data: {
      id: CONSUMER_MINSU_ID,
      name: '김민수',
      phone: '010-2000-0001',
      email: 'minsu@demo.com',
      xrplAddress: 'rDemoConsumer1234567890ABCDEF',
      xrplSecret: 'sEdDemoConsumerSecret000000001',
    },
  });

  const seoyeon = await prisma.consumer.create({
    data: {
      id: CONSUMER_SEOYEON_ID,
      name: '이서연',
      phone: '010-2000-0002',
      email: 'seoyeon@demo.com',
      xrplAddress: 'rDemoConsumer2345678901BCDEFG',
      xrplSecret: 'sEdDemoConsumerSecret000000002',
    },
  });

  const jihun = await prisma.consumer.create({
    data: {
      id: CONSUMER_JIHUN_ID,
      name: '박지훈',
      phone: '010-2000-0003',
      email: 'jihun@demo.com',
      xrplAddress: 'rDemoConsumerJihun000000003',
      xrplSecret: 'sEdDemoConsumerSecret000000003',
    },
  });

  const yuna = await prisma.consumer.create({
    data: {
      id: CONSUMER_YUNA_ID,
      name: '최유나',
      phone: '010-2000-0004',
      email: 'yuna@demo.com',
      xrplAddress: 'rDemoConsumerYuna0000000004',
      xrplSecret: 'sEdDemoConsumerSecret000000004',
    },
  });

  const hajun = await prisma.consumer.create({
    data: {
      id: CONSUMER_HAJUN_ID,
      name: '오하준',
      phone: '010-2000-0005',
      email: 'hajun@demo.com',
      xrplAddress: 'rDemoConsumerHajun000000005',
      xrplSecret: 'sEdDemoConsumerSecret000000005',
    },
  });

  const daeun = await prisma.consumer.create({
    data: {
      id: CONSUMER_DAEUN_ID,
      name: '정다은',
      phone: '010-2000-0006',
      email: 'daeun@demo.com',
      xrplAddress: 'rDemoConsumerDaeun000000006',
      xrplSecret: 'sEdDemoConsumerSecret000000006',
    },
  });

  // ─── Businesses (5) ───
  const cafe = await prisma.business.create({
    data: {
      id: BUSINESS_CAFE_ID,
      name: '강남 블루보틀',
      category: '카페',
      address: '서울시 강남구 테헤란로 152',
      phone: '010-1000-0001',
      email: 'cafe@demo.com',
      registrationNumber: '1010100001',
      registrationVerificationStatus: 'demo_verified',
      registrationVerificationSource: 'demo',
      registrationVerifiedAt: new Date('2026-05-14T00:00:00.000Z'),
      xrplAddress: 'rDemoBusiness1CafeABCDEF12345',
      xrplSecret: 'sEdDemoBusinessCafeSecret0001',
      isActive: true,
    },
  });

  const gym = await prisma.business.create({
    data: {
      id: BUSINESS_GYM_ID,
      name: '파워짐 피트니스',
      category: '헬스장',
      address: '서울시 서초구 서초대로 100',
      phone: '010-1000-0002',
      email: 'gym@demo.com',
      registrationNumber: '1010100002',
      registrationVerificationStatus: 'demo_verified',
      registrationVerificationSource: 'demo',
      registrationVerifiedAt: new Date('2026-05-14T00:00:00.000Z'),
      xrplAddress: 'rDemoBusiness2GymABCDEF123456',
      xrplSecret: 'sEdDemoBusinessGymSecret00001',
      isActive: true,
    },
  });

  const salon = await prisma.business.create({
    data: {
      id: BUSINESS_SALON_ID,
      name: '헤어살롱 루나',
      category: '미용실',
      address: '서울시 마포구 홍대입구 22',
      phone: '010-1000-0003',
      email: 'salon@demo.com',
      registrationNumber: '1010100003',
      registrationVerificationStatus: 'demo_verified',
      registrationVerificationSource: 'demo',
      registrationVerifiedAt: new Date('2026-05-14T00:00:00.000Z'),
      xrplAddress: 'rDemoBusiness3SalonBCDEF12345',
      xrplSecret: 'sEdDemoBusinessSalonSecret001',
      isActive: true,
    },
  });

  const laundry = await prisma.business.create({
    data: {
      id: BUSINESS_LAUNDRY_ID,
      name: '크린토피아 역삼점',
      category: '세탁소',
      address: '서울시 강남구 역삼로 50',
      phone: '010-1000-0004',
      email: 'laundry@demo.com',
      registrationNumber: '1010100004',
      registrationVerificationStatus: 'demo_verified',
      registrationVerificationSource: 'demo',
      registrationVerifiedAt: new Date('2026-05-14T00:00:00.000Z'),
      xrplAddress: 'rDemoBusiness4LaundryDEF12345',
      xrplSecret: 'sEdDemoBusinessLaundrySecrt01',
      isActive: true,
    },
  });

  const academy = await prisma.business.create({
    data: {
      id: BUSINESS_ACADEMY_ID,
      name: '정상어학원',
      category: '학원',
      address: '서울시 송파구 올림픽로 300',
      phone: '010-1000-0005',
      email: 'academy@demo.com',
      registrationNumber: '1010100005',
      registrationVerificationStatus: 'demo_verified',
      registrationVerificationSource: 'demo',
      registrationVerifiedAt: new Date('2026-05-14T00:00:00.000Z'),
      xrplAddress: 'rDemoBusiness5AcademyEF12345',
      xrplSecret: 'sEdDemoBusinessAcadSecret0001',
      isActive: true,
    },
  });

  const cafePass = await prisma.businessProduct.create({
    data: {
      id: PRODUCT_CAFE_PASS_ID,
      businessId: cafe.id,
      name: '커피 30잔 이용권',
      description: '음료와 브런치 메뉴를 5 RLUSD 단위로 차감하는 카페 선불권',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      months: 30,
      unitPrice: 5,
      validityMonths: 3,
      menuItems: {
        create: [
          { id: MENU_CAFE_AMERICANO_ID, name: '아메리카노', amount: 5 },
          { id: MENU_CAFE_BRUNCH_ID, name: '브런치 세트', amount: 15 },
          { id: MENU_CAFE_DRIP_BAG_ID, name: '드립백 세트', amount: 30 },
          { id: MENU_CAFE_OFFICE_BOX_ID, name: '오피스 커피 박스', amount: 50 },
        ],
      },
    },
  });

  const gymMembership = await prisma.businessProduct.create({
    data: {
      id: PRODUCT_GYM_MEMBERSHIP_ID,
      businessId: gym.id,
      name: '6개월 헬스 회원권',
      description: '매월 100 RLUSD가 정산되는 월정액 회원권',
      escrowType: 'monthly',
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
    },
  });

  const salonPass = await prisma.businessProduct.create({
    data: {
      id: PRODUCT_SALON_PASS_ID,
      businessId: salon.id,
      name: '헤어살롱 루나 선불권',
      description: '커트, 클리닉, 염색을 메뉴 금액만큼 소비자 승인 후 차감합니다',
      escrowType: 'prepaid',
      totalAmount: 300,
      monthlyAmount: 10,
      months: 30,
      unitPrice: 10,
      validityMonths: 6,
      menuItems: {
        create: [
          { id: MENU_SALON_CUT_ID, name: '커트', amount: 30 },
          { id: MENU_SALON_CLINIC_ID, name: '클리닉', amount: 50 },
          { id: MENU_SALON_COLOR_ID, name: '염색', amount: 80 },
        ],
      },
    },
  });

  const laundryPass = await prisma.businessProduct.create({
    data: {
      id: PRODUCT_LAUNDRY_PASS_ID,
      businessId: laundry.id,
      name: '세탁 정기 이용권',
      description: '와이셔츠, 드라이클리닝, 침구 세탁을 10 RLUSD 단위로 차감합니다',
      escrowType: 'prepaid',
      totalAmount: 120,
      monthlyAmount: 10,
      months: 12,
      unitPrice: 10,
      validityMonths: 4,
      menuItems: {
        create: [
          { id: MENU_LAUNDRY_SHIRTS_ID, name: '와이셔츠 5벌', amount: 10 },
          { id: MENU_LAUNDRY_DRY_CLEANING_ID, name: '드라이클리닝', amount: 30 },
          { id: MENU_LAUNDRY_BEDDING_ID, name: '침구 세탁', amount: 40 },
        ],
      },
    },
  });

  const academyCourse = await prisma.businessProduct.create({
    data: {
      id: PRODUCT_ACADEMY_COURSE_ID,
      businessId: academy.id,
      name: '영어 회화 6개월 과정',
      description: '매월 150 RLUSD가 정산되는 학원 수강권',
      escrowType: 'monthly',
      totalAmount: 900,
      monthlyAmount: 150,
      months: 6,
    },
  });

  // ─── Escrow 1: 진행중 (파워짐 피트니스, 6개월 중 3개월 릴리즈) ───
  const escrow1 = await prisma.escrow.create({
    data: {
      id: ESCROW_ACTIVE_ID,
      consumerId: minsu.id,
      businessId: gym.id,
      productId: gymMembership.id,
      consumerAddress: minsu.xrplAddress,
      businessAddress: gym.xrplAddress,
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      escrowType: 'monthly',
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  for (let m = 1; m <= 6; m++) {
    const finishDate = new Date('2026-02-01');
    finishDate.setMonth(finishDate.getMonth() + m);
    const cancelDate = new Date(finishDate);
    cancelDate.setMonth(cancelDate.getMonth() + 1);

    await prisma.escrowEntry.create({
      data: {
        escrowId: escrow1.id,
        month: m,
        sequence: 1000 + m,
        amount: '100',
        finishAfter: isoToRippleTime(finishDate.toISOString()),
        cancelAfter: isoToRippleTime(cancelDate.toISOString()),
        status: m <= 3 ? 'released' : 'pending',
        txHash: m <= 3 ? `DEMO_TX_HASH_GYM_MONTH_${m}_${Date.now()}` : null,
      },
    });
  }

  // ─── Escrow 2: 완료 (강남 블루보틀, 메뉴별 차감으로 전부 사용) ───
  const escrow2 = await prisma.escrow.create({
    data: {
      id: ESCROW_COMPLETED_ID,
      consumerId: minsu.id,
      businessId: cafe.id,
      productId: cafePass.id,
      consumerAddress: minsu.xrplAddress,
      businessAddress: cafe.xrplAddress,
      totalAmount: 150,
      monthlyAmount: 5,
      months: 30,
      escrowType: 'prepaid',
      unitPrice: 5,
      validityMonths: 3,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'completed',
    },
  });

  const cafeCompletedFinishAfter = isoToRippleTime(new Date('2026-05-01').toISOString());
  const cafeCompletedCancelAfter = isoToRippleTime(new Date('2026-08-01').toISOString());
  for (let m = 1; m <= 30; m++) {
    await prisma.escrowEntry.create({
      data: {
        id: `${escrow2.id}-entry-${m}`,
        escrowId: escrow2.id,
        month: m,
        sequence: 2000 + m,
        amount: '5',
        finishAfter: cafeCompletedFinishAfter,
        cancelAfter: cafeCompletedCancelAfter,
        status: 'released',
        txHash: `DEMO_TX_HASH_CAFE_UNIT_COMPLETED_${m}_${Date.now()}`,
      },
    });
  }

  const cafeCompletedCharges = [
    {
      id: CHARGE_CAFE_COMPLETED_AMERICANO_ID,
      menuItemId: MENU_CAFE_AMERICANO_ID,
      menuName: '아메리카노',
      amount: 5,
      entries: entryIds(escrow2.id, 1, 1),
      approvedAt: '2026-05-03T02:03:00Z',
    },
    {
      id: CHARGE_CAFE_COMPLETED_BRUNCH_ID,
      menuItemId: MENU_CAFE_BRUNCH_ID,
      menuName: '브런치 세트',
      amount: 15,
      entries: entryIds(escrow2.id, 2, 4),
      approvedAt: '2026-05-05T03:12:00Z',
    },
    {
      id: CHARGE_CAFE_COMPLETED_DRIP_BAG_ID,
      menuItemId: MENU_CAFE_DRIP_BAG_ID,
      menuName: '드립백 세트',
      amount: 30,
      entries: entryIds(escrow2.id, 5, 10),
      approvedAt: '2026-05-18T06:20:00Z',
    },
    {
      id: CHARGE_CAFE_COMPLETED_OFFICE_BOX_1_ID,
      menuItemId: MENU_CAFE_OFFICE_BOX_ID,
      menuName: '오피스 커피 박스',
      amount: 50,
      entries: entryIds(escrow2.id, 11, 20),
      approvedAt: '2026-06-03T05:40:00Z',
    },
    {
      id: CHARGE_CAFE_COMPLETED_OFFICE_BOX_2_ID,
      menuItemId: MENU_CAFE_OFFICE_BOX_ID,
      menuName: '오피스 커피 박스',
      amount: 50,
      entries: entryIds(escrow2.id, 21, 30),
      approvedAt: '2026-06-24T05:25:00Z',
    },
  ];
  for (const charge of cafeCompletedCharges) {
    await prisma.chargeRequest.create({
      data: {
        id: charge.id,
        escrowId: escrow2.id,
        consumerId: minsu.id,
        businessId: cafe.id,
        productId: cafePass.id,
        menuItemId: charge.menuItemId,
        menuName: charge.menuName,
        amount: charge.amount,
        status: 'settled',
        entryIds: JSON.stringify(charge.entries),
        approvedAt: new Date(charge.approvedAt),
        settledAt: new Date(charge.approvedAt),
        txHash: `DEMO_TX_HASH_CAFE_${charge.id.slice(-3)}_${Date.now()}`,
      },
    });
  }

  // ─── Escrow 3: 취소됨 (헤어살롱 루나, 4회권 중 1회 사용 후 취소) ───
  const escrow3 = await prisma.escrow.create({
    data: {
      id: ESCROW_CANCELLED_ID,
      consumerId: minsu.id,
      businessId: salon.id,
      productId: salonPass.id,
      consumerAddress: minsu.xrplAddress,
      businessAddress: salon.xrplAddress,
      totalAmount: 400,
      monthlyAmount: 100,
      months: 4,
      escrowType: 'prepaid',
      unitPrice: 100,
      validityMonths: 4,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'cancelled',
    },
  });

  const salonCancelledFinishAfter = isoToRippleTime(new Date('2026-05-01').toISOString());
  const salonCancelledCancelAfter = isoToRippleTime(new Date('2026-09-01').toISOString());
  for (let m = 1; m <= 4; m++) {
    await prisma.escrowEntry.create({
      data: {
        escrowId: escrow3.id,
        month: m,
        sequence: 3000 + m,
        amount: '100',
        finishAfter: salonCancelledFinishAfter,
        cancelAfter: salonCancelledCancelAfter,
        status: m === 1 ? 'released' : 'refunded',
        txHash: `DEMO_TX_HASH_SALON_PREPAID_CANCELLED_${m}_${Date.now()}`,
      },
    });
  }

  // ─── Escrow 4: 이용권 (강남 블루보틀, 30회 중 8회 사용) ───
  const prepaidCafe = await prisma.escrow.create({
    data: {
      id: ESCROW_PREPAID_CAFE_ID,
      consumerId: seoyeon.id,
      businessId: cafe.id,
      productId: cafePass.id,
      consumerAddress: seoyeon.xrplAddress,
      businessAddress: cafe.xrplAddress,
      totalAmount: 150,
      monthlyAmount: 5,
      months: 30,
      escrowType: 'prepaid',
      unitPrice: 5,
      validityMonths: 3,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  const cafeFinishAfter = isoToRippleTime(new Date('2026-05-01').toISOString());
  const cafeCancelAfter = isoToRippleTime(new Date('2026-08-01').toISOString());
  for (let m = 1; m <= 30; m++) {
    await prisma.escrowEntry.create({
      data: {
        id: `${prepaidCafe.id}-entry-${m}`,
        escrowId: prepaidCafe.id,
        month: m,
        sequence: 4000 + m,
        amount: '5',
        finishAfter: cafeFinishAfter,
        cancelAfter: cafeCancelAfter,
        status: m <= 8 ? 'released' : 'pending',
        txHash: m <= 8 ? `DEMO_TX_HASH_CAFE_PREPAID_${m}_${Date.now()}` : null,
      },
    });
  }

  const cafeActiveCharges = [
    {
      id: CHARGE_CAFE_ACTIVE_AMERICANO_1_ID,
      menuItemId: MENU_CAFE_AMERICANO_ID,
      menuName: '아메리카노',
      amount: 5,
      entries: entryIds(prepaidCafe.id, 1, 1),
      approvedAt: '2026-05-06T02:10:00Z',
    },
    {
      id: CHARGE_CAFE_ACTIVE_BRUNCH_1_ID,
      menuItemId: MENU_CAFE_BRUNCH_ID,
      menuName: '브런치 세트',
      amount: 15,
      entries: entryIds(prepaidCafe.id, 2, 4),
      approvedAt: '2026-05-09T03:25:00Z',
    },
    {
      id: CHARGE_CAFE_ACTIVE_AMERICANO_2_ID,
      menuItemId: MENU_CAFE_AMERICANO_ID,
      menuName: '아메리카노',
      amount: 5,
      entries: entryIds(prepaidCafe.id, 5, 5),
      approvedAt: '2026-05-15T01:50:00Z',
    },
    {
      id: CHARGE_CAFE_ACTIVE_BRUNCH_2_ID,
      menuItemId: MENU_CAFE_BRUNCH_ID,
      menuName: '브런치 세트',
      amount: 15,
      entries: entryIds(prepaidCafe.id, 6, 8),
      approvedAt: '2026-05-21T03:40:00Z',
    },
  ];
  for (const charge of cafeActiveCharges) {
    await prisma.chargeRequest.create({
      data: {
        id: charge.id,
        escrowId: prepaidCafe.id,
        consumerId: seoyeon.id,
        businessId: cafe.id,
        productId: cafePass.id,
        menuItemId: charge.menuItemId,
        menuName: charge.menuName,
        amount: charge.amount,
        status: 'settled',
        entryIds: JSON.stringify(charge.entries),
        approvedAt: new Date(charge.approvedAt),
        settledAt: new Date(charge.approvedAt),
        txHash: `DEMO_TX_HASH_CAFE_ACTIVE_${charge.id.slice(-3)}_${Date.now()}`,
      },
    });
  }

  // ─── Escrow 5: 이용권 (헤어살롱 루나, 10회 중 2회 사용) ───
  const prepaidSalon = await prisma.escrow.create({
    data: {
      id: ESCROW_PREPAID_SALON_ID,
      consumerId: minsu.id,
      businessId: salon.id,
      productId: salonPass.id,
      consumerAddress: minsu.xrplAddress,
      businessAddress: salon.xrplAddress,
      totalAmount: 300,
      monthlyAmount: 10,
      months: 30,
      escrowType: 'prepaid',
      unitPrice: 10,
      validityMonths: 6,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  const salonFinishAfter = isoToRippleTime(new Date('2026-05-01').toISOString());
  const salonCancelAfter = isoToRippleTime(new Date('2026-11-01').toISOString());
  for (let m = 1; m <= 30; m++) {
    await prisma.escrowEntry.create({
      data: {
        id: `${prepaidSalon.id}-entry-${m}`,
        escrowId: prepaidSalon.id,
        month: m,
        sequence: 5000 + m,
        amount: '10',
        finishAfter: salonFinishAfter,
        cancelAfter: salonCancelAfter,
        status: m <= 3 ? 'released' : 'pending',
        txHash: m <= 3 ? `DEMO_TX_HASH_SALON_CUT_${m}_${Date.now()}` : null,
      },
    });
  }

  await prisma.chargeRequest.create({
    data: {
      id: CHARGE_SALON_SETTLED_ID,
      escrowId: prepaidSalon.id,
      consumerId: minsu.id,
      businessId: salon.id,
      productId: salonPass.id,
      menuItemId: MENU_SALON_CUT_ID,
      menuName: '커트',
      amount: 30,
      status: 'settled',
      entryIds: JSON.stringify([
        `${prepaidSalon.id}-entry-1`,
        `${prepaidSalon.id}-entry-2`,
        `${prepaidSalon.id}-entry-3`,
      ]),
      approvedAt: new Date('2026-05-10T09:10:00Z'),
      settledAt: new Date('2026-05-10T09:12:00Z'),
      txHash: `DEMO_TX_HASH_SALON_CUT_${Date.now()}`,
    },
  });

  await prisma.chargeRequest.create({
    data: {
      id: CHARGE_SALON_PENDING_ID,
      escrowId: prepaidSalon.id,
      consumerId: minsu.id,
      businessId: salon.id,
      productId: salonPass.id,
      menuItemId: MENU_SALON_CLINIC_ID,
      menuName: '클리닉',
      amount: 50,
      status: 'pending_approval',
      entryIds: JSON.stringify([
        `${prepaidSalon.id}-entry-4`,
        `${prepaidSalon.id}-entry-5`,
        `${prepaidSalon.id}-entry-6`,
        `${prepaidSalon.id}-entry-7`,
        `${prepaidSalon.id}-entry-8`,
      ]),
    },
  });

  // ─── 추가 Escrow: 파워짐 피트니스 (월정액 회원권을 3명으로 분산) ───
  const gymYuna = await prisma.escrow.create({
    data: {
      id: ESCROW_GYM_YUNA_ID,
      consumerId: yuna.id,
      businessId: gym.id,
      productId: gymMembership.id,
      consumerAddress: yuna.xrplAddress,
      businessAddress: gym.xrplAddress,
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      escrowType: 'monthly',
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  for (let m = 1; m <= 6; m++) {
    const finishDate = new Date('2026-03-01');
    finishDate.setMonth(finishDate.getMonth() + m);
    const cancelDate = new Date(finishDate);
    cancelDate.setMonth(cancelDate.getMonth() + 1);

    await prisma.escrowEntry.create({
      data: {
        id: `${gymYuna.id}-entry-${m}`,
        escrowId: gymYuna.id,
        month: m,
        sequence: 6000 + m,
        amount: '100',
        finishAfter: isoToRippleTime(finishDate.toISOString()),
        cancelAfter: isoToRippleTime(cancelDate.toISOString()),
        status: m <= 2 ? 'released' : 'pending',
        txHash: m <= 2 ? `DEMO_TX_HASH_GYM_YUNA_MONTH_${m}_${Date.now()}` : null,
      },
    });
  }

  const gymHajun = await prisma.escrow.create({
    data: {
      id: ESCROW_GYM_HAJUN_ID,
      consumerId: hajun.id,
      businessId: gym.id,
      productId: gymMembership.id,
      consumerAddress: hajun.xrplAddress,
      businessAddress: gym.xrplAddress,
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      escrowType: 'monthly',
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  for (let m = 1; m <= 6; m++) {
    const finishDate = new Date('2026-04-01');
    finishDate.setMonth(finishDate.getMonth() + m);
    const cancelDate = new Date(finishDate);
    cancelDate.setMonth(cancelDate.getMonth() + 1);

    await prisma.escrowEntry.create({
      data: {
        id: `${gymHajun.id}-entry-${m}`,
        escrowId: gymHajun.id,
        month: m,
        sequence: 7000 + m,
        amount: '100',
        finishAfter: isoToRippleTime(finishDate.toISOString()),
        cancelAfter: isoToRippleTime(cancelDate.toISOString()),
        status: m === 1 ? 'released' : 'pending',
        txHash: m === 1 ? `DEMO_TX_HASH_GYM_HAJUN_MONTH_${m}_${Date.now()}` : null,
      },
    });
  }

  await prisma.refundReviewRequest.create({
    data: {
      id: REFUND_REVIEW_GYM_HAJUN_ID,
      escrowId: gymHajun.id,
      consumerId: hajun.id,
      businessId: gym.id,
      status: 'merchant_review',
      refundableAmount: 500,
      merchantRespondBy: new Date('2026-05-20T09:00:00.000Z'),
      businessClosureStatus: 'not_checked',
      consumerReason: '개인 일정으로 이용이 어려워 남은 기간 환불을 요청합니다.',
      merchantNotice: '소비자가 남은 5개월분 환불 검토를 요청했습니다.',
      photoDataUrlsJson: JSON.stringify(['demo://refund/gym-hajun-membership.png']),
      requestedAt: new Date('2026-05-14T08:30:00.000Z'),
    },
  });

  // ─── 추가 Escrow: 헤어살롱 루나 (다른 소비자의 활성 선불권) ───
  const salonDaeun = await prisma.escrow.create({
    data: {
      id: ESCROW_SALON_DAEUN_ID,
      consumerId: daeun.id,
      businessId: salon.id,
      productId: salonPass.id,
      consumerAddress: daeun.xrplAddress,
      businessAddress: salon.xrplAddress,
      totalAmount: 300,
      monthlyAmount: 10,
      months: 30,
      escrowType: 'prepaid',
      unitPrice: 10,
      validityMonths: 6,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  const salonDaeunFinishAfter = isoToRippleTime(new Date('2026-05-08').toISOString());
  const salonDaeunCancelAfter = isoToRippleTime(new Date('2026-11-08').toISOString());
  for (let m = 1; m <= 30; m++) {
    await prisma.escrowEntry.create({
      data: {
        id: `${salonDaeun.id}-entry-${m}`,
        escrowId: salonDaeun.id,
        month: m,
        sequence: 8000 + m,
        amount: '10',
        finishAfter: salonDaeunFinishAfter,
        cancelAfter: salonDaeunCancelAfter,
        status: m <= 8 ? 'released' : 'pending',
        txHash: m <= 8 ? `DEMO_TX_HASH_SALON_DAEUN_COLOR_${m}_${Date.now()}` : null,
      },
    });
  }

  await prisma.chargeRequest.create({
    data: {
      id: CHARGE_SALON_DAEUN_COLOR_ID,
      escrowId: salonDaeun.id,
      consumerId: daeun.id,
      businessId: salon.id,
      productId: salonPass.id,
      menuItemId: MENU_SALON_COLOR_ID,
      menuName: '염색',
      amount: 80,
      status: 'settled',
      entryIds: JSON.stringify(entryIds(salonDaeun.id, 1, 8)),
      approvedAt: new Date('2026-05-12T06:20:00Z'),
      settledAt: new Date('2026-05-12T06:22:00Z'),
      txHash: `DEMO_TX_HASH_SALON_DAEUN_COLOR_${Date.now()}`,
    },
  });

  // ─── 추가 Escrow: 크린토피아 역삼점 (세탁 선불권 2명) ───
  const laundryJihun = await prisma.escrow.create({
    data: {
      id: ESCROW_LAUNDRY_JIHUN_ID,
      consumerId: jihun.id,
      businessId: laundry.id,
      productId: laundryPass.id,
      consumerAddress: jihun.xrplAddress,
      businessAddress: laundry.xrplAddress,
      totalAmount: 120,
      monthlyAmount: 10,
      months: 12,
      escrowType: 'prepaid',
      unitPrice: 10,
      validityMonths: 4,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  const laundryFinishAfter = isoToRippleTime(new Date('2026-05-04').toISOString());
  const laundryCancelAfter = isoToRippleTime(new Date('2026-09-04').toISOString());
  for (let m = 1; m <= 12; m++) {
    await prisma.escrowEntry.create({
      data: {
        id: `${laundryJihun.id}-entry-${m}`,
        escrowId: laundryJihun.id,
        month: m,
        sequence: 9000 + m,
        amount: '10',
        finishAfter: laundryFinishAfter,
        cancelAfter: laundryCancelAfter,
        status: m <= 4 ? 'released' : 'pending',
        txHash: m <= 4 ? `DEMO_TX_HASH_LAUNDRY_JIHUN_${m}_${Date.now()}` : null,
      },
    });
  }

  await prisma.chargeRequest.create({
    data: {
      id: CHARGE_LAUNDRY_JIHUN_SHIRTS_ID,
      escrowId: laundryJihun.id,
      consumerId: jihun.id,
      businessId: laundry.id,
      productId: laundryPass.id,
      menuItemId: MENU_LAUNDRY_SHIRTS_ID,
      menuName: '와이셔츠 5벌',
      amount: 10,
      status: 'settled',
      entryIds: JSON.stringify(entryIds(laundryJihun.id, 1, 1)),
      approvedAt: new Date('2026-05-06T02:30:00Z'),
      settledAt: new Date('2026-05-06T02:32:00Z'),
      txHash: `DEMO_TX_HASH_LAUNDRY_JIHUN_SHIRTS_${Date.now()}`,
    },
  });

  await prisma.chargeRequest.create({
    data: {
      id: CHARGE_LAUNDRY_JIHUN_DRY_CLEANING_ID,
      escrowId: laundryJihun.id,
      consumerId: jihun.id,
      businessId: laundry.id,
      productId: laundryPass.id,
      menuItemId: MENU_LAUNDRY_DRY_CLEANING_ID,
      menuName: '드라이클리닝',
      amount: 30,
      status: 'settled',
      entryIds: JSON.stringify(entryIds(laundryJihun.id, 2, 4)),
      approvedAt: new Date('2026-05-13T03:15:00Z'),
      settledAt: new Date('2026-05-13T03:16:00Z'),
      txHash: `DEMO_TX_HASH_LAUNDRY_JIHUN_DRY_${Date.now()}`,
    },
  });

  const laundryDaeun = await prisma.escrow.create({
    data: {
      id: ESCROW_LAUNDRY_DAEUN_ID,
      consumerId: daeun.id,
      businessId: laundry.id,
      productId: laundryPass.id,
      consumerAddress: daeun.xrplAddress,
      businessAddress: laundry.xrplAddress,
      totalAmount: 120,
      monthlyAmount: 10,
      months: 12,
      escrowType: 'prepaid',
      unitPrice: 10,
      validityMonths: 4,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  const laundryDaeunFinishAfter = isoToRippleTime(new Date('2026-05-11').toISOString());
  const laundryDaeunCancelAfter = isoToRippleTime(new Date('2026-09-11').toISOString());
  for (let m = 1; m <= 12; m++) {
    await prisma.escrowEntry.create({
      data: {
        id: `${laundryDaeun.id}-entry-${m}`,
        escrowId: laundryDaeun.id,
        month: m,
        sequence: 9100 + m,
        amount: '10',
        finishAfter: laundryDaeunFinishAfter,
        cancelAfter: laundryDaeunCancelAfter,
        status: m === 1 ? 'released' : 'pending',
        txHash: m === 1 ? `DEMO_TX_HASH_LAUNDRY_DAEUN_${m}_${Date.now()}` : null,
      },
    });
  }

  await prisma.chargeRequest.create({
    data: {
      id: CHARGE_LAUNDRY_DAEUN_BEDDING_ID,
      escrowId: laundryDaeun.id,
      consumerId: daeun.id,
      businessId: laundry.id,
      productId: laundryPass.id,
      menuItemId: MENU_LAUNDRY_BEDDING_ID,
      menuName: '침구 세탁',
      amount: 40,
      status: 'pending_approval',
      entryIds: JSON.stringify(entryIds(laundryDaeun.id, 2, 5)),
    },
  });

  await prisma.refundReviewRequest.create({
    data: {
      id: REFUND_REVIEW_LAUNDRY_DAEUN_ID,
      escrowId: laundryDaeun.id,
      consumerId: daeun.id,
      businessId: laundry.id,
      status: 'merchant_response_requested',
      refundableAmount: 110,
      merchantRespondBy: new Date('2026-05-21T09:00:00.000Z'),
      businessClosureStatus: 'not_checked',
      consumerReason: '장기 출장으로 남은 세탁권 환불이 필요합니다.',
      merchantNotice: '소비자가 남은 세탁권 환불 검토를 요청했습니다.',
      photoDataUrlsJson: JSON.stringify(['demo://refund/laundry-daeun-receipt.png']),
      requestedAt: new Date('2026-05-15T04:10:00.000Z'),
    },
  });

  // ─── 추가 Escrow: 정상어학원 (월정액 수강권 2명) ───
  const academyYuna = await prisma.escrow.create({
    data: {
      id: ESCROW_ACADEMY_YUNA_ID,
      consumerId: yuna.id,
      businessId: academy.id,
      productId: academyCourse.id,
      consumerAddress: yuna.xrplAddress,
      businessAddress: academy.xrplAddress,
      totalAmount: 900,
      monthlyAmount: 150,
      months: 6,
      escrowType: 'monthly',
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'active',
    },
  });

  for (let m = 1; m <= 6; m++) {
    const finishDate = new Date('2026-03-15');
    finishDate.setMonth(finishDate.getMonth() + m);
    const cancelDate = new Date(finishDate);
    cancelDate.setMonth(cancelDate.getMonth() + 1);

    await prisma.escrowEntry.create({
      data: {
        id: `${academyYuna.id}-entry-${m}`,
        escrowId: academyYuna.id,
        month: m,
        sequence: 9200 + m,
        amount: '150',
        finishAfter: isoToRippleTime(finishDate.toISOString()),
        cancelAfter: isoToRippleTime(cancelDate.toISOString()),
        status: m === 1 ? 'released' : 'pending',
        txHash: m === 1 ? `DEMO_TX_HASH_ACADEMY_YUNA_MONTH_${m}_${Date.now()}` : null,
      },
    });
  }

  const academyHajun = await prisma.escrow.create({
    data: {
      id: ESCROW_ACADEMY_HAJUN_ID,
      consumerId: hajun.id,
      businessId: academy.id,
      productId: academyCourse.id,
      consumerAddress: hajun.xrplAddress,
      businessAddress: academy.xrplAddress,
      totalAmount: 900,
      monthlyAmount: 150,
      months: 6,
      escrowType: 'monthly',
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'completed',
    },
  });

  for (let m = 1; m <= 6; m++) {
    const finishDate = new Date('2025-10-01');
    finishDate.setMonth(finishDate.getMonth() + m);
    const cancelDate = new Date(finishDate);
    cancelDate.setMonth(cancelDate.getMonth() + 1);

    await prisma.escrowEntry.create({
      data: {
        id: `${academyHajun.id}-entry-${m}`,
        escrowId: academyHajun.id,
        month: m,
        sequence: 9300 + m,
        amount: '150',
        finishAfter: isoToRippleTime(finishDate.toISOString()),
        cancelAfter: isoToRippleTime(cancelDate.toISOString()),
        status: 'released',
        txHash: `DEMO_TX_HASH_ACADEMY_HAJUN_MONTH_${m}_${Date.now()}`,
      },
    });
  }

  console.log('Seed complete!');
  console.log(`  Consumer: ${minsu.name} (${minsu.phone})`);
  console.log(`  Consumer: ${seoyeon.name} (${seoyeon.phone})`);
  console.log(`  Consumer: ${jihun.name} (${jihun.phone})`);
  console.log(`  Consumer: ${yuna.name} (${yuna.phone})`);
  console.log(`  Consumer: ${hajun.name} (${hajun.phone})`);
  console.log(`  Consumer: ${daeun.name} (${daeun.phone})`);
  console.log(`  Business: ${cafe.name} (${cafe.phone})`);
  console.log(`  Business: ${gym.name} (${gym.phone})`);
  console.log(`  Business: ${salon.name} (${salon.phone})`);
  console.log(`  Business: ${laundry.name} (${laundry.phone})`);
  console.log(`  Business: ${academy.name} (${academy.phone})`);
  console.log(`  Escrow (active): ${escrow1.id} — ${gym.name}, 6mo, 3/6 released`);
  console.log(`  Escrow (prepaid completed): ${escrow2.id} — ${cafe.name}, menu charges, all released`);
  console.log(`  Escrow (prepaid cancelled): ${escrow3.id} — ${salon.name}, 4 uses, 1 released + 3 refunded`);
  console.log(`  Escrow (prepaid): ${prepaidCafe.id} — ${cafe.name}, 30 RLUSD units, 4 settled charges`);
  console.log(`  Escrow (prepaid): ${prepaidSalon.id} — ${salon.name}, 300 RLUSD, 10 RLUSD units, 1 settled charge + 1 pending approval`);
  console.log(`  Escrow (active): ${gymYuna.id} — ${gym.name}, 6mo, 2/6 released`);
  console.log(`  Escrow (refund review): ${gymHajun.id} — ${gym.name}, merchant review pending`);
  console.log(`  Escrow (prepaid): ${salonDaeun.id} — ${salon.name}, 1 settled color charge`);
  console.log(`  Escrow (prepaid): ${laundryJihun.id} — ${laundry.name}, 2 settled laundry charges`);
  console.log(`  Escrow (refund review): ${laundryDaeun.id} — ${laundry.name}, 1 pending charge + refund review`);
  console.log(`  Escrow (active): ${academyYuna.id} — ${academy.name}, 6mo, 1/6 released`);
  console.log(`  Escrow (completed): ${academyHajun.id} — ${academy.name}, 6mo fully released`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
