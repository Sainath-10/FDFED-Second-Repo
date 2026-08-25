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
    .setTitle('Competition Management API')
    .setDescription(
      'REST API for Competition Management System with Role-based Access Control.\n\n' +
      '**Available Roles:**\n' +
      '- `participant`: Basic user role for participants\n' +
      '- `team_lead`: Can manage teams and competitions\n' +
      '- `admin`: Administrative access to most features\n' +
      '- `super_admin`: Full access including deletion rights\n\n' +
      '**Authorization:** Include `x-user-role` header with one of the above roles.',
    )
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-user-role', description: 'User role: participant | admin | super_admin | team_lead' },
      'x-user-role',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Competitions', 'Competition management endpoints')
    .addTag('Teams', 'Team management endpoints')
    .addTag('Disputes', 'Dispute and escalation endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✓ Server is running on http://localhost:${port}`);
  console.log(`✓ API Documentation available at http://localhost:${port}/api`);
}

bootstrap();
