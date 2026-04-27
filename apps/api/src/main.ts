import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081', 'http://localhost:19006'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-user-id', 'x-user-role'],
  });
  await app.listen(3000);
  console.log('API running on http://localhost:3000');
}
bootstrap();
