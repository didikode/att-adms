import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}
  async list() {
    const devices = await this.prisma.device.findMany({ include: { _count: { select: { punches: true, enrollments: true } } }, orderBy: { serialNumber: 'asc' } });
    const threshold = Date.now() - 5 * 60 * 1000;
    return devices.map((device) => ({
      serialNumber: device.serialNumber, aliasName: device.aliasName, ipAddress: device.ipAddress,
      status: device.lastActivityAt && device.lastActivityAt.getTime() >= threshold ? 'ONLINE' : 'OFFLINE',
      lastActivityAt: device.lastActivityAt, transferTime: '00:00;14:05', interval: 1,
      firmwareVersion: null, deviceName: null, userCount: device._count.enrollments,
      fingerprintCount: null, transactionCount: device._count.punches, department: null,
    }));
  }
  async recordActivity(serialNumber: string) {
    await this.prisma.device.upsert({ where: { serialNumber }, create: { serialNumber, lastActivityAt: new Date() }, update: { lastActivityAt: new Date() } });
  }
}
