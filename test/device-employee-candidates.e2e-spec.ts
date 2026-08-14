import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Device sourced employees (e2e)', () => {
  const database = new PrismaClient();
  const email = 'candidate-hr@example.test';
  const serial = 'TEST-CANDIDATE-DEVICE';
  const otherSerial = 'TEST-CANDIDATE-OTHER';
  const previousAllowed = process.env.ALLOWED_DEVICE_SERIALS;
  let app: INestApplication<App>;
  let authorization: string;
  let deviceId: string;

  beforeAll(async () => {
    process.env.ALLOWED_DEVICE_SERIALS = `${serial},${otherSerial}`;
    await database.auditEvent.deleteMany({ where: { actor: { email } } });
    await database.employeeCandidate.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.attendancePunch.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.deviceCommand.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.device.deleteMany({ where: { serialNumber: { in: [serial, otherSerial] } } });
    await database.employee.deleteMany({ where: { employeeCode: { in: ['0042', '0007'] } } });
    await database.user.deleteMany({ where: { email } });
    const device = await database.device.create({ data: { serialNumber: serial } });
    deviceId = device.id;
    await database.device.create({ data: { serialNumber: otherSerial } });
    await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } });
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication(); configureApp(app); await app.init();
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' });
    authorization = `Bearer ${login.body.accessToken}`;
  });

  afterAll(async () => {
    await app.close();
    await database.auditEvent.deleteMany({ where: { actor: { email } } });
    await database.employeeCandidate.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.attendancePunch.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.deviceCommand.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.deviceEnrollment.deleteMany({ where: { device: { serialNumber: { in: [serial, otherSerial] } } } });
    await database.device.deleteMany({ where: { serialNumber: { in: [serial, otherSerial] } } });
    await database.employee.deleteMany({ where: { employeeCode: { in: ['0042', '0007'] } } });
    await database.user.deleteMany({ where: { email } });
    await database.$disconnect();
    if (previousAllowed === undefined) delete process.env.ALLOWED_DEVICE_SERIALS; else process.env.ALLOWED_DEVICE_SERIALS = previousAllowed;
  });

  it('lists an unmapped ATTLOG PIN and queues one USERINFO command', async () => {
    await request(app.getHttpServer()).post('/iclock/cdata').query({ SN: serial, table: 'ATTLOG' }).set('Content-Type', 'text/plain').send('0042\t2026-08-14 08:00:00\t0\t1\t0\t0').expect(200);
    const listed = await request(app.getHttpServer()).get('/api/employee-candidates').set('Authorization', authorization).expect(200);
    const candidate = listed.body.data.find((item: { pin: string }) => item.pin === '0042');
    expect(candidate).toEqual(expect.objectContaining({ serialNumber: serial, state: 'DISCOVERED' }));
    await request(app.getHttpServer()).post(`/api/employee-candidates/${deviceId}/0042/request`).set('Authorization', authorization).expect(201);
    await request(app.getHttpServer()).post(`/api/employee-candidates/${deviceId}/0042/request`).set('Authorization', authorization).expect(201);
    expect(await database.deviceCommand.count({ where: { deviceId, command: 'DATA QUERY USERINFO PIN=0042', status: 'pending' } })).toBe(1);
  });

  it('accepts USERINFO but stores only PIN and name, then saves once', async () => {
    await request(app.getHttpServer()).post('/iclock/cdata').query({ SN: serial, table: 'OPERLOG' }).set('Content-Type', 'text/plain').send('USER PIN=0042\tName=Nama Mesin\tPasswd=secret\tCard=999\tFP=biometric').expect(200).expect('OK: 1');
    const candidate = await database.employeeCandidate.findUniqueOrThrow({ where: { deviceId_pin: { deviceId, pin: '0042' } } });
    expect(candidate).toEqual(expect.objectContaining({ name: 'Nama Mesin', status: 'READY' }));
    expect(JSON.stringify(candidate)).not.toContain('secret');
    expect(JSON.stringify(candidate)).not.toContain('999');
    expect(JSON.stringify(candidate)).not.toContain('biometric');
    const saved = await request(app.getHttpServer()).post(`/api/employee-candidates/${candidate.id}/save`).set('Authorization', authorization).expect(201);
    expect(saved.body).toEqual(expect.objectContaining({ employeeCode: '0042', displayName: 'Nama Mesin' }));
    expect(await database.deviceEnrollment.findUnique({ where: { deviceId_pin: { deviceId, pin: '0042' } } })).toEqual(expect.objectContaining({ employeeId: saved.body.id }));
    await request(app.getHttpServer()).post(`/api/employee-candidates/${candidate.id}/save`).set('Authorization', authorization).expect(409);
  });
});
