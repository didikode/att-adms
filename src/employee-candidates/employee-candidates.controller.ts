import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmployeeCandidatesService } from './employee-candidates.service';

@Controller('api/employee-candidates')
@UseGuards(JwtAuthGuard)
export class EmployeeCandidatesController {
  constructor(private readonly candidates: EmployeeCandidatesService) {}

  @Get()
  async list() { return { data: await this.candidates.list() }; }

  @Post(':deviceId/:pin/request')
  request(@Param('deviceId') deviceId: string, @Param('pin') pin: string, @Req() request: { user: { sub: string } }) {
    return this.candidates.request(deviceId, pin, request.user.sub);
  }

  @Post(':id/save')
  save(@Param('id') id: string, @Req() request: { user: { sub: string } }) {
    return this.candidates.save(id, request.user.sub);
  }
}
