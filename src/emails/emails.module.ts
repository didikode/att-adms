import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { ReportSchedulesModule } from '../report-schedules/report-schedules.module';
import { EmailsService } from './emails.service';
@Module({ imports: [ReportsModule, ReportSchedulesModule], providers: [EmailsService] }) export class EmailsModule {}
