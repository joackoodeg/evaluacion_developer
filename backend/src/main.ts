import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Solo los orígenes listados pueden llamar a la API desde el navegador.
  // Varios orígenes separados por coma: "http://localhost:5173,https://mi-front.up.railway.app"
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGIN').split(','),
  });

  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
