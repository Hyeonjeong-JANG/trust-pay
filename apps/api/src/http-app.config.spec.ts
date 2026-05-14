import { getCorsAllowedHeaders, getCorsOrigins } from './http-app.config';

describe('HTTP app config', () => {
  it('allows the local admin console origin by default', () => {
    expect(getCorsOrigins(undefined)).toContain('http://localhost:4173');
  });

  it('keeps explicit wildcard CORS origin support', () => {
    expect(getCorsOrigins('*')).toBe(true);
  });

  it('uses explicit CORS origins when configured', () => {
    expect(getCorsOrigins('https://admin.example.com,https://app.example.com')).toEqual([
      'https://admin.example.com',
      'https://app.example.com',
    ]);
  });

  it('allows admin auth headers for browser preflight requests', () => {
    expect(getCorsAllowedHeaders()).toEqual(expect.arrayContaining(['X-Admin-Id', 'X-Admin-Secret']));
  });
});
