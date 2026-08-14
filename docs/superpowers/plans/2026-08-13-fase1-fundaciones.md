# Fase 1 — Fundaciones: Implementación Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establecer la base del proyecto: estructura del repo, entorno Docker Compose (dev/prod), backend NestJS con autenticación y RBAC, esquema Prisma/MySQL, frontend PWA con Design System, y CI.

**Architecture:** Modular Monolith. API REST NestJS (`api/`), frontend PWA React+Vite multi-rol (`web/`), MySQL 8 como fuente de verdad, MinIO para almacenamiento (se levanta pero no se usa hasta Fase 2), Nginx como proxy. Worker de jobs se crea en Fase 2; en esta fase solo existe el servicio base de salud.

**Tech Stack:** NestJS 10 + TypeScript + Prisma 5 + MySQL 8 (Docker) · Argon2id · JWT (access 15min + refresh rotativo en BD) · React 18 + Vite 5 + Tailwind 3.4 + vite-plugin-pwa · Nginx · nodemailer (Gmail SMTP App Password).

## Global Constraints

- Dinero: siempre `DECIMAL(10,2)`; nunca float (aplica a partir de Fase 2, pero el schema ya lo define).
- Teléfono = llave primaria de `users` (VARCHAR(15)); NO existe flujo de cambio de número.
- Contraseña: mínimo 8, máximo 64, símbolos permitidos, al menos 1 mayúscula y 1 número.
- Hash de contraseñas: Argon2id (nunca bcrypt/plain).
- Credenciales y secrets SOLO en `.env` (gitignored). Existe `.env.example` con placeholders.
- Admin inicial desde `.env` (`ADMIN_PHONE=admin`, `ADMIN_PASSWORD=admin` por defecto) con `must_change_password=true`; el cambio es obligatorio en el primer login.
- Solo dos entornos: **dev** y **prod** (`docker-compose.dev.yml` / `docker-compose.prod.yml`).
- Correos vía Gmail SMTP con App Password (`GMAIL_USER`, `GMAIL_APP_PASSWORD`); si no están configurados, el módulo de correo solo registra en log (no falla).
- Zona horaria: `America/Mexico_City` en MySQL y backend.
- Idioma de la UI: español (MX), moneda MXN (`$`).
- No exponer secrets, contraseñas ni datos sensibles en logs ni en respuestas de API.
- Todo cambio con commit pequeño y mensaje convencional (`feat:`, `fix:`, `chore:`).
- API versionada bajo `/api/v1`.

---

### Task 1: Scaffolding del repositorio

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `docs/architecture.md` (enlace al spec)
- Create: `docker/mysql/init.sql`

**Interfaces:**
- Consumes: nada (repo vacío)
- Produces: estructura de carpetas raíz; convención `.env` → variable que leen las Tasks 2-7

- [ ] **Step 1: Crear estructura raíz y archivos base**

```bash
mkdir api web docker docker/mysql docker/nginx scripts
```

Crear `.gitignore`:

```gitignore
node_modules/
dist/
build/
.env
.env.local
*.log
coverage/
.DS_Store
.idea/
docker/mysql/data/
minio-data/
```

Crear `.env.example` (contenido exacto — servir de plantilla):

```bash
# --- MySQL ---
MYSQL_DATABASE=appprestamos
MYSQL_USER=prestamos
MYSQL_PASSWORD=cambia-esto
MYSQL_ROOT_PASSWORD=cambia-esto-root

# --- API ---
API_PORT=3000
JWT_ACCESS_SECRET=cambia-esto-access
JWT_REFRESH_SECRET=cambia-esto-refresh
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
ADMIN_PHONE=admin
ADMIN_PASSWORD=admin
TZ=America/Mexico_City

# --- Email (Gmail SMTP) ---
GMAIL_USER=
GMAIL_APP_PASSWORD=

# --- MinIO ---
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=documentos
```

- [ ] **Step 2: Copiar `.env.example` a `.env` para desarrollo local**

```bash
Copy-Item .env.example .env
```

(En Windows; en Ubuntu/Linux: `cp .env.example .env`)

- [ ] **Step 3: Crear `README.md`**

```markdown
# AppPrestamitos

Plataforma web de préstamos (cliente / cobrador / administrador). Mobile-first, PWA.

## Entornos
- **dev**: `docker compose -f docker-compose.dev.yml up`
- **prod**: `docker compose -f docker-compose.prod.yml up`

## Configuración
Copiar `.env.example` a `.env` y completar credenciales (MySQL, JWT, Gmail SMTP).

## Documentación
- Diseño y arquitectura: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`
- API: `http://localhost:3000/api/v1/docs` (Swagger, solo en dev)
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffolding del repositorio y configuración base"
```

---

### Task 2: Docker Compose — entorno dev y prod

**Files:**
- Create: `docker-compose.dev.yml`
- Create: `docker-compose.prod.yml`
- Create: `docker/mysql/init.sql`
- Create: `docker/nginx/nginx.dev.conf`
- Create: `docker/nginx/nginx.prod.conf`
- Create: `Dockerfile.api`
- Create: `Dockerfile.web`

**Interfaces:**
- Consumes: `.env` (Task 1)
- Produces: servicios `mysql` (puerto 3306, host `mysql`, usuario/db de `.env`), `minio` (host `minio`, puertos 9000/9001), `api` (host `api`, puerto 3000), `worker` (host `worker`), `nginx` (puerto 80). Nombres de red: `appnet`.

- [ ] **Step 1: Crear `docker-compose.dev.yml`**

```yaml
name: appprestamos-dev

