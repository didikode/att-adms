import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ReportFrequency, ReportScope } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportSchedulesService } from './report-schedules.service';

@Controller('api/report-schedules') @UseGuards(JwtAuthGuard)
export class ReportSchedulesController {
  constructor(private readonly schedules: ReportSchedulesService) {}
  @Get() list() { return this.schedules.list(); }
  @Post() create(@Body() body: { name?: string; frequency?: ReportFrequency; weekday?: number; time?: string; recipients?: string[]; scope?: ReportScope; employeeId?: string; divisionName?: string }, @Req() request: { user: { sub: string } }) { return this.schedules.create(body, request.user.sub); }
  @Patch(':id/active') active(@Param('id') id: string, @Body() body: { active?: boolean }) { return this.schedules.setActive(id, Boolean(body.active)); }
}
