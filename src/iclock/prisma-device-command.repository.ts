import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DeviceCommandRepository } from './device-command.repository';

@Injectable()
export class PrismaDeviceCommandRepository implements DeviceCommandRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimNext(deviceSerialNumber: string): Promise<string | null> {
    return this.prisma.$transaction(async (transaction) => {
      const device = await transaction.device.findUnique({
        where: { serialNumber: deviceSerialNumber },
        select: { id: true },
      });

      if (!device) {
        return null;
      }

      const nextCommand = await transaction.deviceCommand.findFirst({
        where: { deviceId: device.id, status: 'pending' },
        orderBy: { id: 'asc' },
      });

      if (!nextCommand) {
        return null;
      }

      await transaction.deviceCommand.update({
        where: { id: nextCommand.id },
        data: { status: 'delivered', deliveredAt: new Date() },
      });

      return `C:${nextCommand.id}:${nextCommand.command}`;
    });
  }
}
