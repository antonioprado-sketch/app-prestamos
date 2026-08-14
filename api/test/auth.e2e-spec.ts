import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phone = '5512345678';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    prisma = moduleFixture.get(PrismaService);
    await prisma.user.deleteMany({ where: { phone } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone } });
    await app.close();
  });

  it('registra un cliente', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone, email: 'cliente@test.com', password: 'Abcdef12!' })
      .expect(201);
  });

  it('rechaza contraseña débil', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone: '5599999999', password: 'corta1' })
      .expect(400);
  });

  it('rechaza teléfono duplicado', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ phone, password: 'Abcdef12!' })
      .expect(409);
  });

  it('login correcto devuelve tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rechaza login con contraseña incorrecta', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Incorrecta1' })
      .expect(401);
  });

  it('refresca el token y rota el refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(login.body.refreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it('GET /auth/me requiere token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /auth/me devuelve el usuario autenticado', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(res.body.user.phone).toBe(phone);
  });

  it('cambio de contraseña con token correcto', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' });
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: 'Abcdef12!', newPassword: 'NuevaClave2!' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'NuevaClave2!' })
      .expect(200);
  });

  it('logout revoca el refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'NuevaClave2!' });
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it('forgot-password no revela si el teléfono existe', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ phone: '5500000000' })
      .expect(202);
  });
});
