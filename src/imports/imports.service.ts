import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type HrPreviewRow = {
  rowNumber: number;
  status: 'valid' | 'invalid';
  messages: string[];
  manualMapping: boolean;
  normalized: { employeeCode: string; firstName: string; lastName: string; active: boolean };
};

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async storeHrPreview(actorId: string, fileName: string, file: Buffer, rows: HrPreviewRow[]) {
    const summary = {
      total: rows.length,
      valid: rows.filter((row) => row.status === 'valid').length,
      manualMapping: rows.filter((row) => row.manualMapping).length,
    };
    const run = await this.prisma.importRun.create({
      data: {
        sourceType: 'HR_WORKBOOK',
        fileName,
        checksum: createHash('sha256').update(file).digest('hex'),
        actorId,
        summary,
        rowResults: rows as unknown as Prisma.InputJsonValue,
      },
    });
    return { importId: run.id, summary, rows };
  }

  async commitHrPreview(importId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.importRun.findFirst({ where: { id: importId, actorId } });
      if (!run) throw new NotFoundException('Draft impor tidak ditemukan');
      if (run.status !== ImportStatus.PREVIEWED) throw new BadRequestException('Draft impor sudah diproses');
      if (run.sourceType !== 'HR_WORKBOOK') throw new BadRequestException('Jenis draft impor tidak didukung');

      const rows = run.rowResults as unknown as HrPreviewRow[];
      const invalid = rows.filter((row) => row.status !== 'valid');
      if (invalid.length) throw new BadRequestException('Perbaiki baris impor yang tidak valid sebelum komit');

      for (const row of rows) {
        const { employeeCode, firstName, lastName, active } = row.normalized;
        await tx.employee.upsert({
          where: { employeeCode },
          create: { employeeCode, firstName, lastName: lastName || null, active, displayName: [firstName, lastName].filter(Boolean).join(' ') },
          update: { firstName, lastName: lastName || null, active, displayName: [firstName, lastName].filter(Boolean).join(' ') },
        });
      }
      return tx.importRun.update({ where: { id: run.id }, data: { status: ImportStatus.COMMITTED, committedAt: new Date() } });
    });
  }
}
