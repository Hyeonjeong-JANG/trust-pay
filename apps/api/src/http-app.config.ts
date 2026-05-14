import type { NestExpressApplication } from '@nestjs/platform-express';

const JSON_BODY_LIMIT = '10mb';

export function configureHttpApp(app: NestExpressApplication) {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });
}
