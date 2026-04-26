import { isoTimeToRippleTime, rippleTimeToISOTime, dropsToXrp as xrplDropsToXrp, xrpToDrops as xrplXrpToDrops } from 'xrpl';

/**
 * Ripple Epoch starts at 2000-01-01T00:00:00Z (946684800 Unix seconds).
 * Always use xrpl.js helpers — never do manual epoch math.
 */
export function isoToRippleTime(isoDate: string): number {
  return isoTimeToRippleTime(isoDate);
}

export function rippleTimeToIso(rippleTime: number): string {
  return rippleTimeToISOTime(rippleTime);
}

export function dropsToXrp(drops: string): number {
  return xrplDropsToXrp(drops);
}

export function xrpToDrops(xrp: string): string {
  return xrplXrpToDrops(xrp);
}

/**
 * Calculate a date N months from now.
 * For demo mode, each "month" = 2 minutes.
 */
export function monthsFromNow(months: number, demoMode = false): Date {
  const now = new Date();
  if (demoMode) {
    return new Date(now.getTime() + months * 2 * 60 * 1000);
  }
  const result = new Date(now);
  result.setMonth(result.getMonth() + months);
  return result;
}
