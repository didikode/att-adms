import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('Read-only employee API (e2e)', () => {
  const database = new PrismaClient();
  const email = 'employee-hr@example.test';
  const employeeCode = 'E.READONLY001';
  let app: INestApplication<App>;
  let authorization: string;
  beforeAll(async () => {
    await database.employee.deleteMany({ where: { employeeCode } }); await database.user.deleteMany({ where: { email } });
    await database.employee.create({ data: { employeeCode, firstName: 'Read', displayName: 'Read Only' } });
    await database.user.create({ data: { email, passwordHash: await bcrypt.hash('CorrectHorse1!', 12), role: UserRole.HR } });
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = fixture.createNestApplication(); configureApp(app); await app.init();
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'CorrectHorse1!' }); authorization = `Bearer ${login.body.accessToken}`;
  });
  afterAll(async () => { await app.close(); await database.employee.deleteMany({ where: { employeeCode } }); await database.user.deleteMany({ where: { email } }); await database.$disconnect(); });
  it('lists employees and does not expose mutations', async () => {
    await request(app.getHttpServer()).get('/api/employees?q=READONLY001').set('Authorization', authorization).expect(200).expect(({ body }) => expect(body.data).toEqual([expect.objectContaining({ employeeCode })]));
    for (const [method, path] of [['post', '/api/employees'], ['patch', '/api/employees/not-used'], ['post', '/api/employees/not-used/deactivate'], ['post', '/api/employees/not-used/enrollments']] as const) {
      await request(app.getHttpServer())[method](path).set('Authorization', authorization).send({}).expect(404);
    }
  });
});
