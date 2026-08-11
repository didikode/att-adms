import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}
  async attendancePdf(from: string, to: string, employeeId?: string, divisionName?: string): Promise<Buffer> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new BadRequestException('Tanggal harus berformat YYYY-MM-DD');
    const allPunches = await this.prisma.attendancePunch.findMany({ where: { occurredAtLocal: { gte: `${from} 00:00:00`, lte: `${to} 23:59:59` } }, include: { device: { include: { enrollments: { include: { employee: true } } } } }, orderBy: { occurredAtLocal: 'asc' } });
    const punches = allPunches.filter((punch) => { const enrollment = punch.device.enrollments.find((item) => item.pin === punch.userId && item.active); return (!employeeId || enrollment?.employeeId === employeeId) && (!divisionName || enrollment?.employee.divisionName === divisionName); });
    return new Promise((resolve) => {
      const pdf = new PDFDocument({ margin: 42, size: 'A4' }); const chunks: Buffer[] = [];
      pdf.on('data', (chunk: Buffer) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.fontSize(18).fillColor('#102b55').text('Laporan Absensi', { align: 'center' }); pdf.moveDown(.3); pdf.fontSize(10).fillColor('#4b5d73').text(`Periode WIB: ${from} s.d. ${to}${divisionName ? ` | Divisi: ${divisionName}` : ''}`, { align: 'center' }); pdf.moveDown(1);
      pdf.fillColor('#102b55').fontSize(9).text('No', 42, pdf.y, { width: 28 }).text('Waktu', 70, pdf.y, { width: 115 }).text('PIN', 185, pdf.y, { width: 60 }).text('Karyawan', 245, pdf.y, { width: 175 }).text('Perangkat', 420, pdf.y, { width: 130 }); pdf.moveTo(42, pdf.y + 5).lineTo(553, pdf.y + 5).stroke('#bcc8d6'); pdf.moveDown(.8);
      punches.forEach((punch, index) => { if (pdf.y > 760) { pdf.addPage(); } const enrollment = punch.device.enrollments.find((item) => item.pin === punch.userId && item.active); const y = pdf.y; pdf.fillColor('#20334d').fontSize(8).text(String(index + 1), 42, y, { width: 28 }).text(punch.occurredAtLocal, 70, y, { width: 115 }).text(punch.userId, 185, y, { width: 60 }).text(enrollment?.employee.displayName ?? 'Belum dipetakan', 245, y, { width: 175 }).text(punch.device.serialNumber, 420, y, { width: 130 }); pdf.moveDown(.7); });
      if (!punches.length) pdf.fillColor('#68778d').fontSize(10).text('Tidak ada transaksi absensi pada periode ini.');
      pdf.fontSize(8).fillColor('#68778d').text(`Dibuat ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`, 42, 790, { align: 'center', width: 511 }); pdf.end();
    });
  }
}
