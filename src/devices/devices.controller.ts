import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DevicesService } from './devices.service';
@Controller('api/devices') @UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list() { return this.devices.list(); }

  @Post()
  register(@Body() body: { serialNumber?: string }) {
    if (!body.serialNumber?.trim()) throw new BadRequestException('Serial number wajib diisi');
    return this.devices.register(body.serialNumber);
  }
}
