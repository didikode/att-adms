import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DevicesService } from './devices.service';
@Controller('api/devices') @UseGuards(JwtAuthGuard)
export class DevicesController { constructor(private readonly devices: DevicesService) {} @Get() list() { return this.devices.list(); } }
