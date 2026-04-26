export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  xrpl: {
    network: process.env.XRPL_NETWORK || 'testnet',
    url: process.env.XRPL_URL || 'wss://s.altnet.rippletest.net:51233',
  },
  demoMode: process.env.DEMO_MODE === 'true',
});
