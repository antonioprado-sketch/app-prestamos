import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      // La API es JSON puro (nunca sirve HTML/scripts) — en producción se
      // bloquea todo. En dev queda desactivada porque Swagger UI (montado
      // más abajo, solo fuera de producción) necesita estilos/scripts
      // inline que esta CSP rompería. La CSP real que protege a la SPA
      // vive en Nginx (docker/nginx/nginx.*.conf), no acá — Nginx sirve
      // el HTML de verdad, esta API nunca lo hace.
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'none'"],
              formAction: ["'none'"],
            },
          }
        : false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AppPrestamitos API')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup(
      'api/v1/docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
