import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { nextWeeklyOpeningDate } from './test-helpers';
import { todayInMexicoCity } from '../src/loans/loan-quote';

describe('Loans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5522334455';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';

  const validBody = {
    amount: 1000,
    model: 'WEEKLY',
    openingDate: nextWeeklyOpeningDate(), // lunes futuro
  };

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: adminPhone } });
    await app.close();
  });

  it('rechaza sin token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .send(validBody)
      .expect(401);
  });

  it('rechaza a un rol distinto de CLIENT', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPassword });
    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send(validBody)
      .expect(403);
  });

  it('rechaza parámetros de cotización inválidos (fecha no es lunes/viernes)', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, openingDate: '2026-08-18' })
      .expect(400);
  });

  it('rechaza monto sobre el tope de cliente nuevo', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, amount: 10000 })
      .expect(400);
  });

  let loanId: string;
  let folio: string;

  it('crea el préstamo en borrador con folio único y calendario', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
      .expect(201);

    expect(res.body.folio).toMatch(/^ppni-\d{4}$/);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.total).toBe(1400);
    expect(res.body.schedule).toHaveLength(20);
    expect(res.body.schedule[0].status).toBe('PENDING');
    expect(res.body.schedule[0].paidAmount).toBe(0);
    loanId = res.body.id;
    folio = res.body.folio;
  });

  it('GET /loans/:id expone el estado de cada cuota (PENDING antes de pagar)', async () => {
    const token = await loginClient();
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.schedule[0].status).toBe('PENDING');
    expect(detail.body.schedule[0].paidAmount).toBe(0);
  });

  it('GET /loans requiere token', async () => {
    await request(app.getHttpServer()).get('/api/v1/loans').expect(401);
  });

  it('GET /loans lista los préstamos del cliente autenticado', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].folio).toBe(folio);
    expect(res.body[0].schedule).toHaveLength(20);
  });

  it('GET /loans/:id devuelve el detalle del préstamo propio', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe(loanId);
    expect(res.body.folio).toBe(folio);
  });

  it('GET /loans/:id devuelve 404 si no existe', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/loans/999999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /loans/:id/penalty requiere token', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}/penalty`)
      .expect(401);
  });

  it('GET /loans/:id/penalty rechaza a un rol distinto de CLIENT', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPassword });
    await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}/penalty`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('GET /loans/:id/penalty devuelve 404 si no existe', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/loans/999999999/penalty')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /loans/:id/penalty devuelve 0 si ninguna cuota está vencida', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}/penalty`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.totalPenalty).toBe(0);
    expect(res.body.overdueInstallments).toHaveLength(0);
  });

  it('GET /loans/:id/penalty calcula la multa real de las cuotas vencidas', async () => {
    const schedule = await prisma.loanSchedule.findMany({
      where: { loanId: BigInt(loanId) },
      orderBy: { seq: 'asc' },
    });

    const today = todayInMexicoCity();
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
    const oneDayAgo = new Date(today.getTime() - 1 * 86400000);

    await prisma.loanSchedule.update({
      where: { id: schedule[0].id },
      data: { dueDate: threeDaysAgo, status: 'PENDING' },
    });
    await prisma.loanSchedule.update({
      where: { id: schedule[1].id },
      data: { dueDate: oneDayAgo, status: 'PARTIAL' },
    });
    await prisma.loanSchedule.update({
      where: { id: schedule[2].id },
      data: { dueDate: threeDaysAgo, status: 'PAID' },
    });

    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}/penalty`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.totalPenalty).toBe(3 * 50 + 1 * 50);
    expect(res.body.overdueInstallments).toHaveLength(2);
    expect(
      res.body.overdueInstallments.map((i: { seq: number }) => i.seq),
    ).toEqual([schedule[0].seq, schedule[1].seq]);
  });

  it('rechaza una segunda solicitud mientras haya una en curso', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
      .expect(409);
  });

  it('GET /loans/quote-limit devuelve null (sin tope) para anónimos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/loans/quote-limit')
      .expect(200);
    expect(res.body.maxAmount).toBeNull();
  });

  it('GET /loans/quote-limit de un cliente nuevo devuelve $3,000', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/loans/quote-limit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.maxAmount).toBe(3000);
  });

  it('GET /loans/quote-limit de un cliente ya no nuevo devuelve null (sin tope)', async () => {
    await prisma.customer.update({
      where: { phone: clientPhone },
      data: { isNewCustomer: false },
    });
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/loans/quote-limit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.maxAmount).toBeNull();
    await prisma.customer.update({
      where: { phone: clientPhone },
      data: { isNewCustomer: true },
    });
  });
});
