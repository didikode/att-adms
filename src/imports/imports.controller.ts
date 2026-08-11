import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  @Post('hr/preview')
  @UseInterceptors(FileInterceptor('file'))
  async previewHr(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File Excel wajib diunggah');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer.buffer as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('Sheet Excel tidak ditemukan');

    const headers = new Map<string, number>();
    worksheet.getRow(1).eachCell((cell, columnNumber) => {
      headers.set(cell.text.trim(), columnNumber);
    });
    const employeeCodeColumn = headers.get('EmployeeID');
    if (!employeeCodeColumn) throw new BadRequestException('Kolom EmployeeID wajib tersedia');

    const rows = [] as Array<{ rowNumber: number; status: 'valid' | 'invalid'; messages: string[]; normalized: { employeeCode: string; firstName: string; lastName: string; active: boolean } }>;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || row.values.length === 0) return;
      const value = (header: string) => {
        const column = headers.get(header);
        return column ? row.getCell(column).text.trim() : '';
      };
      const employeeCode = value('EmployeeID');
      if (!employeeCode && !value('FirstName') && !value('LastName')) return;
      const activeValue = value('Active').toLowerCase();
      rows.push({
        rowNumber,
        status: employeeCode ? 'valid' : 'invalid',
        messages: employeeCode ? [] : ['EmployeeID wajib diisi'],
        normalized: {
          employeeCode,
          firstName: value('FirstName'),
          lastName: value('LastName'),
          active: !['false', '0', 'no', 'tidak'].includes(activeValue),
        },
      });
    });
    return { summary: { total: rows.length, valid: rows.filter((row) => row.status === 'valid').length }, rows };
  }

  @Post('device-enrollments/preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File CSV wajib diunggah');
    const records = parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    const rows = records.map((record, index) => ({
      rowNumber: index + 2,
      status: record.Pin ? 'valid' : 'invalid',
      messages: record.Pin ? [] : ['Pin wajib diisi'],
      normalized: { pin: record.Pin ?? '', name: record['Emp Name'] ?? '', registrationDevice: record['Registration Device'] ?? '', fingerprintCount: Number(record['FP Count'] || 0) },
    }));
    return { summary: { total: rows.length, valid: rows.filter((row) => row.status === 'valid').length }, rows };
  }
}
