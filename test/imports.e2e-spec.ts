import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Device enrollment import preview (e2e)', () => {
  const database = new PrismaClient();
  const email = 'import-hr@example.test';
  let app: INestApplication<App>;
  let authorization: string;

  beforeAll(async () => {
    await database.user.deleteMany({ where: { email } });
    await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } });
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication(); configureApp(app); await app.init();
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' });
    authorization = `Bearer ${login.body.accessToken}`;
  });

  afterAll(async () => { await app.close(); await database.importRun.deleteMany({ where: { actor: { email } } }); await database.user.deleteMany({ where: { email } }); await database.$disconnect(); });

  it('previews a device enrollment CSV without changing device data', async () => {
    const csv = 'Pin,Emp Name,Registration Device,FP Count\n000000715,Zaldi,NHZ4254800180(192.168.1.99),1\n';
    const response = await request(app.getHttpServer())
      .post('/api/imports/device-enrollments/preview')
      .set('Authorization', authorization)
      .attach('file', Buffer.from(csv), 'employeeEnroll.csv')
      .expect(201);
    expect(response.body.summary.total).toBe(1);
    expect(response.body.rows[0].normalized.pin).toBe('000000715');
  });

  it('previews an HR workbook without creating employees', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Employees');
    sheet.addRow(['EmployeeID', 'FirstName', 'LastName', 'Active']);
    sheet.addRow(['E.RMS002', 'Preview', 'Only', true]);
    const buffer = await workbook.xlsx.writeBuffer();
    const response = await request(app.getHttpServer())
      .post('/api/imports/hr/preview')
      .set('Authorization', authorization)
      .attach('file', Buffer.from(buffer), 'employees.xlsx')
      .expect(201);
    expect(response.body.summary.total).toBe(1);
    expect(response.body.summary.manualMapping).toBe(1);
    expect(response.body.rows[0].normalized.employeeCode).toBe('E.RMS002');
    expect(response.body.importId).toEqual(expect.any(String));
    expect(await database.employee.count({ where: { employeeCode: 'E.RMS002' } })).toBe(0);

    await request(app.getHttpServer())
      .post(`/api/imports/${response.body.importId}/commit`)
      .set('Authorization', authorization)
      .expect(201);
    expect(await database.employee.count({ where: { employeeCode: 'E.RMS002' } })).toBe(1);
    await database.employee.deleteMany({ where: { employeeCode: 'E.RMS002' } });
  });
});
