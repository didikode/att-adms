import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Tanggal harus berformat YYYY-MM-DD');
    const punches = await this.prisma.attendancePunch.findMany({
      where: { occurredAtLocal: { gte: `${date} 00:00:00`, lte: `${date} 23:59:59` } },
      include: { device: { include: { enrollments: { include: { employee: true } } } } },
      orderBy: { occurredAtLocal: 'desc' },
    });
    const mappedEmployeeIds = new Set<string>();
    let unmappedPunches = 0;
    const transactions = punches.map((punch) => {
      const enrollment = punch.device.enrollments.find((item) => item.pin === punch.userId && item.active);
      if (enrollment) mappedEmployeeIds.add(enrollment.employeeId); else unmappedPunches += 1;
      return { id: punch.id, pin: punch.userId, occurredAtLocal: punch.occurredAtLocal, deviceSerialNumber: punch.device.serialNumber, employeeName: enrollment?.employee.displayName ?? 'Belum dipetakan' };
    });
    return {
      date,
      activeEmployees: await this.prisma.employee.count({ where: { active: true } }),
      punchedEmployees: mappedEmployeeIds.size,
      unmappedPunches,
      activeDevices: new Set(punches.map((punch) => punch.deviceId)).size,
      recentTransactions: transactions.slice(0, 10),
    };
  }
}
