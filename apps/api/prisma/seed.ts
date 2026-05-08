import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RIPPLE_EPOCH = 946684800;
function isoToRippleTime(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000) - RIPPLE_EPOCH;
}

// Stable UUIDs for seed data (deterministic for demo scripts)
const CONSUMER_MINSU_ID = '00000000-0000-4000-a000-000000000001';
const CONSUMER_SEOYEON_ID = '00000000-0000-4000-a000-000000000002';
const BUSINESS_CAFE_ID = '00000000-0000-4000-a000-000000000010';
const BUSINESS_GYM_ID = '00000000-0000-4000-a000-000000000020';
const BUSINESS_SALON_ID = '00000000-0000-4000-a000-000000000030';
const BUSINESS_LAUNDRY_ID = '00000000-0000-4000-a000-000000000040';
const BUSINESS_ACADEMY_ID = '00000000-0000-4000-a000-000000000050';
const ESCROW_ACTIVE_ID = '00000000-0000-4000-a000-000000000100';
const ESCROW_COMPLETED_ID = '00000000-0000-4000-a000-000000000200';
const ESCROW_CANCELLED_ID = '00000000-0000-4000-a000-000000000300';

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.escrowEntry.deleteMany();
  await prisma.escrow.deleteMany();
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

  // ─── Businesses (5) ───
  const cafe = await prisma.business.create({
    data: {
      id: BUSINESS_CAFE_ID,
      name: '강남 블루보틀',
      category: '카페',
      address: '서울시 강남구 테헤란로 152',
      phone: '010-1000-0001',
      email: 'cafe@demo.com',
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
      xrplAddress: 'rDemoBusiness5AcademyEF12345',
      xrplSecret: 'sEdDemoBusinessAcadSecret0001',
      isActive: true,
    },
  });

  // ─── Escrow 1: 진행중 (파워짐 피트니스, 6개월 중 3개월 릴리즈) ───
  const escrow1 = await prisma.escrow.create({
    data: {
      id: ESCROW_ACTIVE_ID,
      consumerId: minsu.id,
      businessId: gym.id,
      consumerAddress: minsu.xrplAddress,
      businessAddress: gym.xrplAddress,
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
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

  // ─── Escrow 2: 완료 (강남 블루보틀, 3개월 전부 릴리즈) ───
  const escrow2 = await prisma.escrow.create({
    data: {
      id: ESCROW_COMPLETED_ID,
      consumerId: minsu.id,
      businessId: cafe.id,
      consumerAddress: minsu.xrplAddress,
      businessAddress: cafe.xrplAddress,
      totalAmount: 450,
      monthlyAmount: 150,
      months: 3,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'completed',
    },
  });

  for (let m = 1; m <= 3; m++) {
    const finishDate = new Date('2025-10-01');
    finishDate.setMonth(finishDate.getMonth() + m);
    const cancelDate = new Date(finishDate);
    cancelDate.setMonth(cancelDate.getMonth() + 1);

    await prisma.escrowEntry.create({
      data: {
        escrowId: escrow2.id,
        month: m,
        sequence: 2000 + m,
        amount: '150',
        finishAfter: isoToRippleTime(finishDate.toISOString()),
        cancelAfter: isoToRippleTime(cancelDate.toISOString()),
        status: 'released',
        txHash: `DEMO_TX_HASH_CAFE_MONTH_${m}_${Date.now()}`,
      },
    });
  }

  // ─── Escrow 3: 취소됨 (헤어살롱 루나, 4개월 중 1개월 릴리즈 후 취소) ───
  const escrow3 = await prisma.escrow.create({
    data: {
      id: ESCROW_CANCELLED_ID,
      consumerId: minsu.id,
      businessId: salon.id,
      consumerAddress: minsu.xrplAddress,
      businessAddress: salon.xrplAddress,
      totalAmount: 400,
      monthlyAmount: 100,
      months: 4,
      currency: 'RLUSD',
      issuer: 'rDemoIssuerRLUSD000000000001',
      status: 'cancelled',
    },
  });

  for (let m = 1; m <= 4; m++) {
    const finishDate = new Date('2025-12-01');
    finishDate.setMonth(finishDate.getMonth() + m);
    const cancelDate = new Date(finishDate);
    cancelDate.setMonth(cancelDate.getMonth() + 1);

    await prisma.escrowEntry.create({
      data: {
        escrowId: escrow3.id,
        month: m,
        sequence: 3000 + m,
        amount: '100',
        finishAfter: isoToRippleTime(finishDate.toISOString()),
        cancelAfter: isoToRippleTime(cancelDate.toISOString()),
        status: m === 1 ? 'released' : 'refunded',
        txHash: `DEMO_TX_HASH_SALON_MONTH_${m}_${Date.now()}`,
      },
    });
  }

  console.log('Seed complete!');
  console.log(`  Consumer: ${minsu.name} (${minsu.phone})`);
  console.log(`  Consumer: ${seoyeon.name} (${seoyeon.phone})`);
  console.log(`  Business: ${cafe.name} (${cafe.phone})`);
  console.log(`  Business: ${gym.name} (${gym.phone})`);
  console.log(`  Business: ${salon.name} (${salon.phone})`);
  console.log(`  Business: ${laundry.name} (${laundry.phone})`);
  console.log(`  Business: ${academy.name} (${academy.phone})`);
  console.log(`  Escrow (active): ${escrow1.id} — ${gym.name}, 6mo, 3/6 released`);
  console.log(`  Escrow (completed): ${escrow2.id} — ${cafe.name}, 3mo, all released`);
  console.log(`  Escrow (cancelled): ${escrow3.id} — ${salon.name}, 4mo, 1 released + 3 refunded`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
