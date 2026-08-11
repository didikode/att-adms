import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';
@Controller('api/reports') @UseGuards(JwtAuthGuard)
export class ReportsController { constructor(private readonly reports: ReportsService) {} @Get('attendance.pdf') async attendance(@Query('from') from: string, @Query('to') to: string, @Res() response: Response) { const pdf = await this.reports.attendancePdf(from, to); response.setHeader('Content-Type', 'application/pdf'); response.setHeader('Content-Disposition', `attachment; filename="laporan-absensi-${from}-${to}.pdf"`); response.send(pdf); } }
