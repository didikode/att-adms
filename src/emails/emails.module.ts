import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { ReportSchedulesModule } from '../report-schedules/report-schedules.module';
import { AuthModule } from '../auth/auth.module';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
@Module({ imports: [AuthModule, ReportsModule, ReportSchedulesModule], controllers: [EmailsController], providers: [EmailsService], exports: [EmailsService] }) export class EmailsModule {}
