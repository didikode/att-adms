import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from '../auth/auth.module';
import { ProtectedApiController } from './protected-api.controller';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, ProtectedApiController, AdminController],
})
export class ApiModule {}
