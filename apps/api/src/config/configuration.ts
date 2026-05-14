const DEV_ONLY_ENCRYPTION_KEY = 'dev-only-key-change-in-prod-32ch';

function defaultEncryptionKey() {
  if (process.env.ENCRYPTION_KEY) return process.env.ENCRYPTION_KEY;
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test') {
    return DEV_ONLY_ENCRYPTION_KEY;
  }
  return '';
}

export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  xrpl: {
    network: process.env.XRPL_NETWORK || 'testnet',
    url: process.env.XRPL_URL || 'wss://s.altnet.rippletest.net:51233',
  },
  rlusd: {
    issuer: process.env.RLUSD_ISSUER || 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKm',
    currency: process.env.RLUSD_CURRENCY || 'RLUSD',
    issuerSeed: process.env.RLUSD_ISSUER_SEED || '',
    fundingAmount: process.env.RLUSD_FUNDING_AMOUNT || '10000',
  },
  demoMode: process.env.DEMO_MODE === 'true',
  authDemoOtp: process.env.AUTH_DEMO_OTP === 'true',
  escrowFastMode: process.env.ESCROW_FAST_MODE === 'true',
  encryptionKey: defaultEncryptionKey(),
  nts: {
    statusUrl: process.env.NTS_BUSINESS_STATUS_URL || 'https://api.odcloud.kr/api/nts-businessman/v1/status',
    serviceKey: process.env.NTS_BUSINESS_STATUS_SERVICE_KEY || '',
  },
});
