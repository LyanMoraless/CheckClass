import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Frontend (a different origin — e.g. Vite's dev server on :5173) needs
  // this to call the API directly from the browser. No credentials: true —
  // the JWT is a Bearer header, not a cookie, so there's nothing that needs
  // cross-origin cookie handling.
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN')?.split(',') });

  app.useGlobalFilters(new HttpExceptionFilter());
  // 422, not the default 400: a well-formed request whose payload shape is
  // invalid for the given event_type is a semantic error, not a syntax one
  // (matches the ingestion contract's 400/401/403/422 no-retry response set).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

bootstrap();
