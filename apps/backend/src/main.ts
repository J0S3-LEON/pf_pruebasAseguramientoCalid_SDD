/**
 * Punto de entrada principal del backend NestJS de MindFlow.
 * Configura el prefijo global de la API, los pipes de validación,
 * filtros de excepciones globales y opciones de seguridad.
 *
 * Incluye lógica de reintento para la conexión a PostgreSQL al arrancar
 * (5 reintentos con intervalo de 5 s) — Requisito 8.5
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';
import { ResponseInterceptor } from './common/interceptors';
import helmet from 'helmet';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5_000;

/**
 * Retry wrapper that attempts to bootstrap the NestJS application.
 * Catches bootstrap errors (e.g. DB connection failures during module init)
 * and retries up to MAX_RETRIES times before exiting with a non-zero code.
 */
async function bootstrapWithRetry(): Promise<void> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await bootstrap();
      return; // success — exit the retry loop
    } catch (error) {
      attempt += 1;
      const remaining = MAX_RETRIES - attempt;

      if (remaining === 0) {
        console.error(
          `[Bootstrap] Application failed to start after ${MAX_RETRIES} attempts. Exiting.`,
          error,
        );
        process.exit(1);
      }

      console.warn(
        `[Bootstrap] Attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${RETRY_INTERVAL_MS / 1000}s... (${remaining} retries left)`,
        error instanceof Error ? error.message : error,
      );

      await new Promise<void>((resolve) =>
        setTimeout(resolve, RETRY_INTERVAL_MS),
      );
    }
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Seguridad HTTP — Requisito 9.5
  app.use(helmet());

  // CORS restringido al origen del frontend — Requisito 9.5
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Prefijo global de la API — Requisito 9.3
  app.setGlobalPrefix('api/v1');

  // Filtro global de excepciones: transforma todo al envelope { data, error, status } — Requisito 9.4, 9.5
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Interceptor global: envuelve respuestas exitosas en { data, error: null, status } — Requisito 9.4, 9.5
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Pipe de validación global con whitelist y rechazo de propiedades no permitidas
  // Retorna HTTP 422 para payloads inválidos — Requisito 9.4
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 422,
    }),
  );

  // Puerto configurable mediante variable de entorno
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

bootstrapWithRetry();
