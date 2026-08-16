import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { todayInMexicoCity } from '../src/loans/loan-quote';

describe('BI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5588001199';
  const recurrentClientPhone = '5588001188';
  const collectorClientPhone = '5588001177';
  const collectorPhone = '5588001166';
  const trendsClientPhone = '5588001155';
  const geoClientPhone = '5588001144';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';

  async function loginClient(phone = clientPhone): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' });
    return res.body.accessToken;
  }

  async function loginAdmin(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPassword });
    return res.body.accessToken;
  }

  async function getKpis(token: string) {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/bi/kpis')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body;
  }

  beforeAll(async () => {
    const setupModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = setupModule.createNestApplication();
    await setupApp.init();
    prisma = setupModule.get(PrismaService);
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: recurrentClientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorClientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await prisma.user.deleteMany({ where: { phone: trendsClientPhone } });
    await prisma.user.deleteMany({ where: { phone: geoClientPhone } });
    await setupApp.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: recurrentClientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorClientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await prisma.user.deleteMany({ where: { phone: trendsClientPhone } });
    await prisma.user.deleteMany({ where: { phone: geoClientPhone } });
    await app.close();
  });

  it('GET /admin/bi/kpis requiere token', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/bi/kpis').expect(401);
  });

  it('GET /admin/bi/kpis rechaza a un rol distinto de ADMIN', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: clientPhone, password: 'Abcdef12!' });
    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/kpis')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('un préstamo aprobado con una cuota vencida mueve los KPIs los montos esperados', async () => {
    const adminToken = await loginAdmin();
    const before = await getKpis(adminToken);

    const rulesRes = await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const penaltyPerDay = rulesRes.body.penaltyPerDay;

    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'BI',
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
    const loanId = loan.body.id;

    const TINY_PNG_BASE64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        signature: `data:image/png;base64,${TINY_PNG_BASE64}`,
        fullName: 'BI Test',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const schedule = await prisma.loanSchedule.findMany({
      where: { loanId: BigInt(loanId) },
      orderBy: { seq: 'asc' },
    });
    const today = todayInMexicoCity();
    await prisma.loanSchedule.update({
      where: { id: schedule[0].id },
      data: { dueDate: new Date(today.getTime() - 5 * 86400000) },
    });

    const after = await getKpis(adminToken);

    expect(after.capitalColocado - before.capitalColocado).toBeCloseTo(1000, 2);
    expect(after.capitalPendiente - before.capitalPendiente).toBeCloseTo(
      1400,
      2,
    );
    expect(after.carteraVencida - before.carteraVencida).toBeCloseTo(
      Number(schedule[0].amount),
      2,
    );
    expect(after.multasAcumuladas - before.multasAcumuladas).toBeCloseTo(
      5 * penaltyPerDay,
      2,
    );
    const beforeApproved = before.loansByStatus.APPROVED ?? 0;
    expect(after.loansByStatus.APPROVED - beforeApproved).toBe(1);

    expect(
      after.customers.clientesActivos - before.customers.clientesActivos,
    ).toBe(1);
    expect(
      after.customers.clientesRecurrentes -
        before.customers.clientesRecurrentes,
    ).toBe(0);
    const beforeYellow = before.customers.porScore.YELLOW ?? 0;
    expect(after.customers.porScore.YELLOW - beforeYellow).toBe(1);
  });

  it('un cliente con más de un préstamo cuenta como recurrente', async () => {
    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: recurrentClientPhone, password: 'Abcdef12!' });
    const clientToken = await loginClient(recurrentClientPhone);
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'Recurrente',
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
    const before = await getKpis(adminToken);

    const loan1 = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate: '2026-08-17' });

    const TINY_PNG_BASE64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loan1.body.id}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        signature: `data:image/png;base64,${TINY_PNG_BASE64}`,
        fullName: 'BI Test',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loan1.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loan1.body.id}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1400, idempotencyKey: randomUUID() })
      .expect(201);

    const loan2 = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 500, model: 'WEEKLY', openingDate: '2026-08-17' })
      .expect(201);
    expect(loan2.body.id).not.toBe(loan1.body.id);

    const after = await getKpis(adminToken);
    expect(
      after.customers.clientesRecurrentes -
        before.customers.clientesRecurrentes,
    ).toBe(1);
  });

  it('GET /admin/bi/collectors requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/collectors')
      .expect(401);
  });

  it('GET /admin/bi/collectors rechaza a un rol distinto de ADMIN', async () => {
    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/collectors')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('GET /admin/bi/collectors refleja cartera, pagos registrados y cumplimiento de un cobrador', async () => {
    const adminToken = await loginAdmin();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: collectorClientPhone, password: 'Abcdef12!' });
    const clientToken = await loginClient(collectorClientPhone);
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'Cobrador',
        apellidos: 'BI',
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

    const TINY_PNG_BASE64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loan.body.id}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        signature: `data:image/png;base64,${TINY_PNG_BASE64}`,
        fullName: 'Cobrador BI',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loan.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const collectorRes = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: collectorPhone, name: 'Cobrador BI Test' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loan.body.id}/assign-collector`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ collectorId: collectorRes.body.id })
      .expect(200);
    const collectorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phone: collectorPhone,
        password: collectorRes.body.tempPassword,
      });
    const collectorToken = collectorLogin.body.accessToken;

    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loan.body.id}/payments`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ amount: 70, idempotencyKey: randomUUID() })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/bi/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const mine = res.body.find(
      (c: { collectorId: string }) => c.collectorId === collectorRes.body.id,
    );
    expect(mine).toBeDefined();
    expect(mine.carteraSize).toBe(1);
    expect(mine.pagosRegistrados).toBe(1);
    expect(mine.cumplimientoPct).toBe(100);
    expect(mine.carteraVencida).toBe(0);
  });

  it('GET /admin/bi/trends requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/trends')
      .expect(401);
  });

  it('GET /admin/bi/trends rechaza a un rol distinto de ADMIN', async () => {
    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/trends')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('GET /admin/bi/trends devuelve 12 semanas y refleja un pago nuevo en la semana actual', async () => {
    const adminToken = await loginAdmin();

    const before = await request(app.getHttpServer())
      .get('/api/v1/admin/bi/trends')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(before.body).toHaveLength(12);
    const currentWeekBefore = before.body[11].capitalCobrado;
    const expectedWeekStart = before.body[11].weekStart;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: trendsClientPhone, password: 'Abcdef12!' });
    const clientToken = await loginClient(trendsClientPhone);
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'Trends',
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
      .send({ amount: 500, model: 'WEEKLY', openingDate: '2026-08-17' });

    const TINY_PNG_BASE64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loan.body.id}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        signature: `data:image/png;base64,${TINY_PNG_BASE64}`,
        fullName: 'BI Test',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loan.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loan.body.id}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 35, idempotencyKey: randomUUID() })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/api/v1/admin/bi/trends')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(after.body[11].weekStart).toBe(expectedWeekStart);
    expect(after.body[11].capitalCobrado - currentWeekBefore).toBeCloseTo(
      35,
      2,
    );
  });

  it('GET /admin/bi/geo requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/geo')
      .expect(401);
  });

  it('GET /admin/bi/geo rechaza a un rol distinto de ADMIN', async () => {
    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/geo')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('GET /admin/bi/geo agrupa clientes nuevos por ciudad/colonia', async () => {
    const adminToken = await loginAdmin();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: geoClientPhone, password: 'Abcdef12!' });
    const clientToken = await loginClient(geoClientPhone);
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'Geo',
        apellidos: 'Test',
        aval: 'Aval',
        avalPhone: '5500000000',
        calle: 'Calle',
        numero: '1',
        colonia: 'Colonia BI Test Única',
        cp: '06000',
        ciudad: 'Ciudad BI Test Única',
        estado: 'CDMX',
        referencias: 'Ref',
      })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/bi/geo')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const zone = res.body.find(
      (z: { ciudad: string; colonia: string }) =>
        z.ciudad === 'Ciudad BI Test Única' &&
        z.colonia === 'Colonia BI Test Única',
    );
    expect(zone).toBeDefined();
    expect(zone.totalClientes).toBe(1);
    expect(zone.porScore.GREEN).toBe(1);
  });
});
