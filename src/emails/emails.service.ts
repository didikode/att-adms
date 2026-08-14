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
  private dateParts(now: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return { year: Number(value('year')), month: Number(value('month')), day: Number(value('day')) };
  }
  private formatDate(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
  reportPeriod(frequency: ReportFrequency, now = new Date()) {
    const current = this.dateParts(now);
    const today = this.formatDate(current.year, current.month, current.day);
    if (frequency === ReportFrequency.MONTHLY) {
      const previousEnd = new Date(Date.UTC(current.year, current.month - 1, 0));
      const from = this.formatDate(previousEnd.getUTCFullYear(), previousEnd.getUTCMonth() + 1, 1);
      const to = this.formatDate(previousEnd.getUTCFullYear(), previousEnd.getUTCMonth() + 1, previousEnd.getUTCDate());
      return { from, to };
    }
    if (frequency === ReportFrequency.WEEKLY) {
      const start = this.dateParts(new Date(now.getTime() - 6 * 86400000));
      return { from: this.formatDate(start.year, start.month, start.day), to: today };
    }
    return { from: today, to: today };
  }
  async sendTest(scheduleId: string) {
    const schedule = await this.schedules.find(scheduleId); const period = this.reportPeriod(schedule.frequency); const recipients = schedule.recipients as unknown as string[];
    const periodStart = period.from; const periodEnd = period.to;
    const delivery = await this.schedules.beginDelivery(schedule.id, periodStart, periodEnd, recipients.length, 'TEST');
    try { await this.send(periodStart, periodEnd, `[UJI] ${schedule.name} ${periodStart} - ${periodEnd}`, recipients, schedule.scope === ReportScope.EMPLOYEE ? schedule.employeeId ?? undefined : undefined, schedule.scope === ReportScope.DIVISION ? schedule.divisionName ?? undefined : undefined); await this.schedules.completeDelivery(delivery.id); return delivery; } catch (error) { await this.schedules.failDelivery(delivery.id, error); throw error; }
  }
  async runDue() {
    const now = new Date(); const pieces = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const part = (type: string) => pieces.find((item) => item.type === type)?.value ?? ''; const time = `${part('hour')}:${part('minute')}`; const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
    const schedules = [...await this.schedules.due(ReportFrequency.DAILY, null, time), ...await this.schedules.due(ReportFrequency.WEEKLY, weekday, time), ...(part('day') === '01' ? await this.schedules.due(ReportFrequency.MONTHLY, null, time) : [])];
    for (const schedule of schedules) { const period = this.reportPeriod(schedule.frequency, now); const periodStart = period.from; const periodEnd = period.to; const recipients = schedule.recipients as unknown as string[]; let delivery; try { delivery = await this.schedules.beginDelivery(schedule.id, periodStart, periodEnd, recipients.length); await this.send(periodStart, periodEnd, `${schedule.name} ${periodStart} - ${periodEnd}`, recipients, schedule.scope === ReportScope.EMPLOYEE ? schedule.employeeId ?? undefined : undefined, schedule.scope === ReportScope.DIVISION ? schedule.divisionName ?? undefined : undefined); await this.schedules.completeDelivery(delivery.id); } catch (error) { if (delivery) await this.schedules.failDelivery(delivery.id, error); else this.logger.error('Jadwal laporan tidak dikirim', error); } }
  }
}
