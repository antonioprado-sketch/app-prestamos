import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { nextWeeklyOpeningDate } from './test-helpers';

describe('Admin customers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5588112233';
  const manualClientPhone = '5588112244';
  const deletePhone = '5588221177';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';

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

  beforeAll(async () => {
    const setupModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = setupModule.createNestApplication();
    await setupApp.init();
    prisma = setupModule.get(PrismaService);
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: manualClientPhone } });
    await prisma.user.deleteMany({ where: { phone: deletePhone } });
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
        nombres: 'Admin',
        apellidos: 'Customers Test',
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: manualClientPhone } });
    await prisma.user.deleteMany({ where: { phone: deletePhone } });
    await app.close();
  });

  it('GET /admin/customers requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .expect(401);
  });

  it('GET /admin/customers rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/customers lista a los clientes registrados', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const mine = res.body.find(
      (c: { phone: string }) => c.phone === clientPhone,
    );
    expect(mine).toBeDefined();
    expect(mine.nombres).toBe('Admin');
    expect(mine.isNewCustomer).toBe(true);
    expect(mine.scoreLevel).toBe('GREEN');
  });

  it('GET /admin/customers/:phone devuelve el detalle con préstamos y documentos', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${clientPhone}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.phone).toBe(clientPhone);
    expect(res.body.aval).toBe('Aval');
    expect(res.body.loans).toEqual([]);
    expect(res.body.documents).toEqual([]);
  });

  it('GET /admin/customers/:phone devuelve 404 si no existe', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .get('/api/v1/admin/customers/5500000099')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH /admin/customers/:phone/new-client exige el campo isNewCustomer', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${clientPhone}/new-client`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it('PATCH /admin/customers/:phone/new-client actualiza el flag y afecta el tope de préstamo', async () => {
    const adminToken = await loginAdmin();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${clientPhone}/new-client`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isNewCustomer: false })
      .expect(200);
    expect(res.body.isNewCustomer).toBe(false);

    const clientToken = await loginClient();
    // Como cliente ya no "nuevo", puede cotizar por encima del tope de $3,000
    await request(app.getHttpServer())
      .post('/api/v1/loans/quote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        amount: 10000,
        model: 'WEEKLY',
        openingDate: nextWeeklyOpeningDate(),
      })
      .expect(200);
  });

  it('POST /admin/customers requiere token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/customers')
      .send({ phone: manualClientPhone })
      .expect(401);
  });

  it('POST /admin/customers rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: manualClientPhone })
      .expect(403);
  });

  it('POST /admin/customers da de alta un cliente con contraseña temporal', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: manualClientPhone })
      .expect(201);

    expect(res.body.phone).toBe(manualClientPhone);
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(8);

    const user = await prisma.user.findUnique({
      where: { phone: manualClientPhone },
      include: { customer: true },
    });
    expect(user?.role).toBe('CLIENT');
    expect(user?.mustChangePassword).toBe(true);
    expect(user?.customer?.isNewCustomer).toBe(true);
  });

  it('POST /admin/customers rechaza un teléfono duplicado', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: manualClientPhone })
      .expect(409);
  });

  it('el cliente dado de alta manualmente puede loguearse con la contraseña temporal', async () => {
    const token = await loginAdmin();
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '5588112255' })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '5588112255', password: created.body.tempPassword })
      .expect(200);
    expect(loginRes.body.mustChangePassword).toBe(true);

    await prisma.user.deleteMany({ where: { phone: '5588112255' } });
  });

  it('DELETE /admin/customers/:phone requiere token', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/customers/${deletePhone}`)
      .expect(401);
  });

  it('DELETE /admin/customers/:phone rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/customers/${deletePhone}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('DELETE /admin/customers/:phone rechaza eliminar a un no-cliente', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/customers/${adminPhone}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('DELETE /admin/customers/:phone borra el cliente, sus préstamos y libera el teléfono', async () => {
    const adminToken = await loginAdmin();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: deletePhone, password: 'Abcdef12!' })
      .expect(201);

    const clientLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: deletePhone, password: 'Abcdef12!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${clientLogin.body.accessToken}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate: '2026-08-24' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/customers/${deletePhone}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.removed).toBe(true);

    const user = await prisma.user.findUnique({
      where: { phone: deletePhone },
    });
    expect(user).toBeNull();
    const loans = await prisma.loan.count({
      where: { customerPhone: deletePhone },
    });
    expect(loans).toBe(0);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: deletePhone, password: 'Abcdef12!' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: deletePhone, password: 'Abcdef12!' })
      .expect(201);
  });

  it('DELETE /admin/customers/:phone devuelve 404 si no existe', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .delete('/api/v1/admin/customers/5500000098')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
