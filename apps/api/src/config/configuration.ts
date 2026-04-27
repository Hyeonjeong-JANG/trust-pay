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
  escrowFastMode: process.env.ESCROW_FAST_MODE === 'true',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-only-key-change-in-prod-32ch',
});
