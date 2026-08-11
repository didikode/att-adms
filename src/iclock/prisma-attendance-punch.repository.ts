import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttendancePunchInput,
  AttendancePunchRepository,
} from './attendance-punch.repository';

@Injectable()
export class PrismaAttendancePunchRepository implements AttendancePunchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(input: AttendancePunchInput): Promise<boolean> {
    const device = await this.prisma.device.upsert({
      where: { serialNumber: input.deviceSerialNumber },
      create: { serialNumber: input.deviceSerialNumber },
      update: {},
      select: { id: true },
    });

    const result = await this.prisma.attendancePunch.createMany({
      data: {
        deviceId: device.id,
        userId: input.userId,
        occurredAtLocal: input.occurredAtLocal,
        status: input.status,
        verify: input.verify,
        workCode: input.workCode,
        rawData: input.rawData,
      },
      skipDuplicates: true,
    });

    return result.count === 1;
  }
}
