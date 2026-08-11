import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Attendance PDF report (e2e)', () => {
  const database = new PrismaClient(); const email = 'reports-hr@example.test'; let app: INestApplication<App>; let authorization: string;
  beforeAll(async () => { await database.user.deleteMany({ where: { email } }); await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } }); const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = fixture.createNestApplication(); configureApp(app); await app.init(); const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' }); authorization = `Bearer ${login.body.accessToken}`; });
  afterAll(async () => { await app.close(); await database.user.deleteMany({ where: { email } }); await database.$disconnect(); });
  it('downloads a WIB attendance report as PDF', async () => {
    const response = await request(app.getHttpServer()).get('/api/reports/attendance.pdf?from=2026-07-01&to=2026-07-01').set('Authorization', authorization).expect(200).expect('Content-Type', /application\/pdf/);
    expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
