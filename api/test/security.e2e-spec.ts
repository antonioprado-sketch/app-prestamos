import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Suite dedicada a las tres categorías de "pruebas de seguridad" que pide la
 * spec (sección 8): fuerza bruta, manipulación de roles/tokens, acceso a
 * recursos ajenos. El acceso a recursos ajenos (ownership 404) ya tiene
 * cobertura exhaustiva por endpoint en los e2e de cada módulo (loans,
 * documents, payments, admin-loans, collector-loans, notifications) — acá
 * solo se agregan 2 casos representativos como ancla de auditoría, no se
 * duplica esa cobertura completa.
 */
describe('Seguridad (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const bruteForcePhone = '5511220001';
  const clientAPhone = '5511220002';
  const clientBPhone = '5511220003';
  const roleTestPhone = '5511220004';

  const customerData = (n: string) => ({
    nombres: n,
    apellidos: 'Seguridad',
    aval: 'Aval Seguridad',
    avalPhone: '5500110022',
    calle: 'Calle',
    numero: '1',
    colonia: 'Col',
    cp: '06000',
    ciudad: 'CDMX',
    estado: 'CDMX',
    referencias: 'Ref',
  });

  async function loginAs(phone: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password });
    return res.body.accessToken;
  }

  async function createSubmittedLoan(token: string): Promise<string> {
    const loan = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1000, model: 'WEEKLY', openingDate: '2026-08-21' });
    return loan.body.id;
  }

  beforeAll(async () => {
    const setupModule: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = setupModule.createNestApplication();
    await setupApp.init();
    prisma = setupModule.get(PrismaService);
    for (const phone of [
      bruteForcePhone,
      clientAPhone,
      clientBPhone,
      roleTestPhone,
    ]) {
      await prisma.user.deleteMany({ where: { phone } });
    }
    await setupApp.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    for (const phone of [
      bruteForcePhone,
      clientAPhone,
      clientBPhone,
      roleTestPhone,
    ]) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ phone, password: 'Abcdef12!' });
    }
  });

  afterAll(async () => {
    for (const phone of [
      bruteForcePhone,
      clientAPhone,
      clientBPhone,
      roleTestPhone,
    ]) {
      await prisma.user.deleteMany({ where: { phone } });
    }
    await app.close();
  });

  describe('Fuerza bruta', () => {
    it('bloquea la cuenta tras 5 intentos fallidos, incluso con la contraseña correcta', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ phone: bruteForcePhone, password: 'Incorrecta1' })
          .expect(401);
      }

      const user = await prisma.user.findUnique({
        where: { phone: bruteForcePhone },
      });
      expect(user?.status).toBe('BLOCKED');
      expect(user?.blockedUntil).not.toBeNull();

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: bruteForcePhone, password: 'Abcdef12!' })
        .expect(401);
    });
  });

  describe('Manipulación de roles y tokens', () => {
    it('el access token no incluye el rol como claim — no hay nada que manipular ahí', async () => {
      const token = await loginAs(roleTestPhone, 'Abcdef12!');
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
      expect(payload.role).toBeUndefined();
      expect(payload.sub).toBe(roleTestPhone);
    });

    it('un token con la firma alterada es rechazado', async () => {
      const token = await loginAs(roleTestPhone, 'Abcdef12!');
      const tampered = token.slice(0, -4) + 'xxxx';
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });

    it('el rol se revisa en la base de datos en cada request, no queda fijo en el token', async () => {
      const token = await loginAs(roleTestPhone, 'Abcdef12!');

      // con rol CLIENT, un endpoint solo-ADMIN debe rechazar
      await request(app.getHttpServer())
        .get('/api/v1/admin/loans')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // se promueve el usuario a ADMIN directo en BD (sin reemitir el token)
      await prisma.user.update({
        where: { phone: roleTestPhone },
        data: { role: 'ADMIN' },
      });

      // el MISMO access token ya emitido ahora sí pasa — el guard re-consulta el rol
      await request(app.getHttpServer())
        .get('/api/v1/admin/loans')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // se revierte y el mismo token vuelve a perder acceso al instante
      await prisma.user.update({
        where: { phone: roleTestPhone },
        data: { role: 'CLIENT' },
      });
      await request(app.getHttpServer())
        .get('/api/v1/admin/loans')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Acceso a recursos ajenos (ownership)', () => {
    it('un cliente no puede ver el préstamo de otro cliente', async () => {
      const tokenA = await loginAs(clientAPhone, 'Abcdef12!');
      const tokenB = await loginAs(clientBPhone, 'Abcdef12!');

      await request(app.getHttpServer())
        .patch('/api/v1/customers/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(customerData('Cliente A'))
        .expect(200);

      const loanId = await createSubmittedLoan(tokenA);

      await request(app.getHttpServer())
        .get(`/api/v1/loans/${loanId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('un cliente no puede pedir la URL firmada de un documento ajeno', async () => {
      const tokenA = await loginAs(clientAPhone, 'Abcdef12!');
      const tokenB = await loginAs(clientBPhone, 'Abcdef12!');

      const png =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const upload = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('type', 'INE_FRONT')
        .attach('file', Buffer.from(png, 'base64'), 'ine.png')
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/documents/${upload.body.id}/signed-url`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });
});
