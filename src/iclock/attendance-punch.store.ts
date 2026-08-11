import { Injectable } from '@nestjs/common';

@Injectable()
export class AttendancePunchStore {
  private readonly identities = new Set<string>();

  accept(serialNumber: string, line: string): boolean {
    const [userId, timestamp] = line.split('\t');
    const identity = `${serialNumber}\u0000${userId}\u0000${timestamp}`;

    if (this.identities.has(identity)) {
      return false;
    }

    this.identities.add(identity);
    return true;
  }
}
