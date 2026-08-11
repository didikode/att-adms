import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Attendance transaction export (e2e)', () => {
  const database = new PrismaClient();
  const email = 'transactions-hr@example.test';
  const serialNumber = 'TEST-TRANSACTION-DEVICE';
  let app: INestApplication<App>;
  let authorization: string;

  beforeAll(async () => {
    await database.attendancePunch.deleteMany({ where: { device: { serialNumber } } });
    await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber } } });
    await database.device.deleteMany({ where: { serialNumber } });
    await database.employee.deleteMany({ where: { employeeCode: 'E.TRANSACTION001' } });
    await database.user.deleteMany({ where: { email } });
    const device = await database.device.create({ data: { serialNumber } });
    const employee = await database.employee.create({ data: { employeeCode: 'E.TRANSACTION001', firstName: 'Test', lastName: 'Export', displayName: 'Test Export' } });
    await database.deviceEnrollment.create({ data: { deviceId: device.id, employeeId: employee.id, pin: '000000715' } });
    await database.attendancePunch.create({ data: { deviceId: device.id, userId: '000000715', occurredAtLocal: '2026-07-01 08:00:00', status: 0, verify: 1, workCode: 0, rawData: 'test' } });
    await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } });
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication(); configureApp(app); await app.init();
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' });
    authorization = `Bearer ${login.body.accessToken}`;
  });

  afterAll(async () => {
    await app.close();
    await database.attendancePunch.deleteMany({ where: { device: { serialNumber } } });
    await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber } } });
    await database.device.deleteMany({ where: { serialNumber } });
    await database.employee.deleteMany({ where: { employeeCode: 'E.TRANSACTION001' } });
    await database.user.deleteMany({ where: { email } });
    await database.$disconnect();
  });

  it('exports the reference CSV headers and mapped employee name in WIB', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/transactions/export?from=2026-07-01&to=2026-07-01')
      .set('Authorization', authorization)
      .expect(200);
    expect(response.text.replace(/^\uFEFF/, '').split('\n')[0]).toBe('Index,Pin,Ename,Time,State,Verification,Work Code,Reserved,Device');
    expect(response.text).toContain('000000715');
    expect(response.text).toContain('Test Export');
  });
});
