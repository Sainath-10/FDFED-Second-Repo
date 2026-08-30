import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { FileLoggerService } from './common/logger/file-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const fileLogger = app.get(FileLoggerService);

  // Global Exception / Error Handling Filter
  app.useGlobalFilters(new GlobalExceptionFilter(fileLogger));

  // Enable CORS
  app.enableCors();

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
    .setTitle('Nexus Esports Competition Management & Revenue API')
    .setDescription(
      'REST API for Competition Management System with Role-based Access Control and Revenue Engine.\n\n' +
      '**Authentication:**\n' +
      '- **JWT Bearer Token:** Use `Authorization: Bearer <access_token>` from `/auth/login` or `/auth/register`\n' +
      '- **Header Role Auth:** Alternatively send `x-user-role` header for direct testing\n' +
      '- **Partner API Key:** Include `x-api-key` for `/partner/*` B2B routes\n\n' +
      '**Revenue Engine:**\n' +
      '- **Platform Fee:** `max(₹50, 7% of Prize Pool)` collected upon competition setup\n' +
      '- **Prize Pool & Entry Fees:** Fully tracked with complete transaction history',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter your JWT access token' },
      'bearer',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-user-role', description: 'B2C: User role header — participant | admin | super_admin | team_lead' },
      'x-user-role',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'B2B: Partner API key for /partner/* routes' },
      'x-api-key',
    )
    .addTag('Auth', 'Authentication endpoints — login, register, profile')
    .addTag('Competitions', 'Competition management endpoints')
    .addTag('Teams', 'Team management endpoints')
    .addTag('Disputes', 'Disputes management (against organizers and against users/teams)')
    .addTag('Revenue', 'Revenue model & financial tracking — max(₹50, 7% of prize pool)')
    .addTag('Admin', 'Administrator panel management & platform analytics')
    .addTag('Upload', 'File upload and retrieval endpoints')
    .addTag('Partner', 'B2B Partner API with API key authentication')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✓ Server is running on http://localhost:${port}`);
  console.log(`✓ API Documentation available at http://localhost:${port}/api`);
}

bootstrap();
