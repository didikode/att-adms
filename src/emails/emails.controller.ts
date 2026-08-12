import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailsService } from './emails.service';

@Controller('api/report-schedules') @UseGuards(JwtAuthGuard)
export class EmailsController {
  constructor(private readonly emails: EmailsService) {}
  @Post(':id/test-send') testSend(@Param('id') id: string, @Body() body: { confirm?: boolean }) {
    if (body.confirm !== true) return { sent: false, message: 'Konfirmasi wajib diisi' };
    return this.emails.sendTest(id);
  }
}
