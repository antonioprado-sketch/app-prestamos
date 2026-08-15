import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const VALID_SIGNATURE = `data:image/png;base64,${TINY_PNG_BASE64}`;

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5544556677';
  const collectorPhone = '5555667788';
  const unassignedCollectorPhone = '5577665544';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  let loanId: string;

  async function loginAdmin(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPassword });
    return res.body.accessToken;
  }

  async function loginClient(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password: 'Abcdef12!' });
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const setupModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = setupModule.createNestApplication();
    await setupApp.init();
    prisma = setupModule.get(PrismaService);
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await prisma.user.deleteMany({
      where: { phone: unassignedCollectorPhone },
    });
    await setupApp.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: clientPhone, password: 'Abcdef12!' });

    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'Lucía',
        apellidos: 'Vega',
        aval: 'Aval Vega',
        avalPhone: '5500000000',
        calle: 'Calle',
        numero: '1',
        colonia: 'Col',
        cp: '06000',
        ciudad: 'CDMX',
        estado: 'CDMX',
        referencias: 'Ref',
      })
      .expect(200);

    const loan = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate: '2026-08-17' });
    loanId = loan.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Lucía Vega' })
      .expect(201);

    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const collector = await prisma.user.create({
      data: {
        phone: collectorPhone,
        passwordHash: 'x',
        role: 'COLLECTOR',
        collector: { create: { name: 'Cobradora Asignada' } },
      },
      include: { collector: true },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/assign-collector`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ collectorId: String(collector.collector!.id) })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await prisma.user.deleteMany({
      where: { phone: unassignedCollectorPhone },
    });
    await app.close();
  });

  let unassignedCollectorToken: string;

  it('setup: crea un cobrador sin asignar (con contraseña real) para las pruebas de rol', async () => {
    const adminToken = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: unassignedCollectorPhone, name: 'Cobrador Sin Asignar' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phone: unassignedCollectorPhone,
        password: res.body.tempPassword,
      });
    unassignedCollectorToken = login.body.accessToken;
    expect(unassignedCollectorToken).toBeDefined();
  });

  it('POST .../payments requiere token', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .send({ amount: 70, idempotencyKey: randomUUID() })
      .expect(401);
  });

  it('POST .../payments rechaza al cliente (no puede registrar sus propios pagos)', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 70, idempotencyKey: randomUUID() })
      .expect(403);
  });

  it('POST .../payments rechaza a un cobrador no asignado a este préstamo', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${unassignedCollectorToken}`)
      .send({ amount: 70, idempotencyKey: randomUUID() })
      .expect(403);
  });

  it('POST .../payments rechaza un monto mayor a lo pendiente', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 999999, idempotencyKey: randomUUID() })
      .expect(400);
  });

  const firstKey = randomUUID();

  it('POST .../payments registra el primer pago y activa el préstamo', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 70, idempotencyKey: firstKey })
      .expect(201);

    expect(res.body.penaltyApplied).toBe(0);
    expect(res.body.principalApplied).toBe(70);
    expect(res.body.alreadyProcessed).toBe(false);
    expect(res.body.loan.status).toBe('ACTIVE');
    expect(res.body.loan.schedule[0].seq).toBe(1);
  });

  it('POST .../payments con la misma idempotencyKey no vuelve a aplicar el pago', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 70, idempotencyKey: firstKey })
      .expect(201);

    expect(res.body.alreadyProcessed).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listRes.body).toHaveLength(1);
  });

  it('GET .../payments permite al cliente ver sus propios pagos', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(70);
  });

  it('GET .../payments devuelve 404 a un cobrador no asignado', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${unassignedCollectorToken}`)
      .expect(404);
  });

  it('POST .../payments liquida el préstamo cuando el pago cubre todo lo pendiente', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1330, idempotencyKey: randomUUID() })
      .expect(201);

    expect(res.body.loan.status).toBe('LIQUIDATED');

    const schedule = await prisma.loanSchedule.findMany({
      where: { loanId: BigInt(loanId) },
    });
    expect(schedule.every((s) => s.status === 'PAID')).toBe(true);

    const loanRow = await prisma.loan.findUnique({
      where: { id: BigInt(loanId) },
    });
    expect(loanRow?.liquidatedAt).not.toBeNull();
  });

  it('POST .../payments rechaza pagos sobre un préstamo ya liquidado', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, idempotencyKey: randomUUID() })
      .expect(409);
  });
});
