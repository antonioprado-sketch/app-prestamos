import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Locations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5588221100';
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await app.close();
  });

  it('POST /locations requiere token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/locations')
      .send({ lat: 19.4326, lng: -99.1332, source: 'LOGIN' })
      .expect(401);
  });

  it('POST /locations rechaza a un rol distinto de CLIENT', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 19.4326, lng: -99.1332, source: 'LOGIN' })
      .expect(403);
  });

  it('POST /locations rechaza lat/lng fuera de rango', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 200, lng: -99.1332, source: 'LOGIN' })
      .expect(400);
  });

  it('POST /locations rechaza un source inválido', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 19.4326, lng: -99.1332, source: 'BACKGROUND' })
      .expect(400);
  });

  it('POST /locations registra la ubicación con accuracy opcional', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 19.4326, lng: -99.1332, accuracy: 15.5, source: 'REQUEST' })
      .expect(201);

    expect(res.body.id).toBeDefined();

    const stored = await prisma.location.findUnique({
      where: { id: BigInt(res.body.id) },
    });
    expect(stored?.customerPhone).toBe(clientPhone);
    expect(Number(stored?.lat)).toBeCloseTo(19.4326, 4);
    expect(Number(stored?.lng)).toBeCloseTo(-99.1332, 4);
    expect(stored?.source).toBe('REQUEST');
  });

  it('POST /locations acepta sin accuracy', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 19.4326, lng: -99.1332, source: 'LOGIN' })
      .expect(201);
  });
});
