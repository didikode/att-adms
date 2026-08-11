import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type CreateEmployeeInput = {
  employeeCode: string;
  firstName: string;
  lastName?: string;
  email?: string;
  divisionName?: string;
};

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async create(input: CreateEmployeeInput, actorId: string) {
    const employeeCode = input.employeeCode.trim();
    const firstName = input.firstName.trim();
    const lastName = input.lastName?.trim() || null;
    try {
      const employee = await this.prisma.employee.create({
        data: {
          employeeCode,
          firstName,
          lastName,
          email: input.email?.trim() || null,
          divisionName: input.divisionName?.trim() || null,
          displayName: [firstName, lastName].filter(Boolean).join(' '),
        },
      });
      await this.audit.record(actorId, 'EMPLOYEE_CREATED', employee.id, { employeeCode });
      return employee;
    } catch (error: unknown) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('EmployeeID sudah digunakan');
      }
      throw error;
    }
  }

  async update(id: string, input: { firstName?: string }, actorId: string) {
    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { id } });
    const firstName = input.firstName?.trim() || employee.firstName;
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { firstName, displayName: [firstName, employee.lastName].filter(Boolean).join(' ') },
    });
    await this.audit.record(actorId, 'EMPLOYEE_UPDATED', id, { firstName });
    return updated;
  }

  async deactivate(id: string, actorId: string) {
    const employee = await this.prisma.employee.update({ where: { id }, data: { active: false, deactivatedAt: new Date() } });
    await this.audit.record(actorId, 'EMPLOYEE_DEACTIVATED', id, {});
    return employee;
  }

  async addEnrollment(id: string, input: { deviceSerialNumber: string; pin: string }, actorId: string) {
    const device = await this.prisma.device.findUniqueOrThrow({ where: { serialNumber: input.deviceSerialNumber.trim() } });
    const enrollment = await this.prisma.deviceEnrollment.create({
      data: { employeeId: id, deviceId: device.id, pin: input.pin },
    });
    await this.audit.record(actorId, 'DEVICE_ENROLLMENT_CREATED', id, { pin: input.pin, deviceSerialNumber: device.serialNumber });
    return enrollment;
  }

  auditList(id: string) {
    return this.audit.listEmployee(id);
  }

  async list(query: string | undefined) {
    const value = query?.trim();
    return this.prisma.employee.findMany({
      where: value
        ? { OR: [{ employeeCode: { contains: value, mode: 'insensitive' } }, { displayName: { contains: value, mode: 'insensitive' } }] }
        : undefined,
      orderBy: { displayName: 'asc' },
    });
  }
}
