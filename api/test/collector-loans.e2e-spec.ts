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

describe('Collector loans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5566001122';
  const collectorPhone = '5566001133';
  const otherCollectorPhone = '5566001144';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  let loanId: string;
  let collectorToken: string;
  let otherCollectorToken: string;

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
    await prisma.user.deleteMany({ where: { phone: otherCollectorPhone } });
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
        nombres: 'Cartera',
        apellidos: 'Test',
        aval: 'Aval',
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
      .send({ signature: VALID_SIGNATURE, fullName: 'Cartera Test' })
      .expect(201);

    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const collectorRes = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: collectorPhone, name: 'Cobrador Cartera' })
      .expect(201);
    const collectorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: collectorPhone, password: collectorRes.body.tempPassword });
    collectorToken = collectorLogin.body.accessToken;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/assign-collector`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ collectorId: collectorRes.body.id })
      .expect(200);

    const otherCollectorRes = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: otherCollectorPhone, name: 'Cobrador Sin Cartera' })
      .expect(201);
    const otherCollectorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phone: otherCollectorPhone,
        password: otherCollectorRes.body.tempPassword,
      });
    otherCollectorToken = otherCollectorLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await prisma.user.deleteMany({ where: { phone: otherCollectorPhone } });
    await app.close();
  });

  it('GET /collector/loans requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/collector/loans')
      .expect(401);
  });

  it('GET /collector/loans rechaza a un rol distinto de COLLECTOR', async () => {
    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/collector/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('GET /collector/loans devuelve solo los préstamos asignados a ese cobrador', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/collector/loans')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(loanId);
    expect(res.body[0].customerName).toBe('Cartera Test');
    expect(res.body[0].status).toBe('APPROVED');
  });

  it('GET /collector/loans devuelve lista vacía para un cobrador sin préstamos asignados', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/collector/loans')
      .set('Authorization', `Bearer ${otherCollectorToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('GET /collector/loans/:id devuelve el detalle si el préstamo está asignado', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/collector/loans/${loanId}`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);

    expect(res.body.id).toBe(loanId);
    expect(res.body.schedule.length).toBeGreaterThan(0);
  });

  it('GET /collector/loans/:id devuelve 404 si el préstamo no está asignado a ese cobrador', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/collector/loans/${loanId}`)
      .set('Authorization', `Bearer ${otherCollectorToken}`)
      .expect(404);
  });

  it('el cobrador puede registrar un pago sobre su préstamo asignado desde la misma cartera', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ amount: 50, idempotencyKey: randomUUID() })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/collector/loans')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    expect(res.body[0].status).toBe('ACTIVE');
  });
});
