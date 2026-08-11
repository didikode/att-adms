import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

const database = new PrismaClient();
const serialNumber = 'PERSISTENCE-TEST-X105-ID-001';

async function createApplication(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('PostgreSQL attendance persistence (e2e)', () => {
  const previousAllowedDeviceSerials = process.env.ALLOWED_DEVICE_SERIALS;

  beforeEach(async () => {
    process.env.ALLOWED_DEVICE_SERIALS = serialNumber;
    await database.attendancePunch.deleteMany({
      where: { device: { serialNumber } },
    });
    await database.device.deleteMany({ where: { serialNumber } });
  });

  afterAll(async () => {
    await database.attendancePunch.deleteMany({
      where: { device: { serialNumber } },
    });
    await database.device.deleteMany({ where: { serialNumber } });
    await database.$disconnect();

    if (previousAllowedDeviceSerials === undefined) {
      delete process.env.ALLOWED_DEVICE_SERIALS;
      return;
    }

    process.env.ALLOWED_DEVICE_SERIALS = previousAllowedDeviceSerials;
  });

  it('deduplicates an ATTLOG record after the application restarts', async () => {
    const attendanceLine = '411\t2026-08-11 08:00:00\t0\t1\t0';
    const firstApp = await createApplication();

    await request(firstApp.getHttpServer())
      .post('/iclock/cdata')
      .query({ SN: serialNumber, table: 'ATTLOG', Stamp: '1' })
      .set('Content-Type', 'text/plain')
      .send(attendanceLine)
      .expect(200)
      .expect('X-Records-Accepted', '1')
      .expect('OK: 1');

    await firstApp.close();

    const restartedApp = await createApplication();

    await request(restartedApp.getHttpServer())
      .post('/iclock/cdata')
      .query({ SN: serialNumber, table: 'ATTLOG', Stamp: '1' })
      .set('Content-Type', 'text/plain')
      .send(attendanceLine)
      .expect(200)
      .expect('X-Records-Accepted', '0')
      .expect('OK: 1');

    await restartedApp.close();
  });
});
