import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = 'prepaid-shield-v1'; // static salt — key uniqueness comes from ENCRYPTION_KEY

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const secret = this.configService.get<string>('encryptionKey');
    if (!secret) {
      throw new Error('ENCRYPTION_KEY is required — set it in .env');
    }
    // Derive 32-byte key from passphrase using scrypt
    this.key = scryptSync(secret, SALT, 32);
  }

  /** Encrypt plaintext → "iv:tag:ciphertext" (hex-encoded) */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  /** Decrypt "iv:tag:ciphertext" → plaintext */
  decrypt(encoded: string): string {
    const parts = encoded.split(':');
    if (parts.length !== 3) {
      // Not encrypted (legacy plaintext) — return as-is for migration compatibility
      return encoded;
    }
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
      // Format doesn't match — likely legacy plaintext containing colons
      return encoded;
    }

    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  }
}
