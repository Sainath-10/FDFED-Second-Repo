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

  // Enable CORS — restrict to known frontend origin
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
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
      '- `comp_admin`: Competition administrator\n' +
      '- `dispute_admin`: Dispute administrator\n' +
      '- `revenue_admin`: Revenue administrator\n' +
      '- `admin`: Administrative access to most features\n' +
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
