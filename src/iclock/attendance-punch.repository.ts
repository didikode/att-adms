export const ATTENDANCE_PUNCH_REPOSITORY = Symbol(
  'ATTENDANCE_PUNCH_REPOSITORY',
);

export type AttendancePunchInput = {
  deviceSerialNumber: string;
  userId: string;
  occurredAtLocal: string;
  status: number | null;
  verify: number | null;
  workCode: number | null;
  rawData: string;
};

export interface AttendancePunchRepository {
  save(input: AttendancePunchInput): Promise<boolean>;
}
