import { ReportFrequency } from '@prisma/client';
import { EmailsService } from '../src/emails/emails.service';

describe('EmailsService report periods', () => {
  const service = new EmailsService({} as never, {} as never);
  it('uses the previous December when a monthly run occurs on January 1', () => {
    expect(service.reportPeriod(ReportFrequency.MONTHLY, new Date('2027-01-01T01:30:00.000Z'))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
