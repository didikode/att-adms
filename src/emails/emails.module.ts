import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { EmailsService } from './emails.service';
@Module({ imports: [ReportsModule], providers: [EmailsService] }) export class EmailsModule {}
