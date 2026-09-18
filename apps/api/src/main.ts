import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(json({ limit: '64kb' }));
  app.use(urlencoded({ extended: false, limit: '16kb' }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_URL'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerEnabled =
    config.get<boolean>('SWAGGER_ENABLED') ??
    config.get<string>('NODE_ENV') !== 'production';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Slotty API')
      .setDescription('API панели владельца и Telegram-ботов')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.getOrThrow<number>('API_PORT');
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