services:
  mysql:
    image: mysql:8.4
    container_name: appprestamos-mysql
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      TZ: ${TZ}
    command: --default-time-zone=America/Mexico_City --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    container_name: appprestamos-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: dev
    container_name: appprestamos-api
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      NODE_ENV: development
      MINIO_ENDPOINT: minio
    ports:
      - "3000:3000"
    volumes:
      - ./api:/app
    depends_on:
      mysql:
        condition: service_healthy
      minio:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: dev
    container_name: appprestamos-worker
    restart: unless-stopped
    command: ["node", "dist/src/main-worker.js"]
    env_file: .env
    environment:
      DATABASE_URL: mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      NODE_ENV: development
    volumes:
      - ./api:/app
    depends_on:
      mysql:
        condition: service_healthy

  nginx:
    image: nginx:1.27-alpine
    container_name: appprestamos-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx/nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro
      - ./web/dist:/usr/share/nginx/html:ro
    depends_on:
      - api

volumes:
  mysql_data:
  minio_data:
```

- [ ] **Step 2: Crear `docker-compose.prod.yml`**

Igual que dev pero: build target `prod`, Nginx con `nginx.prod.conf` (con configuración de certificados Let's Encrypt comentada — se habilita en Fase 8), sin puertos MySQL/MinIO expuestos al host (solo red interna), `restart: always`, y límites de recursos:

```yaml
    deploy:
      resources:
        limits:
          memory: 512M
```

(El servicio `api` en prod: `target: prod`, sin volumen montado, `command` no necesario porque la imagen compila.)

- [ ] **Step 3: Crear `docker/mysql/init.sql`**

```sql
-- Tablas de negocio las crea Prisma (migraciones).
-- Aquí solo se configura la zona horaria del server.
SET GLOBAL time_zone = 'America/Mexico_City';
```

- [ ] **Step 4: Crear Dockerfiles**

`Dockerfile.api` (multi-stage; dev y prod):

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY api/package*.json ./
RUN npm ci

FROM base AS dev
COPY api/ .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM base AS build
COPY api/ .
RUN npm run build

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
```

`Dockerfile.web`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 5: Crear configs de Nginx**

`docker/nginx/nginx.dev.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`docker/nginx/nginx.prod.conf`: igual, con `gzip on;` y `location /assets/ { expires 1y; }` (la parte TLS se agrega en Fase 8).

- [ ] **Step 6: Commit**

```bash
git add docker-compose.dev.yml docker-compose.prod.yml Dockerfile.api Dockerfile.web docker/
git commit -m "feat(docker): entornos dev/prod con mysql, minio, api, worker y nginx"
```

---

### Task 3: Backend NestJS — bootstrap y salud

**Files:**
- Create: `api/` (proyecto NestJS completo)
- Create: `api/src/main.ts`
- Create: `api/src/app.module.ts`
- Create: `api/src/health/health.controller.ts`
- Create: `api/src/health/health.module.ts`
- Create: `api/src/prisma/prisma.service.ts`, `api/src/prisma/prisma.module.ts`
- Create: `api/src/common/filters/http-exception.filter.ts`
- Create: `api/src/common/pipes/validation.pipe.ts`
- Create: `api/test/health.e2e-spec.ts`
- Create: `api/.env.test.example`

**Interfaces:**
- Consumes: `.env` (DATABASE_URL via Prisma), MySQL del compose (Task 2)
- Produces: `AppModule` (raíz), `PrismaService` (exportado globalmente), `GET /api/v1/health` y `GET /api/v1/health/ready`, manejo global de errores, validación global de DTOs.

- [ ] **Step 1: Generar proyecto NestJS**

```bash
npx @nestjs/cli@10 new api --package-manager npm --skip-git
cd api
npm i @nestjs/config @nestjs/jwt @nestjs/throttler argon2 pino-http nestjs-pino class-validator class-transformer helmet nodemailer
npm i -D prisma @types/nodemailer
npm i @prisma/client
npx prisma init --datasource-provider mysql
```

- [ ] **Step 2: Escribir la prueba de salud que falla**

`api/test/health.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it('GET /api/v1/health → 200 ok', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/v1/health/ready → 200 cuando MySQL responde', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);
    expect(res.body.db).toBe('up');
  });
});
```

- [ ] **Step 3: Ejecutar la prueba para verla fallar**

```bash
cd api && npx jest test/health.e2e-spec.ts
```

Expected: FAIL (AppModule no existe / no hay rutas).

- [ ] **Step 4: Implementar módulo de salud y PrismaService**

`api/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`api/src/prisma/prisma.module.ts` (global):

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

