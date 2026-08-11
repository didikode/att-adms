import { Module } from '@nestjs/common';
import { IclockModule } from './iclock/iclock.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [PrismaModule, IclockModule, ApiModule],
})
export class AppModule {}
