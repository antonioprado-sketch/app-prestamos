import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { nextWeeklyOpeningDate } from './test-helpers';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const VALID_SIGNATURE = `data:image/png;base64,${TINY_PNG_BASE64}`;

describe('Pagaré (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clientPhone = '5511229900';
  let loanId: string;

  const customerData = {
    nombres: 'Ana',
    apellidos: 'Torres',
    aval: 'Luis Torres',
    avalPhone: '5522334455',
    calle: 'Juárez',
    numero: '10',
    colonia: 'Centro',
    cp: '06000',
    ciudad: 'CDMX',
    estado: 'CDMX',
    referencias: 'Casa blanca',
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

    const token = await loginClient();
    const loan = await request(app.getHttpServer())
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 1000,
        model: 'WEEKLY',
        openingDate: nextWeeklyOpeningDate(),
      });
    loanId = loan.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: clientPhone } });
    await app.close();
  });

  it('rechaza firmar sin token', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Ana Torres' })
      .expect(401);
  });

  it('rechaza firmar antes de completar el onboarding', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${token}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Ana Torres' })
      .expect(400);
  });

  it('rechaza una firma que no es un data URL PNG', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${token}`)
      .send({ signature: 'no-es-una-firma', fullName: 'Ana Torres' })
      .expect(400);
  });

  it('firma el pagaré una vez completado el onboarding y pasa el préstamo a SUBMITTED', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`)
      .send(customerData)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${token}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Ana Torres' })
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.documentId).toBeDefined();

    const loan = await request(app.getHttpServer())
      .get(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(loan.body.status).toBe('SUBMITTED');

    const documents = await request(app.getHttpServer())
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(
      documents.body.some((d: { type: string }) => d.type === 'PAGARE'),
    ).toBe(true);
  });

  it('rechaza firmar de nuevo un préstamo que ya no está en DRAFT', async () => {
    const token = await loginClient();
    await request(app.getHttpServer())
      .post(`/api/v1/loans/${loanId}/pagare`)
      .set('Authorization', `Bearer ${token}`)
      .send({ signature: VALID_SIGNATURE, fullName: 'Ana Torres' })
      .expect(409);
  });
});
