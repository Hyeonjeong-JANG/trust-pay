import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSeed() {
  return readFileSync(join(__dirname, '../prisma/seed.ts'), 'utf8');
}

function distinctConsumerRefsForBusiness(seed: string, businessRef: string): Set<string> {
  const escrowBlocks = seed.matchAll(/await prisma\.escrow\.create\(\{\s*data:\s*\{([\s\S]*?)\n\s*\},?\s*\}\);/g);
  const consumers = new Set<string>();
  for (const match of escrowBlocks) {
    const block = match[1] ?? '';
    if (!block.includes(`businessId: ${businessRef}.id`)) continue;
    const consumerMatch = block.match(/consumerId: (\w+)\.id/);
    if (consumerMatch?.[1]) consumers.add(consumerMatch[1]);
  }
  return consumers;
}

describe('demo seed distribution', () => {
  it('creates enough demo consumers for varied business dashboards', () => {
    const seed = readSeed();

    for (const name of ['김민수', '이서연', '박지훈', '최유나', '오하준', '정다은']) {
      expect(seed).toContain(`name: '${name}'`);
    }
  });

  it('spreads escrow customers across every demo business', () => {
    const seed = readSeed();

    expect(distinctConsumerRefsForBusiness(seed, 'cafe').size).toBeGreaterThanOrEqual(2);
    expect(distinctConsumerRefsForBusiness(seed, 'gym').size).toBeGreaterThanOrEqual(3);
    expect(distinctConsumerRefsForBusiness(seed, 'salon').size).toBeGreaterThanOrEqual(2);
    expect(distinctConsumerRefsForBusiness(seed, 'laundry').size).toBeGreaterThanOrEqual(2);
    expect(distinctConsumerRefsForBusiness(seed, 'academy').size).toBeGreaterThanOrEqual(2);
  });
});
