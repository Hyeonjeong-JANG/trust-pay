import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

function config(encryptionKey?: string, demoMode = false) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'encryptionKey') return encryptionKey;
      if (key === 'demoMode') return demoMode;
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('CryptoService', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('encrypts and decrypts wallet secrets without preserving plaintext', () => {
    const service = new CryptoService(config('a'.repeat(32)));

    const encrypted = service.encrypt('sTestWalletSecret');

    expect(encrypted).not.toContain('sTestWalletSecret');
    expect(encrypted.split(':')).toHaveLength(3);
    expect(service.decrypt(encrypted)).toBe('sTestWalletSecret');
  });

  it('rejects a missing encryption key', () => {
    expect(() => new CryptoService(config(undefined))).toThrow('ENCRYPTION_KEY is required');
  });

  it('rejects short encryption keys', () => {
    expect(() => new CryptoService(config('too-short'))).toThrow('at least 32 characters');
  });

  it('rejects the demo fallback key outside demo and test environments', () => {
    process.env.NODE_ENV = 'production';

    expect(() => new CryptoService(config('dev-only-key-change-in-prod-32ch'))).toThrow(
      'dev-only encryption key',
    );
  });
});
