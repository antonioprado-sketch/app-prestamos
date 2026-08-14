import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin bootstrap (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.ADMIN_PHONE = 'admin';
    process.env.ADMIN_PASSWORD = 'admin';
    const setupModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = setupModule.createNestApplication();
    await setupApp.init();
    prisma = setupModule.get(PrismaService);
    await prisma.user.deleteMany({ where: { phone: 'admin' } });
    await setupApp.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: 'admin' } });
    await app.close();
  });

  it('el admin inicial entra con mustChangePassword=true', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: 'admin', password: 'admin' })
      .expect(200);
    expect(res.body.mustChangePassword).toBe(true);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('no duplica el admin si ya existe (reinicio de la app)', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app2 = moduleFixture.createNestApplication();
    app2.useGlobalPipes(new ValidationPipe());
    await app2.init();
    const res = await request(app2.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: 'admin', password: 'admin' })
      .expect(200);
    expect(res.body.user.role).toBe('ADMIN');
    await app2.close();
  });

  it('el cambio de contraseña obligatorio funciona y limpia la bandera', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: 'admin', password: 'admin' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: 'admin', newPassword: 'AdminNuevo1!' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.body.user.mustChangePassword).toBe(false);
  });
});
