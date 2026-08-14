import { PrismaClient } from '@prisma/client';

describe('Employee candidate persistence (e2e)', () => {
  const database = new PrismaClient();
  const serialNumber = 'TEST-CANDIDATE-PERSISTENCE';

  beforeAll(async () => {
    await database.employeeCandidate.deleteMany({ where: { device: { serialNumber } } });
    await database.device.deleteMany({ where: { serialNumber } });
  });

  afterAll(async () => {
    await database.employeeCandidate.deleteMany({ where: { device: { serialNumber } } });
    await database.device.deleteMany({ where: { serialNumber } });
    await database.$disconnect();
  });

  it('persists one candidate per device and PIN without sensitive fields', async () => {
    const device = await database.device.create({ data: { serialNumber } });
    const candidate = await database.employeeCandidate.create({
      data: { deviceId: device.id, pin: '0007', status: 'REQUESTED', requestedAt: new Date() },
    });

    expect(candidate).toEqual(expect.objectContaining({ pin: '0007', name: null, status: 'REQUESTED' }));
    expect(candidate).not.toHaveProperty('password');
    await expect(database.employeeCandidate.create({
      data: { deviceId: device.id, pin: '0007', status: 'REQUESTED', requestedAt: new Date() },
    })).rejects.toMatchObject({ code: 'P2002' });
  });
});
