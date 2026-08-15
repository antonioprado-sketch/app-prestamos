import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditModule } from './audit/audit.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { AdminBootstrapModule } from './admin-bootstrap/admin-bootstrap.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { LoansModule } from './loans/loans.module';
import { CustomersModule } from './customers/customers.module';
import { StorageModule } from './storage/storage.module';
import { DocumentsModule } from './documents/documents.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { ScoreModule } from './score/score.module';
import { CollectorLoansModule } from './collector/collector-loans.module';
import { LocationsModule } from './locations/locations.module';
import { BiModule } from './bi/bi.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: { level: 'info', transport: { target: 'pino-pretty' } },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuditModule,
    EmailModule,
    ConfigurationModule,
    StorageModule,
    HealthModule,
    AuthModule,
    AdminBootstrapModule,
    LoansModule,
    CustomersModule,
    DocumentsModule,
    AdminModule,
    PaymentsModule,
    ScoreModule,
    CollectorLoansModule,
    LocationsModule,
    BiModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
