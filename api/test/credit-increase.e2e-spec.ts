import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Credit increase (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5533445566';
  const collectorPhone = '5533445577';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  let collectorPassword: string;

  async function loginClient(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password: 'Abcdef12!' });
    return res.body.accessToken;
  }

  async function loginAdmin(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPassword });
    return res.body.accessToken;
  }

  async function loginCollector(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: collectorPhone, password: collectorPassword });
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
    await prisma.user.deleteMany({ where: { phone: adminPhone } });
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

    const adminToken = await loginAdmin();
    const collectorRes = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: collectorPhone, name: 'Cobrador Aumentos' })
      .expect(201);
    collectorPassword = collectorRes.body.tempPassword;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await prisma.user.deleteMany({ where: { phone: adminPhone } });
    await app.close();
  });

  it('GET /credit-increase/me devuelve null sin solicitudes', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/credit-increase/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.request).toBeNull();
  });

  it('POST /credit-increase requiere token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/credit-increase')
      .send({ amount: 3500 })
      .expect(401);
  });

  it('POST /credit-increase rechaza a un rol distinto de CLIENT', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3500 })
      .expect(403);
  });

  it('POST /credit-increase rechaza un monto que no es múltiplo de 500', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3200 })
      .expect(400);
  });

  it('POST /credit-increase rechaza un monto menor o igual al tope actual', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3000 })
      .expect(400);
  });

  let firstRequestId: string;

  it('POST /credit-increase crea la solicitud y notifica a admin y cobrador', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .post('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3500 })
      .expect(201);
    firstRequestId = res.body.id;
    expect(res.body.status).toBe('PENDING');
    expect(res.body.currentMaxAmount).toBe(3000);

    const adminNotif = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${await loginAdmin()}`)
      .expect(200);
    expect(
      adminNotif.body.some(
        (n: { type: string; body: string }) =>
          n.type === 'credit_increase_request' && n.body.includes(clientPhone),
      ),
    ).toBe(true);
  });

  it('POST /credit-increase rechaza una segunda solicitud pendiente', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 4000 })
      .expect(409);
  });

  it('GET /credit-increase (lista pendiente) rechaza a un cliente', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /credit-increase lista la solicitud pendiente para admin y cobrador', async () => {
    const adminToken = await loginAdmin();
    const adminList = await request(app.getHttpServer())
      .get('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body).toHaveLength(1);
    expect(adminList.body[0]).toMatchObject({
      id: firstRequestId,
      customerPhone: clientPhone,
      amount: 3500,
      status: 'PENDING',
      currentMaxAmount: 3000,
    });

    const collectorList = await request(app.getHttpServer())
      .get('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${await loginCollector()}`)
      .expect(200);
    expect(collectorList.body).toHaveLength(1);
  });

  it('PATCH /credit-increase/:id rechaza a un cliente', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .patch(`/api/v1/credit-increase/${firstRequestId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED' })
      .expect(403);
  });

  it('PATCH /credit-increase/:id aprobado sube el límite del cliente', async () => {
    const adminToken = await loginAdmin();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/credit-increase/${firstRequestId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(res.body.status).toBe('APPROVED');

    const token = await loginClient();
    const limit = await request(app.getHttpServer())
      .get('/api/v1/loans/quote-limit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(limit.body.maxAmount).toBe(3500);

    const me = await request(app.getHttpServer())
      .get('/api/v1/credit-increase/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.request.status).toBe('APPROVED');
  });

  let secondRequestId: string;

  it('el cliente puede volver a solicitar sobre el nuevo tope', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .post('/api/v1/credit-increase')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 4000 })
      .expect(201);
    secondRequestId = res.body.id;
    expect(res.body.currentMaxAmount).toBe(3500);
  });

  it('el cobrador puede rechazar una solicitud pendiente', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/credit-increase/${secondRequestId}`)
      .set('Authorization', `Bearer ${await loginCollector()}`)
      .send({ status: 'REJECTED', note: 'Aún no aplica' })
      .expect(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.note).toBe('Aún no aplica');

    const token = await loginClient();
    const me = await request(app.getHttpServer())
      .get('/api/v1/credit-increase/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.request.status).toBe('REJECTED');
    expect(me.body.request.note).toBe('Aún no aplica');
  });

  it('PATCH sobre una solicitud ya resuelta devuelve 409', async () => {
    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/credit-increase/${firstRequestId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(409);
  });
});
