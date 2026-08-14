import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmployeesService } from './employees.service';

@Controller('api/employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async list(@Query('q') query?: string) {
    return { data: await this.employeesService.list(query) };
  }

  @Get(':id/audit')
  async audit(@Param('id') id: string) {
    return { data: await this.employeesService.auditList(id) };
  }
}
