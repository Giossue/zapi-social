import fastifyCookie from '@fastify/cookie';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './platform/errors/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie);
  const webOrigins = Array.from(
    new Set([
      process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]),
  );

  app.enableCors({
    origin: webOrigins,
    credentials: true,
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Zapi API')
      .setDescription('REST API for Zapi V2')
      .setVersion('v1')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  await app.listen({
    host: process.env.API_HOST ?? '127.0.0.1',
    port: Number(process.env.API_PORT ?? 3001),
  });
}

void bootstrap();
