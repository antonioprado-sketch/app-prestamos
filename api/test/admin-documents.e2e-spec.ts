import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

function jpegBuffer(): Buffer {
  const buf = Buffer.alloc(100, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

describe('Admin documents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5588220033';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  let documentId: string;

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
    const upload = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('type', 'INE_FRONT')
      .attach('file', jpegBuffer(), {
        filename: 'ine.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    documentId = upload.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await app.close();
  });

  it('GET /admin/customers/:phone/documents requiere token', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${clientPhone}/documents`)
      .expect(401);
  });

  it('GET /admin/customers/:phone/documents rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${clientPhone}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/customers/:phone/documents lista los documentos del cliente', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${clientPhone}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(documentId);
    expect(res.body[0].type).toBe('INE_FRONT');
  });

  it('GET /admin/documents/:id/signed-url requiere token', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/documents/${documentId}/signed-url`)
      .expect(401);
  });

  it('GET /admin/documents/:id/signed-url rechaza a un rol distinto de ADMIN', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .get(`/api/v1/admin/documents/${documentId}/signed-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/documents/:id/signed-url devuelve una URL firmada, sin importar de quién es el documento', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/documents/${documentId}/signed-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(typeof res.body.url).toBe('string');
    expect(res.body.url).toContain('http');
  });

  it('GET /admin/documents/:id/signed-url devuelve 404 si el documento no existe', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .get('/api/v1/admin/documents/999999999/signed-url')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
