import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureHttpApp, getCorsAllowedHeaders, getCorsOrigins } from './http-app.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttpApp(app);
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: getCorsOrigins(corsOrigin),
    methods: ['GET', 'POST'],
    allowedHeaders: getCorsAllowedHeaders(),
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
