import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeCandidateStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeeCandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const punches = await this.prisma.attendancePunch.findMany({
      select: { deviceId: true, userId: true, device: { select: { serialNumber: true, enrollments: { select: { pin: true, active: true } }, employeeCandidates: true } } },
      orderBy: { receivedAt: 'desc' },
    });
    const result = new Map<string, Record<string, unknown>>();
    for (const punch of punches) {
      const key = `${punch.deviceId}:${punch.userId}`;
      if (result.has(key) || punch.device.enrollments.some((item) => item.pin === punch.userId && item.active)) continue;
      const candidate = punch.device.employeeCandidates.find((item) => item.pin === punch.userId);
      result.set(key, {
        id: candidate?.id ?? null, deviceId: punch.deviceId, serialNumber: punch.device.serialNumber, pin: punch.userId,
        name: candidate?.name ?? null, state: candidate?.status ?? 'DISCOVERED', requestedAt: candidate?.requestedAt ?? null,
        receivedAt: candidate?.receivedAt ?? null, savedAt: candidate?.savedAt ?? null,
      });
    }
    return [...result.values()].sort((a, b) => String(a.serialNumber).localeCompare(String(b.serialNumber)) || String(a.pin).localeCompare(String(b.pin)));
  }

  async request(deviceId: string, pin: string, _actorId: string) {
    const safePin = pin.trim();
    if (!safePin) throw new NotFoundException('PIN tidak ditemukan');
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({ where: { id: deviceId } });
      if (!device) throw new NotFoundException('Perangkat tidak ditemukan');
      const existing = await tx.employeeCandidate.findUnique({ where: { deviceId_pin: { deviceId, pin: safePin } } });
      if (existing?.status === EmployeeCandidateStatus.SAVED) return existing;
      const candidate = await tx.employeeCandidate.upsert({
        where: { deviceId_pin: { deviceId, pin: safePin } },
        create: { deviceId, pin: safePin, status: EmployeeCandidateStatus.REQUESTED, requestedAt: new Date() },
        update: { status: EmployeeCandidateStatus.REQUESTED, requestedAt: new Date() },
      });
      if (candidate.status !== EmployeeCandidateStatus.SAVED) {
        const command = `DATA QUERY USERINFO PIN=${safePin}`;
        const pending = await tx.deviceCommand.findFirst({ where: { deviceId, command, status: 'pending' } });
        if (!pending) await tx.deviceCommand.create({ data: { deviceId, command } });
      }
      return candidate;
    });
  }

  async acceptUserInfo(serialNumber: string, entries: Array<{ pin: string; name: string | null }>) {
    const device = await this.prisma.device.findUnique({ where: { serialNumber }, select: { id: true } });
    if (!device) return 0;
    let accepted = 0;
    for (const entry of entries) {
      const pin = entry.pin.trim();
      if (!pin) continue;
      await this.prisma.employeeCandidate.upsert({
        where: { deviceId_pin: { deviceId: device.id, pin } },
        create: { deviceId: device.id, pin, name: entry.name?.trim() || null, status: EmployeeCandidateStatus.READY, receivedAt: new Date() },
        update: { name: entry.name?.trim() || null, status: EmployeeCandidateStatus.READY, receivedAt: new Date() },
      });
      accepted += 1;
    }
    return accepted;
  }

  async save(candidateId: string, actorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const candidate = await tx.employeeCandidate.findUnique({ where: { id: candidateId } });
        if (!candidate) throw new NotFoundException('Kandidat tidak ditemukan');
        if (candidate.status !== EmployeeCandidateStatus.READY || !candidate.name?.trim()) throw new ConflictException('Kandidat belum siap disimpan');
        const [employee, enrollment] = await Promise.all([
          tx.employee.findUnique({ where: { employeeCode: candidate.pin } }),
          tx.deviceEnrollment.findFirst({ where: { pin: candidate.pin, active: true } }),
        ]);
        if (employee || enrollment) throw new ConflictException('PIN sudah digunakan oleh data karyawan atau perangkat lain');
        const created = await tx.employee.create({ data: { employeeCode: candidate.pin, firstName: candidate.name.trim(), displayName: candidate.name.trim() } });
        await tx.deviceEnrollment.create({ data: { employeeId: created.id, deviceId: candidate.deviceId, pin: candidate.pin } });
        await tx.employeeCandidate.update({ where: { id: candidate.id }, data: { status: EmployeeCandidateStatus.SAVED, savedAt: new Date() } });
        await tx.auditEvent.create({ data: { actorId, action: 'EMPLOYEE_SAVED_FROM_DEVICE', targetType: 'EMPLOYEE', targetId: created.id, summary: { employeeCode: candidate.pin, deviceId: candidate.deviceId } } });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('PIN sudah digunakan oleh data karyawan atau perangkat lain');
      throw error;
    }
  }
}
