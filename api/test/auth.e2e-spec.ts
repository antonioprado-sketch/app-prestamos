import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

function readCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match?.split(';')[0].split('=')[1];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const phone = '5512345678';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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

  it('login correcto devuelve el access token en el body y el refresh en cookie HttpOnly', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeUndefined();

    const raw = res.headers['set-cookie'];
    const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
    expect(refreshCookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it('rechaza login con contraseña incorrecta', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Incorrecta1' })
      .expect(401);
  });

  it('refresca el token vía cookie y rota el refresh token', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' });

    const first = await agent.post('/api/v1/auth/refresh').expect(200);
    expect(first.body.accessToken).toBeDefined();
    expect(first.body.refreshToken).toBeUndefined();
    const rotatedCookie = readCookie(first, 'refreshToken');
    expect(rotatedCookie).toBeDefined();

    // la cookie vieja (pre-rotación) ya fue revocada — reusarla debe fallar
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Abcdef12!' });
    const originalCookie = readCookie(loginRes, 'refreshToken');
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${originalCookie}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${originalCookie}`)
      .expect(401);
  });

  it('POST /auth/refresh sin cookie devuelve 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
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
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: 'Abcdef12!', newPassword: 'NuevaClave2!' })
      .expect(200);
    expect(res.body.refreshToken).toBeUndefined();
    expect(readCookie(res, 'refreshToken')).toBeDefined();
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'NuevaClave2!' })
      .expect(200);
  });

  it('logout revoca el refresh token y limpia la cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .send({ phone, password: 'NuevaClave2!' });
    await agent.post('/api/v1/auth/logout').expect(204);
    await agent.post('/api/v1/auth/refresh').expect(401);
  });

  it('forgot-password no revela si el teléfono existe', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ phone: '5500000000' })
      .expect(202);
  });
});
