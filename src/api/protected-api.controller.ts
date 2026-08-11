import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api')
export class ProtectedApiController {
  @Get('employees')
  @UseGuards(JwtAuthGuard)
  employees(): { data: [] } {
    return { data: [] };
  }
}
