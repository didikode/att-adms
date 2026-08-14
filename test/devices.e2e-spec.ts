import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Device status (e2e)', () => {
  const database = new PrismaClient();
  const email = 'devices-hr@example.test';
  const serialNumber = 'TEST-STATUS-DEVICE';
  let app: INestApplication<App>;
  let authorization: string;

  beforeAll(async () => {
    await database.device.deleteMany({ where: { serialNumber } }); await database.user.deleteMany({ where: { email } });
    await database.device.create({ data: { serialNumber, aliasName: '192.168.1.99', ipAddress: '192.168.1.99', lastActivityAt: new Date() } });
    await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } });
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = fixture.createNestApplication(); configureApp(app); await app.init();
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' }); authorization = `Bearer ${login.body.accessToken}`;
  });
  afterAll(async () => { await app.close(); await database.device.deleteMany({ where: { serialNumber: { in: [serialNumber, 'TEST-SYNC-001'] } } }); await database.user.deleteMany({ where: { email } }); await database.$disconnect(); });
  it('returns ADMS-based online status and device detail fields', async () => {
    const response = await request(app.getHttpServer()).get('/api/devices').set('Authorization', authorization).expect(200);
    expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ serialNumber, aliasName: '192.168.1.99', ipAddress: '192.168.1.99', status: 'ONLINE' })]));
  });
  it('registers a trimmed serial and rejects a duplicate', async () => {
    await database.device.deleteMany({ where: { serialNumber: 'TEST-SYNC-001' } });
    await request(app.getHttpServer()).post('/api/devices').set('Authorization', authorization).send({ serialNumber: '  TEST-SYNC-001  ' }).expect(201).expect(({ body }) => expect(body).toEqual(expect.objectContaining({ serialNumber: 'TEST-SYNC-001' })));
    await request(app.getHttpServer()).post('/api/devices').set('Authorization', authorization).send({ serialNumber: 'TEST-SYNC-001' }).expect(409).expect(({ body }) => expect(body.message).toContain('sudah terdaftar'));
    await request(app.getHttpServer()).post('/api/devices').set('Authorization', authorization).send({ serialNumber: ' ' }).expect(400);
    await request(app.getHttpServer()).post('/api/devices').send({ serialNumber: 'TEST-NO-AUTH' }).expect(401);
    await database.device.deleteMany({ where: { serialNumber: 'TEST-SYNC-001' } });
  });
});
