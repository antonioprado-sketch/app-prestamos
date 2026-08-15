import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { todayInMexicoCity } from '../src/loans/loan-quote';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const VALID_SIGNATURE = `data:image/png;base64,${TINY_PNG_BASE64}`;

describe('Score (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5599112233';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  let loanId: string;

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
        nombres: 'Score',
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
      .send({ signature: VALID_SIGNATURE, fullName: 'Score Test' })
      .expect(201);

    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await app.close();
  });

  it('GET /customers/me/score requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .expect(401);
  });

  it('GET /customers/me/score devuelve GREEN sin cuotas vencidas', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.level).toBe('GREEN');
    expect(res.body.maxDaysLate).toBe(0);
  });

  it('GET /customers/me/score sube a YELLOW con hasta 7 días de atraso', async () => {
    const schedule = await prisma.loanSchedule.findMany({
      where: { loanId: BigInt(loanId) },
      orderBy: { seq: 'asc' },
    });
    const today = todayInMexicoCity();
    await prisma.loanSchedule.update({
      where: { id: schedule[0].id },
      data: {
        dueDate: new Date(today.getTime() - 5 * 86400000),
        status: 'PENDING',
      },
    });

    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.level).toBe('YELLOW');
    expect(res.body.maxDaysLate).toBe(5);
  });

  it('GET /customers/me/score sube a ORANGE entre 8 y 15 días', async () => {
    const schedule = await prisma.loanSchedule.findMany({
      where: { loanId: BigInt(loanId) },
      orderBy: { seq: 'asc' },
    });
    const today = todayInMexicoCity();
    await prisma.loanSchedule.update({
      where: { id: schedule[0].id },
      data: { dueDate: new Date(today.getTime() - 10 * 86400000) },
    });

    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.level).toBe('ORANGE');
  });

  it('GET /customers/me/score sube a RED con más de 15 días', async () => {
    const schedule = await prisma.loanSchedule.findMany({
      where: { loanId: BigInt(loanId) },
      orderBy: { seq: 'asc' },
    });
    const today = todayInMexicoCity();
    await prisma.loanSchedule.update({
      where: { id: schedule[0].id },
      data: { dueDate: new Date(today.getTime() - 20 * 86400000) },
    });

    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.level).toBe('RED');
    expect(res.body.maxDaysLate).toBe(20);
  });

  it('GET /admin/scores rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/scores')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/scores lista a todos los clientes con su score', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/scores')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const mine = res.body.find(
      (s: { customerPhone: string }) => s.customerPhone === clientPhone,
    );
    expect(mine).toBeDefined();
    expect(mine.level).toBe('RED');
    expect(mine.customerName).toBe('Score Test');
    expect(mine.isManualOverride).toBe(false);
  });

  it('PATCH /admin/scores/:phone requiere token', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/scores/${clientPhone}`)
      .send({ level: 'GREEN' })
      .expect(401);
  });

  it('PATCH /admin/scores/:phone rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/scores/${clientPhone}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 'GREEN' })
      .expect(403);
  });

  it('PATCH /admin/scores/:phone rechaza un nivel inválido', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/scores/${clientPhone}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 'PURPLE' })
      .expect(400);
  });

  it('PATCH /admin/scores/:phone devuelve 404 si el cliente no existe', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .patch('/api/v1/admin/scores/5500000099')
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 'GREEN' })
      .expect(404);
  });

  it('PATCH /admin/scores/:phone fija un override manual que gana sobre el cálculo real', async () => {
    const adminToken = await loginAdmin();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/scores/${clientPhone}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ level: 'GREEN' })
      .expect(200);

    expect(res.body.level).toBe('GREEN');
    expect(res.body.isManualOverride).toBe(true);
    expect(res.body.maxDaysLate).toBe(20);

    const clientToken = await loginClient();
    const mine = await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(mine.body.level).toBe('GREEN');
    expect(mine.body.isManualOverride).toBe(true);

    const all = await request(app.getHttpServer())
      .get('/api/v1/admin/scores')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const mineInList = all.body.find(
      (s: { customerPhone: string }) => s.customerPhone === clientPhone,
    );
    expect(mineInList.level).toBe('GREEN');
    expect(mineInList.isManualOverride).toBe(true);
  });

  it('PATCH /admin/scores/:phone con level:null limpia el override y vuelve al cálculo real', async () => {
    const adminToken = await loginAdmin();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/scores/${clientPhone}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ level: null })
      .expect(200);

    expect(res.body.level).toBe('RED');
    expect(res.body.isManualOverride).toBe(false);
  });
});
