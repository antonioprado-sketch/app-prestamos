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

function webmBuffer(): Buffer {
  const buf = Buffer.alloc(200, 0);
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  return buf;
}

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5577889900';
  const otherPhone = '5599887766';

  async function loginClient(phone: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' });
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
    await prisma.user.deleteMany({ where: { phone: otherPhone } });
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
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: otherPhone, password: 'Abcdef12!' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await prisma.user.deleteMany({ where: { phone: otherPhone } });
    await app.close();
  });

  it('rechaza subida sin token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/documents')
      .field('type', 'INE_FRONT')
      .attach('file', jpegBuffer(), {
        filename: 'ine.jpg',
        contentType: 'image/jpeg',
      })
      .expect(401);
  });

  it('rechaza un archivo cuyo contenido no coincide con el mime declarado', async () => {
    const token = await loginClient(clientPhone);
    await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'INE_FRONT')
      .attach('file', Buffer.from('no es una imagen real'), {
        filename: 'ine.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  let documentId: string;

  it('sube un documento válido', async () => {
    const token = await loginClient(clientPhone);
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'INE_FRONT')
      .attach('file', jpegBuffer(), {
        filename: 'ine.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(res.body.type).toBe('INE_FRONT');
    expect(res.body.mime).toBe('image/jpeg');
    documentId = res.body.id;
  });

  it('lista los documentos propios', async () => {
    const token = await loginClient(clientPhone);
    const res = await request(app.getHttpServer())
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(documentId);
  });

  it('genera una URL firmada para el documento propio', async () => {
    const token = await loginClient(clientPhone);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}/signed-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.url).toMatch(/^https?:\/\//);
  });

  it('devuelve 404 al pedir la URL firmada de un documento ajeno', async () => {
    const token = await loginClient(otherPhone);
    await request(app.getHttpServer())
      .get(`/api/v1/documents/${documentId}/signed-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('sube un video de identidad (webm) hasta 50MB', async () => {
    const token = await loginClient(clientPhone);
    const res = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'VIDEO_IDENTITY')
      .attach('file', webmBuffer(), {
        filename: 'video.webm',
        contentType: 'video/webm',
      })
      .expect(201);

    expect(res.body.type).toBe('VIDEO_IDENTITY');
    expect(res.body.mime).toBe('video/webm');
  });
});
