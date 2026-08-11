import { Module } from '@nestjs/common';
import { IclockModule } from './iclock/iclock.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiModule } from './api/api.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, IclockModule, AuthModule, ApiModule],
})
export class AppModule {}
