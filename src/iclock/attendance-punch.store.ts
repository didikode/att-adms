import { Inject, Injectable } from '@nestjs/common';
import { ATTENDANCE_PUNCH_REPOSITORY } from './attendance-punch.repository';
import type { AttendancePunchRepository } from './attendance-punch.repository';

@Injectable()
export class AttendancePunchStore {
  constructor(
    @Inject(ATTENDANCE_PUNCH_REPOSITORY)
    private readonly repository: AttendancePunchRepository,
  ) {}

  async accept(serialNumber: string, line: string): Promise<boolean> {
    const [userId, occurredAtLocal, status, verify, workCode] =
      line.split('\t');

    if (!userId || !occurredAtLocal) {
      return false;
    }

    return this.repository.save({
      deviceSerialNumber: serialNumber,
      userId,
      occurredAtLocal,
      status: this.parseInteger(status),
      verify: this.parseInteger(verify),
      workCode: this.parseInteger(workCode),
      rawData: line,
    });
  }

  private parseInteger(value: string | undefined): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
