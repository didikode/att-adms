import { Module } from '@nestjs/common';
import { IclockModule } from './iclock/iclock.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiModule } from './api/api.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [PrismaModule, IclockModule, AuthModule, ApiModule, AuditModule, EmployeesModule],
})
export class AppModule {}
