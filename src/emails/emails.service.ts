import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class EmailsService implements OnModuleInit {
  private readonly logger = new Logger(EmailsService.name);
  constructor(private readonly reports: ReportsService) {}
  onModuleInit() {
    if (process.env.REPORT_SCHEDULE_ENABLED !== 'true') return;
    cron.schedule('30 8 * * *', () => void this.sendDaily(), { timezone: 'Asia/Jakarta' });
    cron.schedule('30 8 * * 5', () => void this.sendWeekly(), { timezone: 'Asia/Jakarta' });
    this.logger.log('Jadwal laporan email aktif: harian 08:30 dan Jumat 08:30 WIB');
  }
  private transport() {
    const host = process.env.SMTP_HOST; const port = Number(process.env.SMTP_PORT ?? 587); const user = process.env.SMTP_USERNAME; const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) throw new Error('File SMTP tidak lengkap');
    return nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth: { user, pass } });
  }
  private recipients() { return (process.env.REPORT_RECIPIENTS ?? '').split(',').map((value) => value.trim()).filter(Boolean); }
  private async send(from: string, to: string, subject: string) {
    const recipients = this.recipients(); if (!recipients.length) throw new Error('REPORT_RECIPIENTS belum diatur');
    const pdf = await this.reports.attendancePdf(from, to);
    await this.transport().sendMail({ from: process.env.MAIL_FROM, to: recipients, subject, text: `Terlampir laporan absensi WIB periode ${from} sampai ${to}.`, attachments: [{ filename: `laporan-absensi-${from}-${to}.pdf`, content: pdf, contentType: 'application/pdf' }] });
  }
  private date(offset: number) { const date = new Date(Date.now() + offset * 86400000); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date); }
  async sendDaily() { const today = this.date(0); await this.send(today, today, `Laporan Absensi Harian ${today}`); }
  async sendWeekly() { const friday = this.date(0); const saturday = this.date(-6); await this.send(saturday, friday, `Laporan Absensi Mingguan ${saturday} - ${friday}`); }
}
