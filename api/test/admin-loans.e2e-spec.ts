import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { nextWeeklyOpeningDate } from './test-helpers';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const VALID_SIGNATURE = `data:image/png;base64,${TINY_PNG_BASE64}`;

describe('Admin loans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5533221100';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  let loanId: string;

  const customerData = {
    nombres: 'Marta',
    apellidos: 'Reyes',
    aval: 'Pedro Reyes',
    avalPhone: '5544332211',
    calle: 'Reforma',
    numero: '20',
    colonia: 'Centro',
    cp: '06000',
    ciudad: 'CDMX',
    estado: 'CDMX',
    referencias: 'Casa azul',
  };

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

  async function createSubmittedLoan(openingDate: string): Promise<string> {
    const token = await loginClient();
    const loan = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate });
    const id = loan.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/loans/${id}/pagare`)
      .set('Authorization', `Bearer ${token}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Marta Reyes' })
      .expect(201);

    return id;
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

    const token = await loginClient();
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`)
      .send(customerData)
      .expect(200);

    loanId = await createSubmittedLoan(nextWeeklyOpeningDate());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: '5577889900' } });
    await app.close();
  });

  it('GET /admin/loans requiere token', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/loans').expect(401);
  });

  it('GET /admin/loans rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get('/api/v1/admin/loans')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/loans lista préstamos con nombre del cliente', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/loans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const found = res.body.find((l: { id: string }) => l.id === loanId);
    expect(found).toBeDefined();
    expect(found.status).toBe('SUBMITTED');
    expect(found.customerName).toBe('Marta Reyes');
  });

  it('GET /admin/loans?status= filtra por estado', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/loans?status=SUBMITTED')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      res.body.every((l: { status: string }) => l.status === 'SUBMITTED'),
    ).toBe(true);
    expect(res.body.some((l: { id: string }) => l.id === loanId)).toBe(true);
  });

  it('GET /admin/loans?status= rechaza un estado inválido', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .get('/api/v1/admin/loans?status=NOPE')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('GET /admin/loans/:id devuelve 404 si no existe', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .get('/api/v1/admin/loans/999999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('POST /admin/loans/:id/request-correction exige motivo', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/request-correction`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
  });

  it('POST /admin/loans/:id/request-correction pide corrección y el cliente ve el motivo', async () => {
    const adminToken = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/request-correction`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Falta comprobante de domicilio legible' })
      .expect(200);

    expect(res.body.status).toBe('REQUIRES_CORRECTION');
    expect(res.body.adminNote).toBe('Falta comprobante de domicilio legible');

    const clientToken = await loginClient();
    const mine = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(mine.body.status).toBe('REQUIRES_CORRECTION');
    expect(mine.body.adminNote).toBe('Falta comprobante de domicilio legible');
  });

  it('el cliente puede volver a firmar el pagaré tras una corrección y el motivo se limpia', async () => {
    const clientToken = await loginClient();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Marta Reyes' })
      .expect(201);
    expect(res.body.status).toBe('SUBMITTED');

    const adminToken = await loginAdmin();
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/loans/${loanId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.adminNote).toBeNull();
  });

  it('POST /admin/loans/:id/reject exige motivo y rechaza el préstamo', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Documentos no coinciden con el titular' })
      .expect(200);

    expect(res.body.status).toBe('REJECTED');
    expect(res.body.adminNote).toBe('Documentos no coinciden con el titular');
  });

  it('no permite volver a revisar un préstamo ya rechazado', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  let secondLoanId: string;

  it('POST /admin/loans/:id/approve aprueba un préstamo enviado', async () => {
    secondLoanId = await createSubmittedLoan('2026-08-21'); // viernes futuro
    const token = await loginAdmin();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${secondLoanId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('APPROVED');
  });

  const collectorPhone = '5577889900';
  let collectorId: string;

  it('POST /admin/loans/:id/assign-collector asigna un cobrador a un préstamo aprobado', async () => {
    const collectorUser = await prisma.user.create({
      data: {
        phone: collectorPhone,
        passwordHash: 'x',
        role: 'COLLECTOR',
        collector: { create: { name: 'Rosa Cobradora' } },
      },
      include: { collector: true },
    });
    collectorId = String(collectorUser.collector!.id);

    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${secondLoanId}/assign-collector`)
      .set('Authorization', `Bearer ${token}`)
      .send({ collectorId })
      .expect(200);

    expect(res.body.collectorId).toBe(collectorId);
    expect(res.body.collectorName).toBe('Rosa Cobradora');
  });

  it('POST /admin/loans/:id/assign-collector devuelve 404 con un cobrador inexistente', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${secondLoanId}/assign-collector`)
      .set('Authorization', `Bearer ${token}`)
      .send({ collectorId: '999999999' })
      .expect(404);
  });

  it('POST /admin/loans/:id/unassign-collector quita al cobrador asignado', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${secondLoanId}/unassign-collector`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.collectorId).toBeNull();
  });

  it('POST /admin/loans/:id/assign-collector rechaza un préstamo que no está aprobado ni activo', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/assign-collector`) // loanId está REJECTED
      .set('Authorization', `Bearer ${token}`)
      .send({ collectorId })
      .expect(409);
  });
});
