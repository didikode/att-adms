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
import { DeviceAccessPolicy } from './device-access.policy';
import { Inject } from '@nestjs/common';
import { DEVICE_COMMAND_REPOSITORY } from './device-command.repository';
import type { DeviceCommandRepository } from './device-command.repository';
import { DevicesService } from '../devices/devices.service';
import { EmployeeCandidatesService } from '../employee-candidates/employee-candidates.service';

@Controller('iclock')
export class IclockController {
  constructor(
    private readonly attendancePunchStore: AttendancePunchStore,
    private readonly deviceAccessPolicy: DeviceAccessPolicy,
    @Inject(DEVICE_COMMAND_REPOSITORY)
    private readonly deviceCommandRepository: DeviceCommandRepository,
    private readonly devices: DevicesService,
    private readonly candidates: EmployeeCandidatesService,
  ) {}

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

    if (!this.deviceAccessPolicy.allows(serialNumber)) {
      response.status(403);
      return 'Device is not registered';
    }

    void this.devices.recordActivity(serialNumber);
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

    if (!this.deviceAccessPolicy.allows(serialNumber)) {
      response.status(403);
      response.setHeader('X-Records-Accepted', '0');
      return 'Device is not registered';
    }

    await this.devices.recordActivity(serialNumber);

    if (table?.toUpperCase() === 'OPERLOG') {
      const entries = body.split(/\r?\n/).map((line) => this.parseUserInfo(line)).filter((entry): entry is { pin: string; name: string | null } => entry !== null);
      const accepted = await this.candidates.acceptUserInfo(serialNumber, entries);
      response.setHeader('X-Records-Accepted', String(accepted));
      return `OK: ${accepted}`;
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

  private parseUserInfo(line: string): { pin: string; name: string | null } | null {
    const fields = line.trim().split('\t');
    if (!fields[0]?.startsWith('USER PIN=')) return null;
    const pin = fields[0].slice('USER PIN='.length).trim();
    const nameField = fields.find((field) => field.startsWith('Name='));
    return pin ? { pin, name: nameField?.slice('Name='.length).trim() || null } : null;
  }

  @Get('getrequest')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async pollCommand(
    @Query('SN') serialNumber: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    if (!serialNumber) {
      response.status(400);
      return 'Invalid parameter';
    }

    if (!this.deviceAccessPolicy.allows(serialNumber)) {
      response.status(403);
      return 'Device is not registered';
    }

    await this.devices.recordActivity(serialNumber);

    return (await this.deviceCommandRepository.claimNext(serialNumber)) ?? 'OK';
  }

  @Post('devicecmd')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  acknowledgeCommand(
    @Query('SN') serialNumber: string,
    @Res({ passthrough: true }) response: Response,
  ): string {
    if (!serialNumber) {
      response.status(400);
      return 'Invalid parameter';
    }

    if (!this.deviceAccessPolicy.allows(serialNumber)) {
      response.status(403);
      return 'Device is not registered';
    }

    void this.devices.recordActivity(serialNumber);

    return 'OK';
  }
}
