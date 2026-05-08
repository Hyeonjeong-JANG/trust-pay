#!/usr/bin/env npx tsx
/**
 * 데모 시드 데이터 스크립트 (prisma/seed.ts로 위임)
 *
 * 이전에는 별도 데이터셋을 사용했으나, KFIP 제출을 위해
 * prisma/seed.ts와 통합되었습니다.
 *
 * 실행 방법:
 *   cd apps/api && npm run seed
 *   또는
 *   cd apps/api && DATABASE_URL="file:./dev.db" npx ts-node prisma/seed.ts
 */

console.log('이 스크립트는 prisma/seed.ts로 통합되었습니다.');
console.log('아래 명령으로 실행하세요:\n');
console.log('  cd apps/api && npm run seed\n');
process.exit(0);
