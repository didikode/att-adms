import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { IclockModule } from './iclock/iclock.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiModule } from './api/api.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { AuditModule } from './audit/audit.module';
import { TransactionsModule } from './transactions/transactions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DevicesModule } from './devices/devices.module';
import { ReportsModule } from './reports/reports.module';
import { EmailsModule } from './emails/emails.module';
import { ReportSchedulesModule } from './report-schedules/report-schedules.module';
import { EmployeeCandidatesModule } from './employee-candidates/employee-candidates.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'web', 'dist'),
      exclude: ['/api{*splat}', '/iclock{*splat}'],
    }),
    PrismaModule,
    IclockModule,
    AuthModule,
    ApiModule,
    AuditModule,
    EmployeesModule,
    TransactionsModule,
    DashboardModule,
    DevicesModule,
    ReportsModule,
    EmailsModule,
    ReportSchedulesModule,
    EmployeeCandidatesModule,
  ],
})
export class AppModule {}
