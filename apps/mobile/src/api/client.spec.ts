jest.mock('@react-native-async-storage/async-storage', () => (
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

const { resolveApiBase } = require('./client');

describe('api client base URL resolution', () => {
  it('uses the local API server when a /api bundle is opened on localhost', () => {
    expect(resolveApiBase('/api', 'localhost')).toBe('http://localhost:3000');
    expect(resolveApiBase('/api', '127.0.0.1')).toBe('http://localhost:3000');
  });

  it('keeps /api for deployed hosts with a rewrite', () => {
    expect(resolveApiBase('/api', 'xrpl-tawny.vercel.app')).toBe('/api');
  });

  it('keeps explicit API origins unchanged', () => {
    expect(resolveApiBase('http://localhost:3000', 'localhost')).toBe('http://localhost:3000');
  });

  it('uses localhost API when a LAN API URL is opened from localhost web', () => {
    expect(resolveApiBase('http://192.168.35.19:3000', 'localhost')).toBe('http://localhost:3000');
  });
});
