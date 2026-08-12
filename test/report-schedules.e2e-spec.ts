import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Report schedules (e2e)', () => {
  const database = new PrismaClient(); const email = 'schedules-hr@example.test'; let app: INestApplication<App>; let authorization: string;
  beforeAll(async () => { await database.user.deleteMany({ where: { email } }); await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } }); const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = fixture.createNestApplication(); configureApp(app); await app.init(); const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' }); authorization = `Bearer ${login.body.accessToken}`; });
  afterAll(async () => { await app.close(); await database.reportSchedule.deleteMany({ where: { createdBy: { email } } }); await database.user.deleteMany({ where: { email } }); await database.$disconnect(); });
  it('creates a weekly schedule with recipient and division scope', async () => {
    const response = await request(app.getHttpServer()).post('/api/report-schedules').set('Authorization', authorization).send({ name: 'Laporan HR mingguan', frequency: 'WEEKLY', weekday: 5, time: '08:30', recipients: ['didilesmana.net@gmail.com'], scope: 'DIVISION', divisionName: 'HRD' }).expect(201);
    expect(response.body).toEqual(expect.objectContaining({ frequency: 'WEEKLY', recipients: ['didilesmana.net@gmail.com'], divisionName: 'HRD', active: false }));
    await request(app.getHttpServer()).post(`/api/report-schedules/${response.body.id}/test-send`).set('Authorization', authorization).send({}).expect(201).expect({ sent: false, message: 'Konfirmasi wajib diisi' });
  });
});
