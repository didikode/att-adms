import { Module } from '@nestjs/common';
import { IclockModule } from './iclock/iclock.module';

@Module({
  imports: [IclockModule],
})
export class AppModule {}
