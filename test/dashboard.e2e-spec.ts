import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('WIB dashboard (e2e)', () => {
  const database = new PrismaClient();
  const email = 'dashboard-hr@example.test';
  const serialNumber = 'TEST-DASHBOARD-DEVICE';
  let app: INestApplication<App>;
  let authorization: string;

  beforeAll(async () => {
    await database.attendancePunch.deleteMany({ where: { device: { serialNumber } } });
    await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber } } });
    await database.device.deleteMany({ where: { serialNumber } });
    await database.employee.deleteMany({ where: { employeeCode: 'E.DASHBOARD001' } });
    await database.user.deleteMany({ where: { email } });
    const device = await database.device.create({ data: { serialNumber } });
    const employee = await database.employee.create({ data: { employeeCode: 'E.DASHBOARD001', firstName: 'Dashboard', displayName: 'Dashboard Test' } });
    await database.deviceEnrollment.create({ data: { deviceId: device.id, employeeId: employee.id, pin: '000000715' } });
    await database.attendancePunch.createMany({ data: [
      { deviceId: device.id, userId: '000000715', occurredAtLocal: '2030-07-01 08:00:00', rawData: 'known' },
      { deviceId: device.id, userId: '999', occurredAtLocal: '2030-07-01 08:01:00', rawData: 'unknown' },
    ] });
    await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } });
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication(); configureApp(app); await app.init();
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' });
    authorization = `Bearer ${login.body.accessToken}`;
  });

  afterAll(async () => {
    await app.close(); await database.attendancePunch.deleteMany({ where: { device: { serialNumber } } }); await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber } } }); await database.device.deleteMany({ where: { serialNumber } }); await database.employee.deleteMany({ where: { employeeCode: 'E.DASHBOARD001' } }); await database.user.deleteMany({ where: { email } }); await database.$disconnect();
  });

  it('counts mapped employees, unmapped punches, and active devices for a WIB date', async () => {
    const response = await request(app.getHttpServer()).get('/api/dashboard?date=2030-07-01').set('Authorization', authorization).expect(200);
    expect(response.body).toEqual(expect.objectContaining({ date: '2030-07-01', punchedEmployees: 1, unmappedPunches: 1, activeDevices: 1 }));
    expect(response.body.activeEmployees).toBeGreaterThanOrEqual(1);
  });
});
