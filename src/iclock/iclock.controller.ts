import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AttendancePunchStore } from './attendance-punch.store';

@Controller('iclock')
export class IclockController {
  constructor(private readonly attendancePunchStore: AttendancePunchStore) {}

  @Get('cdata')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  handshake(
    @Query('SN') serialNumber: string,
    @Res({ passthrough: true }) response: Response,
  ): string {
    if (!serialNumber) {
      response.status(400);
      return 'Invalid parameter';
    }

    return [
      `GET OPTION FROM: ${serialNumber}`,
      'Stamp=0',
      'OpStamp=0',
      'ErrorDelay=60',
      'Delay=60',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=1111000000',
      'TimeZone=7',
      'Realtime=1',
      'Encrypt=0',
    ].join('\n');
  }

  @Post('cdata')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async uploadAttendance(
    @Query('SN') serialNumber: string,
    @Query('table') table: string,
    @Body() body: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    if (!serialNumber) {
      response.status(400);
      response.setHeader('X-Records-Accepted', '0');
      return 'Invalid parameter';
    }

    if (table?.toUpperCase() !== 'ATTLOG') {
      response.setHeader('X-Records-Accepted', '0');
      return 'OK: 0';
    }

    const lines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    let accepted = 0;
    for (const line of lines) {
      if (await this.attendancePunchStore.accept(serialNumber, line)) {
        accepted += 1;
      }
    }

    response.setHeader('X-Records-Accepted', String(accepted));
    return `OK: ${lines.length}`;
  }

  @Get('getrequest')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  pollCommand(
    @Query('SN') serialNumber: string,
    @Res({ passthrough: true }) response: Response,
  ): string {
    if (!serialNumber) {
      response.status(400);
      return 'Invalid parameter';
    }

    return 'OK';
  }
}
