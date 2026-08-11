import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@Controller('api/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@Query('from') from: string, @Query('to') to: string) { return this.transactions.exportCsv(from, to); }
}
