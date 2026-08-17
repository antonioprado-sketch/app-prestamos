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

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5522334400';
  const collectorPhone = '5522334401';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  let loanId: string;
  let collectorId: string;

  const customerData = {
    nombres: 'Noe',
    apellidos: 'Fuentes',
    aval: 'Rita Fuentes',
    avalPhone: '5533221199',
    calle: 'Insurgentes',
    numero: '55',
    colonia: 'Roma',
    cp: '06700',
    ciudad: 'CDMX',
    estado: 'CDMX',
    referencias: 'Portón negro',
  };

  async function loginClient(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password: 'Abcdef12!' });
    return res.body.accessToken;
  }

  let collectorPassword: string;

  async function loginCollector(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: collectorPhone, password: collectorPassword });
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
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
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
      .send(customerData)
      .expect(200);

    const loan = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate: '2026-08-17' });
    loanId = loan.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Noe Fuentes' })
      .expect(201);

    const adminToken = await loginAdmin();
    const collectorRes = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: collectorPhone, name: 'Iris Cobradora' })
      .expect(201);
    collectorId = collectorRes.body.id;
    collectorPassword = collectorRes.body.tempPassword;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await app.close();
  });

  it('GET /notifications requiere token', async () => {
    await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
  });

  it('POST /notifications/webpush-subscribe rechaza body inválido', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/notifications/webpush-subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'no-es-url' })
      .expect(400);
  });

  it('POST /notifications/webpush-subscribe guarda la suscripción', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/notifications/webpush-subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-1',
        keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' },
      })
      .expect(201, { subscribed: true });
  });

  it('GET /notifications empieza vacío para el cliente', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  let correctionNotificationId: string;

  it('pedir corrección crea una notificación in-app para el cliente', async () => {
    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/request-correction`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Falta comprobante legible' })
      .expect(200);

    const clientToken = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const found = res.body.find(
      (n: { type: string }) => n.type === 'loan_requires_correction',
    );
    expect(found).toBeDefined();
    expect(found.body).toBe('Falta comprobante legible');
    expect(found.read).toBe(false);
    correctionNotificationId = found.id;
  });

  it('PATCH /notifications/:id/read marca la notificación como leída', async () => {
    const clientToken = await loginClient();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${correctionNotificationId}/read`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(res.body.read).toBe(true);
  });

  it('PATCH /notifications/:id/read devuelve 404 sobre una notificación ajena', async () => {
    const collectorToken = await loginCollector();
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${correctionNotificationId}/read`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(404);
  });

  it('aprobar el préstamo crea una notificación con el folio', async () => {
    const clientToken = await loginClient();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Noe Fuentes' })
      .expect(201);

    const adminToken = await loginAdmin();
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const folio = approveRes.body.folio;

    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const found = res.body.find(
      (n: { type: string }) => n.type === 'loan_approved',
    );
    expect(found).toBeDefined();
    expect(found.body).toContain(folio);
  });

  it('asignar cobrador crea una notificación para el cobrador', async () => {
    const adminToken = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loanId}/assign-collector`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ collectorId })
      .expect(200);

    const collectorToken = await loginCollector();
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    const found = res.body.find(
      (n: { type: string }) => n.type === 'loan_assigned',
    );
    expect(found).toBeDefined();
  });

  it('registrar un pago crea una notificación para el cliente', async () => {
    const collectorToken = await loginCollector();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/payments`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ amount: 50, idempotencyKey: randomUUID() })
      .expect(201);

    const clientToken = await loginClient();
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const found = res.body.find(
      (n: { type: string }) => n.type === 'payment_registered',
    );
    expect(found).toBeDefined();
  });
});
