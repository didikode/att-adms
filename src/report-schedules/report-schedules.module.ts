import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportSchedulesController } from './report-schedules.controller';
import { ReportSchedulesService } from './report-schedules.service';
@Module({ imports: [AuthModule], controllers: [ReportSchedulesController], providers: [ReportSchedulesService], exports: [ReportSchedulesService] }) export class ReportSchedulesModule {}
