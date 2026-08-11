import { Module } from '@nestjs/common';
import { IclockModule } from './iclock/iclock.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, IclockModule],
})
export class AppModule {}
