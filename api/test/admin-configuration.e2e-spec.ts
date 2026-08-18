import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { todayInMexicoCity } from '../src/loans/loan-quote';
import {
  PENALTY_PER_DAY_KEY,
  SCORE_YELLOW_MAX_DAYS_KEY,
  SCORE_ORANGE_MAX_DAYS_KEY,
} from '../src/configuration/business-rules.constants';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const VALID_SIGNATURE = `data:image/png;base64,${TINY_PNG_BASE64}`;

describe('Admin configuration - business rules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5599112244';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  const businessRulesKeys = [
    PENALTY_PER_DAY_KEY,
    SCORE_YELLOW_MAX_DAYS_KEY,
    SCORE_ORANGE_MAX_DAYS_KEY,
  ];
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

  async function resetBusinessRules(): Promise<void> {
    await prisma.configuration.deleteMany({
      where: { key: { in: businessRulesKeys } },
    });
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

    await resetBusinessRules();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: clientPhone, password: 'Abcdef12!' });

    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'Config',
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
      .send({ signature: VALID_SIGNATURE, fullName: 'Config Test' })
      .expect(201);

    const adminToken = await loginAdmin();
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
      data: { dueDate: new Date(today.getTime() - 3 * 86400000) },
    });
  });

  afterAll(async () => {
    await resetBusinessRules();
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await app.close();
  });

  afterEach(async () => {
    await resetBusinessRules();
  });

  it('GET /admin/configuration/business-rules requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/business-rules')
      .expect(401);
  });

  it('GET /admin/configuration/business-rules rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/configuration/business-rules devuelve los valores por defecto', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      penaltyPerDay: 50,
      yellowMaxDays: 7,
      orangeMaxDays: 15,
    });
  });

  it('PUT /admin/configuration/business-rules exige los 3 campos', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ penaltyPerDay: 60 })
      .expect(400);
  });

  it('PUT /admin/configuration/business-rules rechaza yellowMaxDays >= orangeMaxDays', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ penaltyPerDay: 50, yellowMaxDays: 15, orangeMaxDays: 7 })
      .expect(400);
  });

  it('PUT /admin/configuration/business-rules persiste y GET refleja el cambio', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ penaltyPerDay: 100, yellowMaxDays: 5, orangeMaxDays: 10 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      penaltyPerDay: 100,
      yellowMaxDays: 5,
      orangeMaxDays: 10,
    });
  });

  it('cambiar yellowMaxDays afecta en vivo el score de préstamos ya activos', async () => {
    const clientToken = await loginClient();
    const before = await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(before.body.level).toBe('YELLOW');
    expect(before.body.maxDaysLate).toBe(3);

    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/business-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ penaltyPerDay: 50, yellowMaxDays: 2, orangeMaxDays: 10 })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/api/v1/customers/me/score')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(after.body.level).toBe('ORANGE');
    expect(after.body.maxDaysLate).toBe(3);
  });
});

describe('Admin configuration - email (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5599112255';
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

  async function resetEmailConfig(): Promise<void> {
    await prisma.configuration.deleteMany({ where: { key: 'email.smtp' } });
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

    await resetEmailConfig();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: clientPhone, password: 'Abcdef12!' });
  });

  afterAll(async () => {
    await resetEmailConfig();
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await app.close();
  });

  afterEach(async () => {
    await resetEmailConfig();
  });

  it('GET /admin/configuration/email requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/email')
      .expect(401);
  });

  it('GET /admin/configuration/email rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/email')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/configuration/email devuelve valores por defecto sin contraseña configurada', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/configuration/email')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: '',
      hasPassword: false,
    });
  });

  it('PUT /admin/configuration/email nunca devuelve la contraseña en la respuesta', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/email')
      .set('Authorization', `Bearer ${token}`)
      .send({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'bot@example.com',
        pass: 'app-password-secreto',
      })
      .expect(200);

    expect(res.body).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'bot@example.com',
      hasPassword: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('app-password-secreto');
  });

  it('la contraseña queda cifrada en la base de datos, no en texto plano', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/email')
      .set('Authorization', `Bearer ${token}`)
      .send({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'bot@example.com',
        pass: 'app-password-secreto',
      })
      .expect(200);

    const row = await prisma.configuration.findUnique({
      where: { key: 'email.smtp' },
    });
    expect(JSON.stringify(row?.value)).not.toContain('app-password-secreto');
  });

  it('PUT /admin/configuration/email sin pass conserva la contraseña ya guardada', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/email')
      .set('Authorization', `Bearer ${token}`)
      .send({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'bot@example.com',
        pass: 'app-password-secreto',
      })
      .expect(200);

    const res = await request(app.getHttpServer())
      .put('/api/v1/admin/configuration/email')
      .set('Authorization', `Bearer ${token}`)
      .send({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: 'bot@example.com',
      })
      .expect(200);

    expect(res.body.port).toBe(587);
    expect(res.body.secure).toBe(false);
    expect(res.body.hasPassword).toBe(true);
  });

  it('POST /admin/configuration/email/test exige que ya haya credenciales guardadas', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/configuration/email/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'destinatario@example.com', text: 'Prueba' })
      .expect(400);
  });

  it('POST /admin/configuration/email/test valida el correo destinatario', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/configuration/email/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ to: 'no-es-un-correo', text: 'Prueba' })
      .expect(400);
  });
});
