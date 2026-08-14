import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeeCandidatesController } from './employee-candidates.controller';
import { EmployeeCandidatesService } from './employee-candidates.service';

@Module({
  imports: [AuthModule],
  controllers: [EmployeeCandidatesController],
  providers: [EmployeeCandidatesService],
  exports: [EmployeeCandidatesService],
})
export class EmployeeCandidatesModule {}
