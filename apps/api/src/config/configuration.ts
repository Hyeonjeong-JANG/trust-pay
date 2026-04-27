export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  xrpl: {
    network: process.env.XRPL_NETWORK || 'testnet',
    url: process.env.XRPL_URL || 'wss://s.altnet.rippletest.net:51233',
  },
  rlusd: {
    issuer: process.env.RLUSD_ISSUER || 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKm',
    currency: process.env.RLUSD_CURRENCY || 'RLUSD',
  },
  demoMode: process.env.DEMO_MODE === 'true',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-only-change-in-production-32ch',
});
