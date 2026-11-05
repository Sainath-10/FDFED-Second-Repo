import './common/timezone';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { FileLoggerService } from './common/logger/file-logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.useBodyParser('json', { limit: '8mb' });

  const fileLogger = app.get(FileLoggerService);

  // Global Exception / Error Handling Filter
  app.useGlobalFilters(new GlobalExceptionFilter(fileLogger));

  // Enable CORS — configured origins plus any loopback origin. Loopback is
  // always allowed because Vite moves to the next free port when 5173 is taken
  // and browsers may normalise localhost to [::1]; a remote page can never send
  // a loopback Origin, so this does not weaken protection against external sites.
  const allowedOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const loopbackOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin/non-browser requests have no Origin header.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      if (loopbackOrigin.test(origin)) return callback(null, true);
      // Reject by omitting CORS headers rather than throwing: throwing from the
      // origin callback surfaces as a 500 and hides the real cause.
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-user-name', 'x-user-id'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Competition Management API')
    .setDescription(
      'REST API for Competition Management System with Role-based Access Control.\n\n' +
      '**Available Roles:**\n' +
      '- `participant`: Basic user role for participants\n' +
      '- `team_lead`: Can manage teams and competitions\n' +
      '- `community_moderator`: Reviews reports against organisers\n' +
      '- `admin`: Competition, dispute and revenue administration\n' +
      '- `super_admin`: Full system access including user management\n\n' +
      '**Authorization:** Provide a valid JWT token in the `Authorization: Bearer <token>` header.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Competitions', 'Competition management endpoints')
    .addTag('Teams', 'Team management endpoints')
    .addTag('Disputes', 'Dispute and escalation endpoints')
    .addTag('Upload', 'File upload and retrieval endpoints')
    .addTag('Revenue', 'Revenue management endpoints')
    .addTag('Admin', 'Super admin endpoints')
    .addTag('Policies', 'Platform policies endpoints')
    .addTag('Matches', 'Match management endpoints')
    .addTag('Notifications', 'User notification endpoints')
    .build();


  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✓ Server is running on http://localhost:${port}`);
  console.log(`✓ API Documentation available at http://localhost:${port}/api`);
}

bootstrap();
