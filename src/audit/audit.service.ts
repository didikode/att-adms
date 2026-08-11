import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(actorId: string, action: string, targetId: string, summary: Record<string, string>) {
    return this.prisma.auditEvent.create({
      data: { actorId, action, targetType: 'EMPLOYEE', targetId, summary },
    });
  }

  listEmployee(targetId: string) {
    return this.prisma.auditEvent.findMany({
      where: { targetType: 'EMPLOYEE', targetId },
      select: { action: true, summary: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
