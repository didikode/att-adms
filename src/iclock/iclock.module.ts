import { Module } from '@nestjs/common';
import { IclockController } from './iclock.controller';
import { AttendancePunchStore } from './attendance-punch.store';

@Module({
  controllers: [IclockController],
  providers: [AttendancePunchStore],
})
export class IclockModule {}
