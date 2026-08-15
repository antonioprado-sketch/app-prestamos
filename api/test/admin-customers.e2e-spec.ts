import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin customers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5588112233';
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
      .send({ amount: 10000, model: 'WEEKLY', openingDate: '2026-08-17' })
      .expect(200);
  });
});
