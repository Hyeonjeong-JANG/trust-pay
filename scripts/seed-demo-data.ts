#!/usr/bin/env npx tsx
/**
 * 데모 시드 데이터 스크립트
 *
 * 실행: DATABASE_URL="file:./dev.db" npx tsx scripts/seed-demo-data.ts
 *
 * 생성 데이터:
 *  - 사업자 5개 (카페, 헬스장, 미용실, 세탁소, 학원)
 *  - 소비자 2명
 *  - 에스크로 2건 (각 3개월)
 *
 * xrplSecret은 AES-256-GCM으로 암호화됨 (CryptoService와 동일 로직)
 */

import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

// ─── 암호화 (CryptoService와 동일 로직) ───
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-only-change-in-production-32ch';
const SALT = 'prepaid-shield-v1';
const key = scryptSync(ENCRYPTION_KEY, SALT, 32);

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

// 가짜 XRPL 주소 (데모용)
function fakeAddr(prefix: string, i: number) {
  return `r${prefix}Demo${String(i).padStart(4, '0')}TestAddr`;
}

async function main() {
  console.log('🌱 데모 시드 데이터 생성 시작...\n');

  // Clean existing
  await prisma.escrowEntry.deleteMany();
  await prisma.escrow.deleteMany();
  await prisma.consumer.deleteMany();
  await prisma.business.deleteMany();
  console.log('🗑️  기존 데이터 초기화 완료');

  // ─── 사업자 5개 ───
  const businesses = [
    { name: '강남 블루보틀', category: '카페', address: '서울시 강남구 테헤란로 152', phone: '010-1000-0001', email: 'cafe@demo.com' },
    { name: '파워짐 피트니스', category: '헬스장', address: '서울시 서초구 서초대로 100', phone: '010-1000-0002', email: 'gym@demo.com' },
    { name: '헤어살롱 루나', category: '미용실', address: '서울시 마포구 홍대입구 22', phone: '010-1000-0003', email: 'salon@demo.com' },
    { name: '크린토피아 역삼점', category: '세탁소', address: '서울시 강남구 역삼로 50', phone: '010-1000-0004', email: 'laundry@demo.com' },
    { name: '정상어학원', category: '학원', address: '서울시 송파구 올림픽로 300', phone: '010-1000-0005', email: 'academy@demo.com' },
  ];

  const createdBusinesses = [];
  for (let i = 0; i < businesses.length; i++) {
    const b = await prisma.business.create({
      data: {
        ...businesses[i],
        xrplAddress: fakeAddr('Biz', i + 1),
        xrplSecret: encrypt(`sDemoSecret_biz_${i + 1}`),
      },
    });
    createdBusinesses.push(b);
    console.log(`  🏪 ${b.name} (${b.id.slice(0, 8)}...)`);
  }

  // ─── 소비자 2명 ───
  const consumers = [
    { name: '김민수', phone: '010-2000-0001', email: 'minsu@demo.com' },
    { name: '이서연', phone: '010-2000-0002', email: 'seoyeon@demo.com' },
  ];

  const createdConsumers = [];
  for (let i = 0; i < consumers.length; i++) {
    const c = await prisma.consumer.create({
      data: {
        ...consumers[i],
        xrplAddress: fakeAddr('Con', i + 1),
        xrplSecret: encrypt(`sDemoSecret_con_${i + 1}`),
      },
    });
    createdConsumers.push(c);
    console.log(`  👤 ${c.name} (${c.id.slice(0, 8)}...)`);
  }

  // ─── 에스크로 2건 ───
  console.log('\n📋 에스크로 생성...');

  // 에스크로 1: 김민수 → 강남 블루보틀 (카페 선불 3개월)
  await prisma.escrow.create({
    data: {
      consumerId: createdConsumers[0].id,
      businessId: createdBusinesses[0].id,
      consumerAddress: createdConsumers[0].xrplAddress,
      businessAddress: createdBusinesses[0].xrplAddress,
      totalAmount: 150000,
      monthlyAmount: 50000,
      months: 3,
      issuer: 'rDemoIssuerAddr',
      status: 'active',
      entries: {
        create: [
          { month: 1, sequence: 1001, amount: '50000', finishAfter: 0, cancelAfter: 0, status: 'released', txHash: 'TX_DEMO_RELEASED_1' },
          { month: 2, sequence: 1002, amount: '50000', finishAfter: 0, cancelAfter: 0, status: 'pending' },
          { month: 3, sequence: 1003, amount: '50000', finishAfter: 0, cancelAfter: 0, status: 'pending' },
        ],
      },
    },
    include: { entries: true },
  });
  console.log(`  📦 ${createdConsumers[0].name} → ${createdBusinesses[0].name}: 150,000 RLUSD (1/3 released)`);

  // 에스크로 2: 이서연 → 파워짐 피트니스 (헬스장 3개월)
  await prisma.escrow.create({
    data: {
      consumerId: createdConsumers[1].id,
      businessId: createdBusinesses[1].id,
      consumerAddress: createdConsumers[1].xrplAddress,
      businessAddress: createdBusinesses[1].xrplAddress,
      totalAmount: 300000,
      monthlyAmount: 100000,
      months: 3,
      issuer: 'rDemoIssuerAddr',
      status: 'active',
      entries: {
        create: [
          { month: 1, sequence: 2001, amount: '100000', finishAfter: 0, cancelAfter: 0, status: 'pending' },
          { month: 2, sequence: 2002, amount: '100000', finishAfter: 0, cancelAfter: 0, status: 'pending' },
          { month: 3, sequence: 2003, amount: '100000', finishAfter: 0, cancelAfter: 0, status: 'pending' },
        ],
      },
    },
    include: { entries: true },
  });
  console.log(`  📦 ${createdConsumers[1].name} → ${createdBusinesses[1].name}: 300,000 RLUSD (0/3 released)`);

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ 데모 시드 데이터 생성 완료');
  console.log(`  사업자 ${createdBusinesses.length}개, 소비자 ${createdConsumers.length}명, 에스크로 2건`);
  console.log('═══════════════════════════════════════════');
  console.log('\n데모 로그인 정보:');
  console.log('  소비자: 010-2000-0001 (김민수) / 010-2000-0002 (이서연)');
  console.log('  사업자: 010-1000-0001 (강남 블루보틀) ~ 010-1000-0005 (정상어학원)');
  console.log(`  ENCRYPTION_KEY: ${ENCRYPTION_KEY === 'dev-only-change-in-production-32ch' ? '(기본값)' : '(커스텀)'}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ 시드 실패:', e);
  process.exit(1);
});
