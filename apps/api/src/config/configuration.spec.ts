import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not default ENCRYPTION_KEY in production-like mode', () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.DEMO_MODE = 'false';
    process.env.NODE_ENV = 'production';

    expect(configuration().encryptionKey).toBe('');
  });

  it('keeps the dev-only fallback for demo mode only', () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.DEMO_MODE = 'true';

    expect(configuration().encryptionKey).toBe('dev-only-key-change-in-prod-32ch');
  });
});
