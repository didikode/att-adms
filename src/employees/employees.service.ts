import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

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
