import type { NestExpressApplication } from '@nestjs/platform-express';

const JSON_BODY_LIMIT = '10mb';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:4173',
];

const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Admin-Id', 'X-Admin-Secret'];

export function getCorsOrigins(corsOrigin?: string): true | string[] {
  if (corsOrigin === '*') return true;
  if (corsOrigin) return corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  return DEFAULT_CORS_ORIGINS;
}

export function getCorsAllowedHeaders(): string[] {
  return CORS_ALLOWED_HEADERS;
}

export function configureHttpApp(app: NestExpressApplication) {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });
}
