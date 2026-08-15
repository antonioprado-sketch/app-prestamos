import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { todayInMexicoCity } from '../src/loans/loan-quote';

describe('BI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5588001199';
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
    await app.close();
  });

  it('GET /admin/bi/kpis requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/bi/kpis')
      .expect(401);
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
    expect(after.capitalPendiente - before.capitalPendiente).toBeCloseTo(1400, 2);
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
  });
});
