import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

describe('HR authentication (e2e)', () => {
  let app: INestApplication<App>;
  const database = new PrismaClient();
  const email = 'admin@example.test';
  const password = 'CorrectHorse1!';

  beforeAll(async () => {
    await database.user.deleteMany({ where: { email } });
    await database.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: UserRole.ADMIN,
      },
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await database.user.deleteMany({ where: { email } });
    await database.$disconnect();
  });

  it('rejects an unauthenticated employee list', () => {
    return request(app.getHttpServer()).get('/api/employees').expect(401);
  });

  it('rejects a login with unknown credentials', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'unknown@example.test', password: 'CorrectHorse1!' })
      .expect(401);
  });

  it('returns the admin profile after a successful login', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect({ email, role: 'ADMIN' });
  });
});
