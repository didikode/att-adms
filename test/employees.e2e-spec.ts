import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Employee management (e2e)', () => {
  const database = new PrismaClient();
  const email = 'employee-hr@example.test';
  const password = 'CorrectHorse1!';
  const deviceSerialNumber = 'TEST-EMPLOYEE-DEVICE-001';
  let app: INestApplication<App>;
  let authorization: string;

  beforeAll(async () => {
    await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber: deviceSerialNumber } } });
    await database.employee.deleteMany({ where: { employeeCode: 'E.RMS001' } });
    await database.device.upsert({ where: { serialNumber: deviceSerialNumber }, update: {}, create: { serialNumber: deviceSerialNumber } });
    await database.user.deleteMany({ where: { email } });
    await database.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 12), role: UserRole.HR },
    });
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    authorization = `Bearer ${login.body.accessToken}`;
  });

  afterAll(async () => {
    await app.close();
    await database.auditEvent.deleteMany({ where: { actor: { email } } });
    await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber: deviceSerialNumber } } });
    await database.employee.deleteMany({ where: { employeeCode: 'E.RMS001' } });
    await database.user.deleteMany({ where: { email } });
    await database.$disconnect();
  });

  it('creates and lists an active employee', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', authorization)
      .send({ employeeCode: 'E.RMS001', firstName: 'Test', lastName: 'User', email: 'test@example.test' })
      .expect(201);
    expect(created.body).toEqual(expect.objectContaining({ employeeCode: 'E.RMS001', displayName: 'Test User', active: true }));

    const listed = await request(app.getHttpServer())
      .get('/api/employees?q=RMS001')
      .set('Authorization', authorization)
      .expect(200);
    expect(listed.body.data).toEqual([expect.objectContaining({ employeeCode: 'E.RMS001' })]);

    const enrollment = await request(app.getHttpServer())
      .post(`/api/employees/${created.body.id}/enrollments`)
      .set('Authorization', authorization)
      .send({ deviceSerialNumber, pin: '000000715' })
      .expect(201);
    expect(enrollment.body).toEqual(expect.objectContaining({ pin: '000000715' }));

    const updated = await request(app.getHttpServer())
      .patch(`/api/employees/${created.body.id}`)
      .set('Authorization', authorization)
      .send({ firstName: 'Updated' })
      .expect(200);
    expect(updated.body).toEqual(expect.objectContaining({ displayName: 'Updated User' }));

    const deactivated = await request(app.getHttpServer())
      .post(`/api/employees/${created.body.id}/deactivate`)
      .set('Authorization', authorization)
      .expect(200);
    expect(deactivated.body).toEqual(expect.objectContaining({ active: false }));

    const audit = await request(app.getHttpServer())
      .get(`/api/employees/${created.body.id}/audit`)
      .set('Authorization', authorization)
      .expect(200);
    expect(audit.body.data.map((event: { action: string }) => event.action)).toEqual(
      expect.arrayContaining(['EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'EMPLOYEE_DEACTIVATED']),
    );
  });
});
