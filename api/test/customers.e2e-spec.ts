import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5544556677';
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';

  const validBody = {
    nombres: 'Juan',
    apellidos: 'Pérez López',
    aval: 'María Pérez López',
    avalPhone: '5511223344',
    calle: 'Av. Reforma',
    numero: '123',
    colonia: 'Centro',
    cp: '06000',
    ciudad: 'CDMX',
    estado: 'CDMX',
    referencias: 'Casa azul frente al parque',
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

  it('rechaza sin token', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .send(validBody)
      .expect(401);
  });

  it('rechaza a un rol distinto de CLIENT', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: adminPhone, password: adminPassword });
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send(validBody)
      .expect(403);
  });

  it('rechaza si falta un campo obligatorio', async () => {
    const token = await loginClient();
    const incomplete: Partial<typeof validBody> = { ...validBody };
    delete incomplete.referencias;
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`)
      .send(incomplete)
      .expect(400);
  });

  it('rechaza código postal inválido', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, cp: 'ABCDE' })
      .expect(400);
  });

  it('guarda los datos y marca onboarding completo', async () => {
    const token = await loginClient();
    const res = await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
      .expect(200);

    expect(res.body.nombres).toBe('Juan');
    expect(res.body.onboardingComplete).toBe(true);
  });
});
