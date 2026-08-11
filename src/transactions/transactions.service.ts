import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const headers = ['Index', 'Pin', 'Ename', 'Time', 'State', 'Verification', 'Work Code', 'Reserved', 'Device'];
const escapeCsv = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportCsv(from: string, to: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new BadRequestException('Tanggal harus berformat YYYY-MM-DD');
    const punches = await this.prisma.attendancePunch.findMany({
      where: { occurredAtLocal: { gte: `${from} 00:00:00`, lte: `${to} 23:59:59` } },
      include: { device: { include: { enrollments: { include: { employee: true } } } } },
      orderBy: [{ occurredAtLocal: 'asc' }, { id: 'asc' }],
    });
    const lines = punches.map((punch, index) => {
      const enrollment = punch.device.enrollments.find((item) => item.pin === punch.userId && item.active);
      return [index + 1, punch.userId, enrollment?.employee.displayName ?? 'Belum dipetakan', punch.occurredAtLocal, punch.status, punch.verify, punch.workCode, '', punch.device.serialNumber].map(escapeCsv).join(',');
    });
    return `\uFEFF${headers.join(',')}\n${lines.join('\n')}`;
  }
}
