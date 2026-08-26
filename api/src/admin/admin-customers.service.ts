import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ScoreService } from '../score/score.service';
import { StorageService } from '../storage/storage.service';
import { generateTempPassword } from '../common/generate-temp-password';
import {
  AdminLoanResult,
  ADMIN_LOAN_INCLUDE,
  toAdminLoanResult,
} from './admin-loans.service';

export interface CreatedCustomerResult {
  phone: string;
  tempPassword: string;
}

export interface AdminCustomerSummary {
  phone: string;
  nombres: string | null;
  apellidos: string | null;
  isNewCustomer: boolean;
  onboardingComplete: boolean;
  scoreLevel: string;
  isManualScoreOverride: boolean;
  latestLoanStatus: string | null;
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  aval: string | null;
  avalPhone: string | null;
  email: string | null;
  calle: string | null;
  numero: string | null;
  colonia: string | null;
  cp: string | null;
  ciudad: string | null;
  estado: string | null;
  referencias: string | null;
  createdAt: Date;
  loans: AdminLoanResult[];
  documents: {
    id: string;
    type: string;
    mime: string;
    sizeBytes: number;
    createdAt: Date;
  }[];
}

@Injectable()
export class AdminCustomersService {
  private readonly logger = new Logger(AdminCustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly score: ScoreService,
    private readonly storage: StorageService,
  ) {}

  async create(
    adminPhone: string,
    phone: string,
    ip: string,
    ua: string,
    nombre?: string,
  ): Promise<CreatedCustomerResult> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese teléfono');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
    });

    const nombres = nombre?.trim()
      ? nombre.trim().split(' ').slice(0, 1).join(' ')
      : null;
    const apellidos = nombre?.trim()
      ? nombre.trim().split(' ').slice(1).join(' ') || null
      : null;
    await this.prisma.user.create({
      data: {
        phone,
        passwordHash,
        role: 'CLIENT',
        mustChangePassword: true,
        customer: { create: { isNewCustomer: true, nombres, apellidos } },
      },
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'customer_created_manually',
      entity: 'customer',
      entityId: phone,
      newValue: { phone },
      ip,
      userAgent: ua,
    });

    return { phone, tempPassword };
  }

  /** Borrado completo: elimina la cuenta, su customer (y por cascada préstamos,
   *  pagos, documentos, ubicaciones, notificaciones, refresh tokens) y los
   *  archivos en MinIO. El teléfono queda libre para re-registrarse. */
  async remove(
    adminPhone: string,
    phone: string,
    ip: string,
    ua: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException('Cliente no encontrado');
    if (user.role !== 'CLIENT')
      throw new BadRequestException('Solo se pueden eliminar clientes');

    const documents = await this.prisma.document.findMany({
      where: { customerPhone: phone },
      select: { storageKey: true },
    });

    for (const doc of documents) {
      try {
        await this.storage.removeObject(doc.storageKey);
      } catch (err) {
        this.logger.warn(
          `No se pudo eliminar el objeto de MinIO ${doc.storageKey}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.prisma.user.delete({ where: { phone } });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'customer_deleted',
      entity: 'customer',
      entityId: phone,
      newValue: { role: user.role, documentsDeleted: documents.length },
      ip,
      userAgent: ua,
    });
  }

  async findAll(): Promise<AdminCustomerSummary[]> {
    const customers = await this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(customers.map((c) => this.toSummary(c)));
  }

  async findOne(phone: string): Promise<AdminCustomerDetail> {
    const customer = await this.loadCustomer(phone);
    const summary = await this.toSummary(customer);

    const [loans, documents] = await Promise.all([
      this.prisma.loan.findMany({
        where: { customerPhone: phone },
        include: ADMIN_LOAN_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.findMany({
        where: { customerPhone: phone },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ...summary,
      aval: customer.aval,
      avalPhone: customer.avalPhone,
      email: customer.email,
      calle: customer.calle,
      numero: customer.numero,
      colonia: customer.colonia,
      cp: customer.cp,
      ciudad: customer.ciudad,
      estado: customer.estado,
      referencias: customer.referencias,
      createdAt: customer.createdAt,
      loans: loans.map(toAdminLoanResult),
      documents: documents.map((d) => ({
        id: String(d.id),
        type: d.type,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt,
      })),
    };
  }

  async updateNewClient(
    adminPhone: string,
    phone: string,
    isNewCustomer: boolean,
    ip: string,
    ua: string,
  ): Promise<AdminCustomerSummary> {
    const customer = await this.loadCustomer(phone);

    const updated = await this.prisma.customer.update({
      where: { phone },
      data: { isNewCustomer },
    });

    await this.audit.log({
      userPhone: adminPhone,
      action: 'customer_new_client_updated',
      entity: 'customer',
      entityId: phone,
      prevValue: { isNewCustomer: customer.isNewCustomer },
      newValue: { isNewCustomer },
      ip,
      userAgent: ua,
    });

    return this.toSummary(updated);
  }

  private async loadCustomer(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  private async toSummary(customer: {
    phone: string;
    nombres: string | null;
    apellidos: string | null;
    isNewCustomer: boolean;
    onboardingComplete: boolean;
  }): Promise<AdminCustomerSummary> {
    const [scoreResult, latestLoan] = await Promise.all([
      this.score.getForCustomer(customer.phone),
      this.prisma.loan.findFirst({
        where: { customerPhone: customer.phone },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      }),
    ]);

    return {
      phone: customer.phone,
      nombres: customer.nombres,
      apellidos: customer.apellidos,
      isNewCustomer: customer.isNewCustomer,
      onboardingComplete: customer.onboardingComplete,
      scoreLevel: scoreResult.level,
      isManualScoreOverride: scoreResult.isManualOverride,
      latestLoanStatus: latestLoan?.status ?? null,
    };
  }
}
