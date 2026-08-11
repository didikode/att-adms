import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from '../auth/auth.module';
import { ProtectedApiController } from './protected-api.controller';

@Module({
  imports: [AuthModule],
  controllers: [HealthController, ProtectedApiController],
})
export class ApiModule {}
