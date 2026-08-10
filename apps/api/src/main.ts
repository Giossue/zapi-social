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
import { AuditService } from './audit/audit.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { rawBody: true },
  );

  await app.register(fastifyCookie);
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      'application/octet-stream',
      (_request, _payload, done) => done(null),
    );
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
  const audit = app.get(AuditService);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onResponse', (request, reply) =>
      audit.logApiResponse(request, reply.statusCode).catch(() => undefined),
    );
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
