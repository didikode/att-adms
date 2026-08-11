export const DEVICE_COMMAND_REPOSITORY = Symbol('DEVICE_COMMAND_REPOSITORY');

export interface DeviceCommandRepository {
  claimNext(deviceSerialNumber: string): Promise<string | null>;
}
