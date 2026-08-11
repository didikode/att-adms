import { Injectable } from '@nestjs/common';

@Injectable()
export class DeviceAccessPolicy {
  allows(serialNumber: string): boolean {
    return this.allowedSerialNumbers().has(serialNumber);
  }

  private allowedSerialNumbers(): Set<string> {
    return new Set(
      (process.env.ALLOWED_DEVICE_SERIALS ?? '')
        .split(',')
        .map((serialNumber) => serialNumber.trim())
        .filter(Boolean),
    );
  }
}
