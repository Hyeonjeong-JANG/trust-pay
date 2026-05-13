export const DEMO_RLUSD_KRW_RATE = 1350;

const RLUSD_DECIMAL_PLACES = 6;

export function roundRlusd(value: number): number {
  return Number(value.toFixed(RLUSD_DECIMAL_PLACES));
}

export function parseKrwInput(value: string): number {
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

export function krwToRlusd(value: number | string): number {
  const krw = typeof value === 'string' ? parseKrwInput(value) : value;
  if (!Number.isFinite(krw) || krw <= 0) return 0;
  return roundRlusd(krw / DEMO_RLUSD_KRW_RATE);
}

export function rlusdToKrw(value: number | string): number {
  const rlusd = Number(value);
  if (!Number.isFinite(rlusd) || rlusd <= 0) return 0;
  return Math.round(rlusd * DEMO_RLUSD_KRW_RATE);
}

export function formatKrw(value: number | string): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₩${safeAmount.toLocaleString('ko-KR')}`;
}

export function formatKrwFromRlusd(value: number | string): string {
  return formatKrw(rlusdToKrw(value));
}

export function formatRlusd(value: number | string): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: RLUSD_DECIMAL_PLACES,
  })} RLUSD`;
}

export function getWholeUnitCount(total: number, unit: number): number | null {
  if (!Number.isFinite(total) || !Number.isFinite(unit) || total <= 0 || unit <= 0) return null;
  const count = total / unit;
  const rounded = Math.round(count);
  return Math.abs(count - rounded) <= 1e-4 ? rounded : null;
}
