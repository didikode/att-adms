import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { ReportsService } from '../reports/reports.service';
import { ReportFrequency, ReportScope } from '@prisma/client';
import { ReportSchedulesService } from '../report-schedules/report-schedules.service';

@Injectable()
export class EmailsService implements OnModuleInit {
  private readonly logger = new Logger(EmailsService.name);
  constructor(private readonly reports: ReportsService, private readonly schedules: ReportSchedulesService) {}
  onModuleInit() {
    if (process.env.REPORT_SCHEDULE_ENABLED !== 'true') return;
    cron.schedule('* * * * *', () => void this.runDue(), { timezone: 'Asia/Jakarta' });
    this.logger.log('Jadwal laporan email berbasis menu aktif');
  }
  private transport() {
    const host = process.env.SMTP_HOST; const port = Number(process.env.SMTP_PORT ?? 587); const user = process.env.SMTP_USERNAME; const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) throw new Error('File SMTP tidak lengkap');
    return nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth: { user, pass } });
  }
  private async send(from: string, to: string, subject: string, recipients: string[], employeeId?: string, divisionName?: string) {
    const pdf = await this.reports.attendancePdf(from, to, employeeId, divisionName);
    await this.transport().sendMail({ from: process.env.MAIL_FROM, to: recipients, subject, text: `Terlampir laporan absensi WIB periode ${from} sampai ${to}.`, attachments: [{ filename: `laporan-absensi-${from}-${to}.pdf`, content: pdf, contentType: 'application/pdf' }] });
  }
  private date(offset: number) { const date = new Date(Date.now() + offset * 86400000); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date); }
  async runDue() {
    const pieces = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const part = (type: string) => pieces.find((item) => item.type === type)?.value ?? ''; const time = `${part('hour')}:${part('minute')}`; const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
    const schedules = [...await this.schedules.due(ReportFrequency.DAILY, null, time), ...await this.schedules.due(ReportFrequency.WEEKLY, weekday, time)];
    for (const schedule of schedules) { const periodEnd = this.date(0); const periodStart = schedule.frequency === ReportFrequency.WEEKLY ? this.date(-6) : periodEnd; const recipients = schedule.recipients as unknown as string[]; let delivery; try { delivery = await this.schedules.beginDelivery(schedule.id, periodStart, periodEnd, recipients.length); await this.send(periodStart, periodEnd, `${schedule.name} ${periodStart} - ${periodEnd}`, recipients, schedule.scope === ReportScope.EMPLOYEE ? schedule.employeeId ?? undefined : undefined, schedule.scope === ReportScope.DIVISION ? schedule.divisionName ?? undefined : undefined); await this.schedules.completeDelivery(delivery.id); } catch (error) { if (delivery) await this.schedules.failDelivery(delivery.id, error); else this.logger.error('Jadwal laporan tidak dikirim', error); } }
  }
}
