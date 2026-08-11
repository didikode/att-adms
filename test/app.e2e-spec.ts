import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { ATTENDANCE_PUNCH_REPOSITORY } from './../src/iclock/attendance-punch.repository';

describe('ADMS device contract (e2e)', () => {
  let app: INestApplication<App>;
  let persistenceAccepts: boolean;
  let storedPunches: Set<string>;
  const configuredDeviceSerial = 'TEST-X105-ID-001';
  const previousAllowedDeviceSerials = process.env.ALLOWED_DEVICE_SERIALS;

  beforeEach(async () => {
    process.env.ALLOWED_DEVICE_SERIALS = configuredDeviceSerial;
    persistenceAccepts = true;
    storedPunches = new Set<string>();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ATTENDANCE_PUNCH_REPOSITORY)
      .useValue({
        save: (input: {
          deviceSerialNumber: string;
          userId: string;
          occurredAtLocal: string;
        }) => {
          const identity = `${input.deviceSerialNumber}\u0000${input.userId}\u0000${input.occurredAtLocal}`;
          if (!persistenceAccepts || storedPunches.has(identity)) {
            return Promise.resolve(false);
          }

          storedPunches.add(identity);
          return Promise.resolve(true);
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('returns the X105-ID handshake configuration', () => {
    return request(app.getHttpServer())
      .get('/iclock/cdata')
      .query({ SN: configuredDeviceSerial })
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect(
        [
          `GET OPTION FROM: ${configuredDeviceSerial}`,
          'Stamp=0',
          'OpStamp=0',
          'ErrorDelay=60',
          'Delay=60',
          'TransTimes=00:00;14:05',
          'TransInterval=1',
          'TransFlag=1111000000',
          'TimeZone=7',
          'Realtime=1',
          'Encrypt=0',
        ].join('\n'),
      );
  });

  it('rejects an anonymous device handshake', () => {
    return request(app.getHttpServer())
      .get('/iclock/cdata')
      .expect(400)
      .expect('Content-Type', /text\/plain/)
      .expect('Invalid parameter');
  });

  it('rejects a handshake from an unregistered device', () => {
    return request(app.getHttpServer())
      .get('/iclock/cdata')
      .query({ SN: 'UNREGISTERED-X105-ID' })
      .expect(403)
      .expect('Content-Type', /text\/plain/)
      .expect('Device is not registered');
  });

  it('accepts an ATTLOG record exactly once while acknowledging every upload', async () => {
    const attendanceLine = '411\t2026-08-11 08:00:00\t0\t1\t0\t0\t0\t0\t0\t0';

    await request(app.getHttpServer())
      .post('/iclock/cdata')
      .query({ SN: 'TEST-X105-ID-001', table: 'ATTLOG', Stamp: '1' })
      .set('Content-Type', 'text/plain')
      .send(attendanceLine)
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect('X-Records-Accepted', '1')
      .expect('OK: 1');

    await request(app.getHttpServer())
      .post('/iclock/cdata')
      .query({ SN: 'TEST-X105-ID-001', table: 'ATTLOG', Stamp: '1' })
      .set('Content-Type', 'text/plain')
      .send(attendanceLine)
      .expect(200)
      .expect('X-Records-Accepted', '0')
      .expect('OK: 1');
  });

  it('rejects an anonymous ATTLOG upload', () => {
    return request(app.getHttpServer())
      .post('/iclock/cdata')
      .query({ table: 'ATTLOG', Stamp: '1' })
      .set('Content-Type', 'text/plain')
      .send('411\t2026-08-11 08:00:00\t0\t1\t0')
      .expect(400)
      .expect('Content-Type', /text\/plain/)
      .expect('X-Records-Accepted', '0')
      .expect('Invalid parameter');
  });

  it('acknowledges a duplicate reported by persistent storage', () => {
    persistenceAccepts = false;

    return request(app.getHttpServer())
      .post('/iclock/cdata')
      .query({ SN: 'TEST-X105-ID-001', table: 'ATTLOG', Stamp: '1' })
      .set('Content-Type', 'text/plain')
      .send('411\t2026-08-11 08:00:00\t0\t1\t0')
      .expect(200)
      .expect('X-Records-Accepted', '0')
      .expect('OK: 1');
  });

  it('returns OK when the device has no pending command', () => {
    return request(app.getHttpServer())
      .get('/iclock/getrequest')
      .query({ SN: 'TEST-X105-ID-001' })
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect('OK');
  });

  it('acknowledges a device command response', () => {
    return request(app.getHttpServer())
      .post('/iclock/devicecmd')
      .query({ SN: configuredDeviceSerial })
      .set('Content-Type', 'text/plain')
      .send('ID=1\nReturn=0')
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect('OK');
  });

  it('rejects anonymous command polling', () => {
    return request(app.getHttpServer())
      .get('/iclock/getrequest')
      .expect(400)
      .expect('Content-Type', /text\/plain/)
      .expect('Invalid parameter');
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    if (previousAllowedDeviceSerials === undefined) {
      delete process.env.ALLOWED_DEVICE_SERIALS;
      return;
    }

    process.env.ALLOWED_DEVICE_SERIALS = previousAllowedDeviceSerials;
  });
});
