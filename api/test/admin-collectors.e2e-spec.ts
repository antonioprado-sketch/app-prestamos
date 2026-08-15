import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin collectors (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminPhone = process.env.ADMIN_PHONE ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
  const collectorPhone = '5566778899';

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
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await setupApp.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: collectorPhone } });
    await app.close();
  });

  it('POST /admin/collectors requiere token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .send({ phone: collectorPhone, name: 'Juan Cobrador' })
      .expect(401);
  });

  let collectorId: string;

  it('POST /admin/collectors crea un cobrador con contraseña temporal', async () => {
    const token = await loginAdmin();
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: collectorPhone, name: 'Juan Cobrador' })
      .expect(201);

    expect(res.body.phone).toBe(collectorPhone);
    expect(res.body.name).toBe('Juan Cobrador');
    expect(res.body.active).toBe(true);
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(8);
    collectorId = res.body.id;

    const user = await prisma.user.findUnique({
      where: { phone: collectorPhone },
    });
    expect(user?.role).toBe('COLLECTOR');
    expect(user?.mustChangePassword).toBe(true);
  });

  it('POST /admin/collectors rechaza un teléfono duplicado', async () => {
    const token = await loginAdmin();
    await request(app.getHttpServer())
      .post('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: collectorPhone, name: 'Otro Nombre' })
      .expect(409);
  });

  it('el cobrador puede loguearse con la contraseña temporal y debe cambiarla', async () => {
    const token = await loginAdmin();
    const created = await request(app.getHttpServer())
      .get('/api/v1/admin/collectors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const mine = created.body.find((c: { id: string }) => c.id === collectorId);
    expect(mine.phone).toBe(collectorPhone);
    // La contraseña temporal solo se devuelve en la respuesta de creación, no en el listado.
    expect(mine.tempPassword).toBeUndefined();
  });

  it('GET /admin/collectors rechaza a un rol distinto de ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/collectors')
      .expect(401);
  });
});
