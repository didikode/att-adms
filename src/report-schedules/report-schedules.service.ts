import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportFrequency, ReportScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateSchedule = { name?: string; frequency?: ReportFrequency; weekday?: number; time?: string; recipients?: string[]; scope?: ReportScope; employeeId?: string; divisionName?: string };

@Injectable()
export class ReportSchedulesService {
  constructor(private readonly prisma: PrismaService) {}
  list() { return this.prisma.reportSchedule.findMany({ include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' } }); }
  due(frequency: ReportFrequency, weekday: number | null, time: string) { return this.prisma.reportSchedule.findMany({ where: { active: true, frequency, time, ...(weekday === null ? {} : { weekday }) } }); }
  async create(input: CreateSchedule, createdById: string) {
    if (!input.name?.trim() || !input.frequency || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time ?? '') || !input.recipients?.length) throw new BadRequestException('Nama, frekuensi, waktu, dan penerima wajib diisi');
    if (input.frequency === ReportFrequency.WEEKLY && (input.weekday === undefined || input.weekday < 0 || input.weekday > 6)) throw new BadRequestException('Hari mingguan wajib diisi');
    if (input.scope === ReportScope.EMPLOYEE && !input.employeeId) throw new BadRequestException('Karyawan wajib dipilih');
    if (input.scope === ReportScope.DIVISION && !input.divisionName?.trim()) throw new BadRequestException('Divisi wajib diisi');
    const recipients = input.recipients.map((email) => email.trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (!recipients.length || recipients.length !== input.recipients.length) throw new BadRequestException('Setiap penerima harus berupa email valid');
    return this.prisma.reportSchedule.create({ data: { name: input.name.trim(), frequency: input.frequency, weekday: input.frequency === ReportFrequency.WEEKLY ? input.weekday : null, time: input.time!, recipients, scope: input.scope ?? ReportScope.ALL, employeeId: input.employeeId || null, divisionName: input.divisionName?.trim() || null, createdById } });
  }
  setActive(id: string, active: boolean) { return this.prisma.reportSchedule.update({ where: { id }, data: { active } }); }
  beginDelivery(scheduleId: string, periodStart: string, periodEnd: string, recipientCount: number) { return this.prisma.reportDelivery.create({ data: { scheduleId, periodStart, periodEnd, recipientCount, status: 'SENDING' } }); }
  completeDelivery(id: string) { return this.prisma.reportDelivery.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } }); }
  failDelivery(id: string, error: unknown) { return this.prisma.reportDelivery.update({ where: { id }, data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : 'Pengiriman gagal' } }); }
}
