import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin blacklist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const blockedPhone = '5500000001';
  const clientWithLoanPhone = '5500000002';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';

  async function loginClient(phone: string): Promise<string> {
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

  beforeAll(async () => {
    const setupModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = setupModule.createNestApplication();
    await setupApp.init();
    prisma = setupModule.get(PrismaService);
    await prisma.blacklist.deleteMany({});
    await prisma.user.deleteMany({ where: { phone: clientWithLoanPhone } });
    await setupApp.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: clientWithLoanPhone, password: 'Abcdef12!' });
  });

  afterAll(async () => {
    await prisma.blacklist.deleteMany({});
    await prisma.user.deleteMany({ where: { phone: blockedPhone } });
    await prisma.user.deleteMany({ where: { phone: clientWithLoanPhone } });
    await app.close();
  });

  it('GET /admin/blacklist requiere token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/blacklist')
      .expect(401);
  });

  it('GET /admin/blacklist rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient(clientWithLoanPhone);
    await request(app.getHttpServer())
      .get('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/blacklist devuelve la lista vacía al inicio', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST /admin/blacklist agrega un teléfono con motivo', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: blockedPhone, reason: 'Fraude detectado' })
      .expect(201);

    expect(res.body.phone).toBe(blockedPhone);
    expect(res.body.reason).toBe('Fraude detectado');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].phone).toBe(blockedPhone);
  });

  it('POST /admin/blacklist rechaza un teléfono duplicado', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: blockedPhone, reason: 'Otra vez' })
      .expect(409);
  });

  it('POST /admin/blacklist valida teléfono de 10 dígitos', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '123', reason: 'invalido' })
      .expect(400);
  });

  it('POST /admin/blacklist exige motivo', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '5500000003' })
      .expect(400);
  });

  it('un teléfono en lista negra no puede registrarse', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: blockedPhone, password: 'Abcdef12!' })
      .expect(403);
  });

  it('un cliente en lista negra no puede solicitar un préstamo', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: clientWithLoanPhone, reason: 'Moroso' })
      .expect(201);

    const clientToken = await loginClient(clientWithLoanPhone);
    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate: '2026-08-24' })
      .expect(403);
  });

  it('DELETE /admin/blacklist/:phone quita el teléfono de la lista', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/blacklist/${clientWithLoanPhone}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.removed).toBe(true);

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/blacklist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const clientToken = await loginClient(clientWithLoanPhone);
    await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate: '2026-08-24' })
      .expect(201);
  });

  it('DELETE /admin/blacklist/:phone devuelve 404 si no está en la lista', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .delete('/api/v1/admin/blacklist/5500000004')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
