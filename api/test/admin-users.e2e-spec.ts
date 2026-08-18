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

describe('Admin users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  const clientPhone = '5588331100';
  const collectorPhone = '5588331101';
  const collectorWithLoanPhone = '5588331102';
  const clientWithLoanPhone = '5588331103';

  async function loginAdmin(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPassword });
    return res.body.accessToken;
  }

  async function cleanup(): Promise<void> {
    await prisma.user.deleteMany({
      where: {
        phone: {
          in: [
            clientPhone,
            collectorPhone,
            collectorWithLoanPhone,
            clientWithLoanPhone,
          ],
        },
      },
    });
  }

  beforeAll(async () => {
    const setupModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = setupModule.createNestApplication();
    await setupApp.init();
    prisma = setupModule.get(PrismaService);
    await setupApp.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    await cleanup();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: clientPhone, password: 'Abcdef12!' });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('GET /admin/users requiere token', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
  });

  it('GET /admin/users rechaza a un rol distinto de ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password: 'Abcdef12!' });
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(403);
  });

  it('GET /admin/users lista usuarios con nombre resuelto y filtra por rol', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?role=CLIENT')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const mine = res.body.find(
      (u: { phone: string }) => u.phone === clientPhone,
    );
    expect(mine).toBeDefined();
    expect(mine.role).toBe('CLIENT');
    expect(mine.status).toBe('ACTIVE');
    expect(res.body.every((u: { role: string }) => u.role === 'CLIENT')).toBe(
      true,
    );
  });

  it('GET /admin/users?role= rechaza un rol inválido', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .get('/api/v1/admin/users?role=SUPERADMIN')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('POST /admin/users/:phone/reset-password genera una contraseña temporal usable', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${clientPhone}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(typeof res.body.tempPassword).toBe('string');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password: res.body.tempPassword })
      .expect(200);
    expect(login.body.mustChangePassword).toBe(true);
  });

  it('POST /admin/users/:phone/reset-password rechaza resetear la propia cuenta', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${adminPhone}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('POST /admin/users/:phone/reset-password devuelve 404 si no existe', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/users/5500009999/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH /admin/collectors/:phone/status desactiva a un cobrador y le bloquea el login', async () => {
    const token = await loginAdmin();
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: collectorPhone, name: 'Cobrador Status' })
      .expect(201);
    const tempPassword = created.body.tempPassword;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/collectors/${collectorPhone}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: collectorPhone, password: tempPassword })
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/collectors/${collectorPhone}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: true })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: collectorPhone, password: tempPassword })
      .expect(200);
  });

  it('PATCH /admin/collectors/:phone/status devuelve 404 si el cobrador no existe', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .patch('/api/v1/admin/collectors/5500009998/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false })
      .expect(404);
  });

  it('PATCH /admin/users/:phone/role rechaza cambiar el propio rol', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${adminPhone}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'CLIENT' })
      .expect(400);
  });

  it('PATCH /admin/users/:phone/role rechaza un rol inválido en el body', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${clientPhone}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' })
      .expect(400);
  });

  it('PATCH /admin/users/:phone/role rechaza si ya tiene ese rol', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${clientPhone}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'CLIENT' })
      .expect(400);
  });

  it('PATCH /admin/users/:phone/role CLIENT->COLLECTOR crea el perfil de cobrador', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${clientPhone}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'COLLECTOR' })
      .expect(200);

    expect(res.body.role).toBe('COLLECTOR');

    const collector = await prisma.collector.findUnique({
      where: { phone: clientPhone },
    });
    expect(collector).not.toBeNull();

    // El Customer original se conserva como historial, no se borra.
    const customer = await prisma.customer.findUnique({
      where: { phone: clientPhone },
    });
    expect(customer).not.toBeNull();
  });

  it('PATCH /admin/users/:phone/role COLLECTOR->CLIENT no permite degradar a un cobrador con préstamos asignados', async () => {
    const adminToken = await loginAdmin();

    // Cliente con préstamo aprobado y asignado a un cobrador nuevo.
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: clientWithLoanPhone, password: 'Abcdef12!' });
    const clientToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: clientWithLoanPhone, password: 'Abcdef12!' })
    ).body.accessToken;
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombres: 'Con',
        apellidos: 'Prestamo',
        aval: 'Aval',
        avalPhone: '5500000001',
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
      .send({
        amount: 1000,
        model: 'WEEKLY',
        openingDate: nextWeeklyOpeningDate(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loan.body.id}/pagare`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Con Prestamo' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loan.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const collectorCreated = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: collectorWithLoanPhone, name: 'Cobrador Con Prestamo' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/loans/${loan.body.id}/assign-collector`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ collectorId: collectorCreated.body.id })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${collectorWithLoanPhone}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'CLIENT' })
      .expect(400);
  });

  it('PATCH /admin/users/:phone/role COLLECTOR->CLIENT funciona sin préstamos asignados', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${clientPhone}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'CLIENT' })
      .expect(200);

    expect(res.body.role).toBe('CLIENT');
    const collector = await prisma.collector.findUnique({
      where: { phone: clientPhone },
    });
    expect(collector).toBeNull();
  });
});
