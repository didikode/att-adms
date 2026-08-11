import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmployeesService } from './employees.service';

@Controller('api/employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@Body() body: { employeeCode?: string; firstName?: string; lastName?: string; email?: string; divisionName?: string }, @Req() request: { user: { sub: string } }) {
    if (!body.employeeCode?.trim() || !body.firstName?.trim()) {
      throw new BadRequestException('EmployeeID dan nama depan wajib diisi');
    }
    return this.employeesService.create(body as { employeeCode: string; firstName: string; lastName?: string; email?: string; divisionName?: string }, request.user.sub);
  }

  @Get()
  async list(@Query('q') query?: string) {
    return { data: await this.employeesService.list(query) };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { firstName?: string }, @Req() request: { user: { sub: string } }) {
    return this.employeesService.update(id, body, request.user.sub);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(@Param('id') id: string, @Req() request: { user: { sub: string } }) {
    return this.employeesService.deactivate(id, request.user.sub);
  }

  @Post(':id/enrollments')
  enrollment(@Param('id') id: string, @Body() body: { deviceSerialNumber?: string; pin?: string }, @Req() request: { user: { sub: string } }) {
    if (!body.deviceSerialNumber?.trim() || !body.pin) throw new BadRequestException('Serial perangkat dan PIN wajib diisi');
    return this.employeesService.addEnrollment(id, body as { deviceSerialNumber: string; pin: string }, request.user.sub);
  }

  @Get(':id/audit')
  async audit(@Param('id') id: string) {
    return { data: await this.employeesService.auditList(id) };
  }
}
