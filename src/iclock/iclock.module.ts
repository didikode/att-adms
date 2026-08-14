import { Module } from '@nestjs/common';
import { IclockController } from './iclock.controller';
import { AttendancePunchStore } from './attendance-punch.store';
import { ATTENDANCE_PUNCH_REPOSITORY } from './attendance-punch.repository';
import { PrismaAttendancePunchRepository } from './prisma-attendance-punch.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { DeviceAccessPolicy } from './device-access.policy';
import { DEVICE_COMMAND_REPOSITORY } from './device-command.repository';
import { PrismaDeviceCommandRepository } from './prisma-device-command.repository';
import { DevicesModule } from '../devices/devices.module';
import { EmployeeCandidatesModule } from '../employee-candidates/employee-candidates.module';

@Module({
  imports: [PrismaModule, DevicesModule, EmployeeCandidatesModule],
  controllers: [IclockController],
  providers: [
    AttendancePunchStore,
    DeviceAccessPolicy,
    PrismaDeviceCommandRepository,
    PrismaAttendancePunchRepository,
    {
      provide: ATTENDANCE_PUNCH_REPOSITORY,
      useExisting: PrismaAttendancePunchRepository,
    },
    {
      provide: DEVICE_COMMAND_REPOSITORY,
      useExisting: PrismaDeviceCommandRepository,
    },
  ],
})
export class IclockModule {}