`api/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'error', db: 'down' };
    }
  }
}
```

- [ ] **Step 5: Configurar `main.ts` (helmet, CORS, validación, throttle, pino, Swagger en dev)**

`api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost'], credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AppPrestamitos API')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

`api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({ pinoHttp: { level: 'info', transport: { target: 'pino-pretty' } } }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Ejecutar las pruebas**

```bash
cd api && npx jest test/health.e2e-spec.ts
```

Expected: PASS (con MySQL levantado vía `docker compose -f docker-compose.dev.yml up -d mysql`).

- [ ] **Step 7: Commit**

```bash
git add api/
git commit -m "feat(api): bootstrap NestJS con salud, validación, logging y seguridad base"
```

---

### Task 4: Esquema Prisma — tablas núcleo

**Files:**
- Create/Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/seed.ts`
- Create: `api/prisma/migrations/*` (generadas)

**Interfaces:**
- Consumes: PrismaService (Task 3)
- Produces: modelos `User`, `RefreshToken`, `Customer`, `Collector`, `Admin`, `AuditLog`, `Configuration`; `DATABASE_URL` leído de `.env`.

- [ ] **Step 1: Escribir el esquema**

`api/prisma/schema.prisma` (contenido completo):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  phone              String   @id @db.VarChar(15)
  email              String?  @unique @db.VarChar(190)
  passwordHash       String   @map("password_hash") @db.VarChar(255)
  role               Role     @default(CLIENT)
  status             UserStatus @default(ACTIVE)
  mustChangePassword Boolean  @default(false) @map("must_change_password")
  failedAttempts     Int      @default(0) @map("failed_attempts")
  blockedUntil       DateTime? @map("blocked_until") @db.DateTime(6)
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  customer    Customer?
  collector   Collector?
  admin       Admin?
  refreshTokens RefreshToken[]
  auditLogs   AuditLog[]

  @@map("users")
}

model RefreshToken {
  id        BigInt   @id @default(autoincrement())
  userPhone String   @map("user_phone") @db.VarChar(15)
  tokenHash String   @unique @map("token_hash") @db.VarChar(64)
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  ip        String?  @db.VarChar(45)
  userAgent String?  @map("user_agent") @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userPhone], references: [phone], onDelete: Cascade)

  @@index([userPhone])
  @@map("refresh_tokens")
}

model Customer {
  phone              String   @id @db.VarChar(15)
  nombres            String?  @db.VarChar(25)
  apellidos          String?  @db.VarChar(35)
  aval               String?  @db.VarChar(70)
  avalPhone          String?  @map("aval_phone") @db.VarChar(15)
  email              String?  @db.VarChar(190)
  calle              String?
  numero             String?
  colonia            String?
  cp                 String?  @db.VarChar(5)
  ciudad             String?
  estado             String?
  referencias        String?  @db.VarChar(255)
  isNewCustomer      Boolean  @default(false) @map("is_new_customer")
  onboardingComplete Boolean  @default(false) @map("onboarding_complete")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [phone], references: [phone], onDelete: Cascade)

  @@map("customers")
}

model Collector {
  id        BigInt  @id @default(autoincrement())
  phone     String  @unique @db.VarChar(15)
  name      String  @db.VarChar(70)
  active    Boolean @default(true)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [phone], references: [phone], onDelete: Cascade)

  @@map("collectors")
}

model Admin {
  id        BigInt  @id @default(autoincrement())
  phone     String  @unique @db.VarChar(15)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [phone], references: [phone], onDelete: Cascade)

  @@map("admins")
}

model AuditLog {
  id        BigInt   @id @default(autoincrement())
  userPhone String?  @map("user_phone") @db.VarChar(15)
  action    String   @db.VarChar(100)
  entity    String   @db.VarChar(100)
  entityId  String?  @map("entity_id") @db.VarChar(100)
  prevValue Json?    @map("prev_value")
  newValue  Json?    @map("new_value")
  ip        String?  @db.VarChar(45)
  userAgent String?  @map("user_agent") @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userPhone])
  @@index([entity, entityId])
  @@map("audit_logs")
}

model Configuration {
  key       String   @id @db.VarChar(100)
  value     Json
  updatedBy String?  @map("updated_by") @db.VarChar(15)
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("configuration")
}

enum Role {
  CLIENT
  COLLECTOR
  ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}
```

- [ ] **Step 2: Migración y cliente Prisma**

```bash
cd api
# DATABASE_URL en .env para dev local (mysql://prestamos:<pass>@localhost:3306/appprestamos)
npx prisma migrate dev --name init
npx prisma generate
```

- [ ] **Step 3: Verificar que migración aplica**

```bash
npx prisma migrate status
```

Expected: "Database schema is up to date!"

- [ ] **Step 4: Commit**

```bash
git add api/prisma
git commit -m "feat(db): esquema Prisma núcleo (users, customers, collectors, admins, audit, config)"
```

---

### Task 5: Autenticación — register, login, refresh, logout, cambio de contraseña

**Files:**
- Create: `api/src/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`
- Create: `api/src/auth/dto/register.dto.ts`, `login.dto.ts`, `refresh.dto.ts`, `change-password.dto.ts`
- Create: `api/src/auth/tokens.service.ts` (generación/rotación de refresh en BD)
- Create: `api/src/auth/password.policy.ts` (validador de política de contraseña)
- Create: `api/src/auth/password-validator.spec.ts`
- Create: `api/src/common/guards/jwt-auth.guard.ts`, `api/src/common/guards/roles.guard.ts`
- Create: `api/src/common/decorators/roles.decorator.ts`, `api/src/common/decorators/current-user.decorator.ts`
- Create: `api/src/email/email.module.ts`, `email.service.ts` (nodemailer Gmail SMTP)
- Test: `api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `User`/`RefreshToken` modelos (Task 4)
- Produces:
  - `POST /api/v1/auth/register` → `201 {user}` (crea User CLIENT + Customer)
  - `POST /api/v1/auth/login` → `200 {accessToken, refreshToken, user, mustChangePassword}`
  - `POST /api/v1/auth/refresh` → `200 {accessToken, refreshToken}` (rota)
  - `POST /api/v1/auth/logout` → `204`
  - `POST /api/v1/auth/change-password` → `200` (autenticado; limpia `mustChangePassword`, revoca demás refresh tokens)
  - `POST /api/v1/auth/forgot-password` → `202` (envía código de 6 dígitos por email)
  - `POST /api/v1/auth/reset-password` → `200` (código + nueva contraseña)
  - `GET /api/v1/auth/me` → `200 {user, customer}` (protegido)
  - Decoradores `@Roles(...)` y guard `JwtAuthGuard`/`RolesGuard` usados por Tasks posteriores.
  - `EmailService.send(to, subject, html)` (si SMTP no configurado → solo log)

- [ ] **Step 1: Escribir las pruebas unitarias de política de contraseña (fallan)**

`api/src/auth/password-validator.spec.ts`:

```typescript
import { validatePassword } from './password.policy';

describe('validatePassword', () => {
  it('acepta una contraseña válida', () => {
    expect(validatePassword('Abcdef12!')).toBeNull();
  });
  it('rechaza menor a 8 caracteres', () => {
    expect(validatePassword('Abc12!x')).toContain('mínimo 8');
  });
  it('rechaza mayor a 64', () => {
    expect(validatePassword('A'.repeat(65) + 'a1!')).toContain('máximo 64');
  });
  it('rechaza sin mayúscula', () => {
    expect(validatePassword('abcdef12!')).toContain('mayúscula');
  });
  it('rechaza sin número', () => {
    expect(validatePassword('Abcdefgh!')).toContain('número');
  });
  it('permite símbolos', () => {
    expect(validatePassword('Abcdef12!@#$')).toBeNull();
  });
});
```

`api/src/auth/password.policy.ts`:

```typescript
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener mínimo 8 caracteres';
  if (password.length > 64) return 'La contraseña debe tener máximo 64 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula';
  if (!/[a-z]/.test(password)) return 'La contraseña debe tener al menos una minúscula';
  if (!/\d/.test(password)) return 'La contraseña debe tener al menos un número';
  return null;
}
```

- [ ] **Step 2: Ejecutar la prueba (falla porque el archivo no existe)**

```bash
cd api && npx jest src/auth/password-validator.spec.ts
```

- [ ] **Step 3: Ejecutar y ver pasar**

```bash
cd api && npx jest src/auth/password-validator.spec.ts
```

Expected: 6 PASS.

- [ ] **Step 4: Implementar TokensService**

`api/src/auth/tokens.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(phone: string, ip?: string, userAgent?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: phone },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    );
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
    await this.prisma.refreshToken.create({
      data: { userPhone: phone, tokenHash, expiresAt: new Date(Date.now() + days * 86400000), ip, userAgent },
    });
    return { accessToken, refreshToken: raw };
  }

  async rotate(raw: string, ip?: string, userAgent?: string) {
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return this.issue(record.userPhone, ip, userAgent);
  }

  async revoke(raw: string) {
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(phone: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userPhone: phone, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: Implementar AuthService**

`api/src/auth/auth.service.ts` (parte esencial):

```typescript
import { ConflictException, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';
import { validatePassword } from './password.policy';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async register(dto: { phone: string; email?: string; password: string }, ip: string, ua: string) {
    const policyError = validatePassword(dto.password);
    if (policyError) throw new BadRequestException(policyError);
    const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (exists) throw new ConflictException('El teléfono ya está registrado');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { phone: dto.phone, email: dto.email, passwordHash, role: 'CLIENT', customer: { create: {} } },
    });
    await this.audit.log({ userPhone: dto.phone, action: 'register', entity: 'user', entityId: dto.phone, ip, userAgent: ua });
    return { user: { phone: user.phone, email: user.email, role: user.role } };
  }

  async login(phone: string, password: string, ip: string, ua: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new UnauthorizedException('Teléfono o contraseña incorrectos');
    if (user.status === 'BLOCKED') throw new UnauthorizedException('Cuenta bloqueada temporalmente');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const attempts = user.failedAttempts + 1;
      const blockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60000) : null;
      await this.prisma.user.update({
        where: { phone },
        data: { failedAttempts: attempts, blockedUntil, status: blockedUntil ? 'BLOCKED' : user.status },
      });
      throw new UnauthorizedException('Teléfono o contraseña incorrectos');
    }
    await this.prisma.user.update({ where: { phone }, data: { failedAttempts: 0, blockedUntil: null, status: 'ACTIVE' } });
    const { accessToken, refreshToken } = await this.tokens.issue(phone, ip, ua);
    await this.audit.log({ userPhone: phone, action: 'login', entity: 'user', entityId: phone, ip, userAgent: ua });
    return { accessToken, refreshToken, mustChangePassword: user.mustChangePassword, user: this.publicUser(user) };
  }

  async changePassword(phone: string, current: string, next: string, ip: string, ua: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !(await argon2.verify(user.passwordHash, current))) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }
    const policyError = validatePassword(next);
    if (policyError) throw new BadRequestException(policyError);
    if (await argon2.verify(user.passwordHash, next)) throw new BadRequestException('La nueva contraseña debe ser diferente');
    const passwordHash = await argon2.hash(next, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { phone }, data: { passwordHash, mustChangePassword: false } });
    await this.tokens.revokeAllForUser(phone);
    await this.audit.log({ userPhone: phone, action: 'change_password', entity: 'user', entityId: phone, ip, userAgent: ua });
    return this.tokens.issue(phone, ip, ua);
  }

  async forgotPassword(phone: string, ip: string, ua: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) return; // no revelar existencia
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.configuration.upsert({
      where: { key: `reset_code:${phone}` },
      create: { key: `reset_code:${phone}`, value: { code, expiresAt: Date.now() + 15 * 60000 } },
      update: { value: { code, expiresAt: Date.now() + 15 * 60000 } },
    });
    if (user.email) await this.email.send(user.email, 'Código de recuperación', `Tu código es <b>${code}</b>. Vence en 15 minutos.`);
    await this.audit.log({ userPhone: phone, action: 'forgot_password', entity: 'user', entityId: phone, ip, userAgent: ua });
  }

  async resetPassword(phone: string, code: string, next: string, ip: string, ua: string) {
    const cfg = await this.prisma.configuration.findUnique({ where: { key: `reset_code:${phone}` } });
    const data = cfg?.value as { code: string; expiresAt: number } | null;
    if (!data || data.code !== code || data.expiresAt < Date.now()) {
      throw new BadRequestException('Código inválido o expirado');
    }
    const policyError = validatePassword(next);
    if (policyError) throw new BadRequestException(policyError);
    const passwordHash = await argon2.hash(next, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { phone }, data: { passwordHash, mustChangePassword: false } });
    await this.prisma.configuration.delete({ where: { key: `reset_code:${phone}` } }).catch(() => undefined);
    await this.tokens.revokeAllForUser(phone);
    await this.audit.log({ userPhone: phone, action: 'reset_password', entity: 'user', entityId: phone, ip, userAgent: ua });
    return { ok: true };
  }

  private publicUser(u: { phone: string; email: string | null; role: string; mustChangePassword: boolean }) {
    return { phone: u.phone, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword };
  }
}
```

(En el AuthController: decoradores `@HttpCode`, DTOs con class-validator — `@IsString @Matches(/^[0-9]{10,15}$/)` en phone, `@IsEmail()` en email, `@IsString()` en password. El guard JWT usa `verifyAsync` con `JWT_ACCESS_SECRET` y extrae `sub` como `req.user = { phone }`.)

- [ ] **Step 6: EmailService con Gmail SMTP (fallback a log)**

`api/src/email/email.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
      });
    }
  }

  async send(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.log(`[email-simulado] to=${to} subject=${subject} html=${html}`);
      return { simulated: true };
    }
    return this.transporter.sendMail({ from: process.env.GMAIL_USER, to, subject, html });
  }
}
```

- [ ] **Step 7: Escribir prueba de integración de auth**

`api/test/auth.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const phone = '5512345678';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

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

  it('GET /auth/me requiere token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
```

- [ ] **Step 8: Ejecutar pruebas de integración**

```bash
cd api && npx jest test/auth.e2e-spec.ts --runInBand
```

Expected: 6 PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/auth api/src/email api/src/common/guards api/src/common/decorators api/test/auth.e2e-spec.ts
git commit -m "feat(auth): registro, login, refresh rotativo, logout y cambio de contraseña con Argon2id"
```

---

### Task 6: Bootstrap del administrador + Auditoría

**Files:**
- Create: `api/src/audit/audit.module.ts`, `audit.service.ts`
- Create: `api/src/admin-bootstrap/admin-bootstrap.module.ts`, `admin-bootstrap.service.ts`
- Test: `api/test/admin-bootstrap.e2e-spec.ts`

**Interfaces:**
- Consumes: `User` modelo, `.env` (`ADMIN_PHONE`, `ADMIN_PASSWORD`)
- Produces: `AuditService.log({...})` (global); en cada arranque garantiza el admin inicial con `mustChangePassword=true`; `POST /api/v1/admin/bootstrap` no existe — el arranque es automático.

- [ ] **Step 1: Implementar AuditService**

`api/src/audit/audit.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(args: {
    userPhone?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    prevValue?: unknown;
    newValue?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userPhone: args.userPhone ?? null,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId ?? null,
        prevValue: args.prevValue === undefined ? undefined : (args.prevValue as object),
        newValue: args.newValue === undefined ? undefined : (args.newValue as object),
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
      },
    });
  }
}
```

`api/src/audit/audit.module.ts`: `@Global()` con provider/export de `AuditService`.

- [ ] **Step 2: Implementar AdminBootstrapService**

`api/src/admin-bootstrap/admin-bootstrap.service.ts`:

```typescript
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const phone = process.env.ADMIN_PHONE ?? 'admin';
    const password = process.env.ADMIN_PASSWORD ?? 'admin';
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) return;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.user.create({
      data: {
        phone,
        passwordHash,
        role: 'ADMIN',
        mustChangePassword: true,
        admin: { create: {} },
      },
    });
    this.logger.log(`Admin inicial creado: ${phone} (debe cambiar contraseña al entrar)`);
  }
}
```

- [ ] **Step 3: Prueba de integración del bootstrap**

`api/test/admin-bootstrap.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Admin bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.ADMIN_PHONE = 'admin';
    process.env.ADMIN_PASSWORD = 'admin';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it('el admin inicial entra con mustChangePassword=true', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: 'admin', password: 'admin' })
      .expect(200);
    expect(res.body.mustChangePassword).toBe(true);
    expect(res.body.user.role).toBe('ADMIN');
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
    expect(me.body.mustChangePassword).toBe(false);
  });
});
```

- [ ] **Step 4: Ejecutar las pruebas**

```bash
cd api && npx jest test/admin-bootstrap.e2e-spec.ts --runInBand
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/audit api/src/admin-bootstrap api/test/admin-bootstrap.e2e-spec.ts
git commit -m "feat(auth): bootstrap del admin inicial y módulo de auditoría"
```

---

### Task 7: Frontend — scaffold PWA + Design System

**Files:**
- Create: `web/` (Vite + React + TS)
- Create: `web/src/styles/tokens.css` (Design System)
- Create: `web/src/components/ui/Button.tsx`, `Input.tsx`, `Card.tsx`, `Alert.tsx`, `Spinner.tsx`
- Create: `web/src/lib/api.ts` (cliente fetch con interceptor de refresh)
- Create: `web/vite.config.ts` (proxy /api → localhost:3000, plugin PWA)
- Create: `web/public/manifest.webmanifest`, iconos PWA
- Test: `web/src/components/ui/Button.test.tsx` (Vitest + Testing Library)

**Interfaces:**
- Consumes: API `POST /auth/login`, `POST /auth/change-password`, `GET /auth/me`
- Produces: `apiFetch(path, options)` con token; componentes `Button`, `Input`, `Card`, `Alert`, `Spinner`; tokens CSS.

- [ ] **Step 1: Crear el proyecto Vite**

```bash
npm create vite@latest web -- --template react-ts
cd web
npm i tailwindcss@3.4 postcss autoprefixer axios react-router-dom
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
npm i -D vite-plugin-pwa
```

- [ ] **Step 2: Configurar Tailwind con tokens del Design System**

`web/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0F8B5F', dark: '#0A6B49', light: '#E6F4EE' },
        secondary: { DEFAULT: '#1B2A4A', dark: '#121D35' },
        success: '#1A9E63',
        warning: '#F5A623',
        danger: '#D64545',
        score: { red: '#D64545', orange: '#F2802A', yellow: '#F5A623', green: '#1A9E63' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: { 4.5: '1.125rem' },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
```

`web/src/index.css` (base del Design System):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { @apply text-secondary antialiased; }
  body { @apply bg-gray-50 font-sans; }
  button, a { @apply touch-manipulation; }
}
```

- [ ] **Step 3: Componentes base con prueba**

`web/src/components/ui/Button.tsx`:

```tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...rest }: Props) {
  const base = 'min-h-11 rounded-xl px-4 py-2.5 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50';
  const variants: Record<Variant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-secondary text-white hover:bg-secondary-dark',
    ghost: 'bg-transparent text-primary hover:bg-primary-light',
    danger: 'bg-danger text-white hover:bg-danger/90',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <span aria-hidden>…</span> : children}
    </button>
  );
}
```

`web/src/components/ui/Button.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renderiza el texto', () => {
    render(<Button>Entrar</Button>);
    expect(screen.getByText('Entrar')).toBeTruthy();
  });
  it('se deshabilita cuando loading', () => {
    render(<Button loading>Entrar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

Ejecutar: `cd web && npx vitest run` → 2 PASS.

Crear también `Input.tsx` (label + input con `min-h-11`, borde, focus ring), `Card.tsx`, `Alert.tsx` (variantes success/error/warning), `Spinner.tsx` (animación border) — componentes pequeños análogos, sin prueba individual (se cubren en pruebas E2E posteriores).

- [ ] **Step 4: Cliente API con refresh automático**

`web/src/lib/api.ts`:

```typescript
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let accessToken: string | null = localStorage.getItem('accessToken');

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

async function refreshTokens() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new ApiError(401, 'Sin sesión');
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new ApiError(401, 'Sesión expirada');
  const data = await res.json();
  setAccessToken(data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const doFetch = (token?: string) =>
    fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

  let res = await doFetch(accessToken ?? undefined);
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const refreshed = await refreshTokens().catch(() => null);
    if (!refreshed) throw new ApiError(401, 'Sesión expirada');
    res = await doFetch(accessToken ?? undefined);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? 'Error de servidor');
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 5: Configurar PWA**

`web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false,
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: { environment: 'jsdom', globals: true },
});
```

`web/public/manifest.webmanifest`:

```json
{
  "name": "Prestamitos",
  "short_name": "Prestamitos",
  "description": "Plataforma de préstamos",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#0F8B5F",
  "lang": "es",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

(Iconos: generar `icon-192.png` y `icon-512.png` simples, fondo `#0F8B5F` con la letra "P" blanca — se pueden crear con cualquier herramienta; commitear los PNG.)

- [ ] **Step 6: Construir y verificar**

```bash
cd web && npm run build
```

Expected: build exitoso con service worker generado (`dist/sw.js`).

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold PWA con Design System, cliente API y componentes base"
```

---

### Task 8: Frontend — pantallas de autenticación

**Files:**
- Create: `web/src/main.tsx` (router)
- Create: `web/src/App.tsx` (rutas protegidas por rol)
- Create: `web/src/pages/LoginPage.tsx`
- Create: `web/src/pages/RegisterPage.tsx`
- Create: `web/src/pages/ChangePasswordPage.tsx`
- Create: `web/src/pages/dashboard/DashboardShell.tsx` (placeholder multi-rol)
- Create: `web/src/store/auth.tsx` (contexto de sesión)
- Test: `web/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `setAccessToken` (Task 7), API auth
- Produces: rutas `/login`, `/register`, `/change-password`, `/app/*` (protegida); `useAuth()` con `user`, `login`, `logout`, `changePassword`.

- [ ] **Step 1: Contexto de sesión**

`web/src/store/auth.tsx`:

```tsx
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { apiFetch, setAccessToken } from '../lib/api';

interface AuthUser { phone: string; email?: string | null; role: 'CLIENT' | 'COLLECTOR' | 'ADMIN'; mustChangePassword: boolean }
interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (phone: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ phone, password }),
    });
    setAccessToken(res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    setUser(res.user);
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const changePassword = async (current: string, next: string) => {
    const res = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setAccessToken(res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
  };

  return <Ctx.Provider value={{ user, loading, login, logout, changePassword }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: LoginPage**

`web/src/pages/LoginPage.tsx` (móvil-first: centro de pantalla, card, campos con label, botón "Entrar" con loading, link a registro, mensajes de error con `Alert`). Lógica: `login()` del contexto; si `user.mustChangePassword` → `navigate('/change-password')`; si rol CLIENT → `/app/cliente`, COLLECTOR → `/app/cobrador`, ADMIN → `/app/admin`.

- [ ] **Step 3: Prueba de LoginPage**

`web/src/pages/LoginPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('muestra el título y los campos', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Prestamitos/i)).toBeTruthy();
    expect(screen.getByLabelText(/Teléfono/i)).toBeTruthy();
    expect(screen.getByLabelText(/Contraseña/i)).toBeTruthy();
  });
});
```

Ejecutar: `cd web && npx vitest run` → PASS.

- [ ] **Step 4: RegisterPage y ChangePasswordPage**

`RegisterPage`: campos teléfono (10 dígitos), correo, contraseña + confirmación; validación client-side con la misma política (mín. 8, mayúscula, número); tras registrar → login automático → dashboard cliente.

`ChangePasswordPage`: campos actual/nueva/confirmación; muestra reglas de la política; al éxito → dashboard según rol (y toast de éxito).

- [ ] **Step 5: Router con protección por rol**

`web/src/App.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardShell } from './pages/dashboard/DashboardShell';
import { Spinner } from './components/ui/Spinner';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={homeFor(user.role)} /> : <RegisterPage />} />
      <Route path="/change-password" element={user?.mustChangePassword ? <ChangePasswordPage /> : <Navigate to={homeFor(user?.role ?? 'CLIENT')} />} />
      <Route path="/app/*" element={user ? <DashboardShell role={user.role} /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} />} />
    </Routes>
  );
}

function homeFor(role: string) {
  if (role === 'ADMIN') return '/app/admin';
  if (role === 'COLLECTOR') return '/app/cobrador';
  return '/app/cliente';
}
```

`DashboardShell`: barra inferior móvil (Inicio, [rol: Pagos/Clientes], Perfil), placeholder por rol ("Panel del Cliente — próximas fechas de pago" etc.), botón cerrar sesión.

- [ ] **Step 6: Verificar build y pruebas**

```bash
cd web && npm run build && npx vitest run
```

Expected: build OK, 4+ tests PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat(web): flujo de autenticación (login, registro, cambio de contraseña) y shell multi-rol"
```

---

### Task 9: CI/CD — GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: tests de API (Tasks 3-6) y web (Tasks 7-8)
- Produces: pipeline que corre lint, unit e integración (con MySQL en container) y build web.

- [ ] **Step 1: Crear el workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  api:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.4
        env:
          MYSQL_DATABASE: appprestamos
          MYSQL_USER: prestamos
          MYSQL_PASSWORD: prestamos
          MYSQL_ROOT_PASSWORD: root
        ports:
          - 3306:3306
        options: >-
          --health-cmd "mysqladmin ping -h localhost -u root -proot"
          --health-interval 10s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: mysql://prestamos:prestamos@localhost:3306/appprestamos
      JWT_ACCESS_SECRET: test-access
      JWT_REFRESH_SECRET: test-refresh
      ADMIN_PHONE: admin
      ADMIN_PASSWORD: admin
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install + migrate + test API
        working-directory: api
        run: |
          npm ci
          npx prisma migrate dev --name ci
          npx jest --runInBand

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install + test + build web
        working-directory: web
        run: |
          npm ci
          npx vitest run
          npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: pipeline GitHub Actions (test API + test/build web)"
```

---

### Task 10: Verificación final de Fase 1

**Files:**
- Modify: `README.md` (instrucciones de ejecución)

- [ ] **Step 1: Levantar el entorno completo en dev**

```bash
cd api && npx prisma migrate dev --name f1-final 2>&1 || true
docker compose -f docker-compose.dev.yml up -d --build
```

- [ ] **Step 2: Verificar salud**

```bash
curl http://localhost/api/v1/health
curl http://localhost/api/v1/health/ready
```

Expected: `{"status":"ok"}` y `{"status":"ok","db":"up"}` (Nginx → API → MySQL).

- [ ] **Step 3: Verificar flujo de admin en la app web**

1. Abrir `http://localhost` → login con `admin` / `admin`
2. El sistema obliga a cambiar la contraseña (`/change-password`)
3. Cambiar a una contraseña válida (p. ej. `AdminNuevo1!`)
4. Entrar al panel de administrador

- [ ] **Step 4: Verificar registro de cliente**

1. `/register` con teléfono `5512345678`, correo y contraseña válida
2. Login y acceso al panel de cliente

- [ ] **Step 5: Actualizar README con instrucciones**

Agregar a `README.md`:

```markdown
## Ejecución (dev)

1. Copiar `.env.example` → `.env` y completar credenciales
2. `docker compose -f docker-compose.dev.yml up -d --build`
3. Frontend: http://localhost · API: http://localhost/api/v1 · Swagger: http://localhost/api/v1/docs
4. Admin inicial: `admin` / `admin` (el sistema obliga a cambiarla)

## Pruebas

- API: `cd api && npx jest --runInBand`
- Web: `cd web && npx vitest run`
```

- [ ] **Step 6: Commit final**

```bash
git add README.md
git commit -m "docs: instrucciones de ejecución de Fase 1"
```

---

## Verificación cruzada con el spec (self-review)

| Requerimiento del spec | Task |
|------------------------|------|
| Estructura del repo, .gitignore, .env | Task 1 |
| Docker Compose con MySQL, MinIO, Nginx (dev/prod) | Task 2 |
| Backend NestJS, health, logs, validación, seguridad base | Task 3 |
| Modelo de datos núcleo (users, customers, collectors, admins, audit_logs, configuration, refresh_tokens) | Task 4 |
| Autenticación (register, login, refresh, logout, cambio de contraseña, forgot/reset) | Task 5 |
| Argon2id + política de contraseña aprobada (mín 8, máx 64, símbolos) | Tasks 3-5 |
| Admin inicial `admin:admin` vía .env + cambio obligatorio | Task 6 |
| Auditoría de acciones críticas | Task 6 |
| Frontend PWA + Design System + componentes | Task 7 |
| Login/registro/cambio de contraseña en web | Task 8 |
| CI (tests API + web) | Task 9 |
| Verificación E2E manual de Fase 1 | Task 10 |

Fuera de alcance de Fase 1 (fases siguientes): motor financiero/quote, documentos/video, pagaré, cobrador, BI, PWA avanzada (push), multas programadas, producción (TLS/backups).