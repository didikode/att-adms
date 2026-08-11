import { Module } from '@nestjs/common';
import { IclockController } from './iclock.controller';
import { AttendancePunchStore } from './attendance-punch.store';
import { ATTENDANCE_PUNCH_REPOSITORY } from './attendance-punch.repository';
import { PrismaAttendancePunchRepository } from './prisma-attendance-punch.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IclockController],
  providers: [
    AttendancePunchStore,
    PrismaAttendancePunchRepository,
    {
      provide: ATTENDANCE_PUNCH_REPOSITORY,
      useExisting: PrismaAttendancePunchRepository,
    },
  ],
})
export class IclockModule {}
