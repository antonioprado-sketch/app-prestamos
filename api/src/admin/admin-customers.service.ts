import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ScoreService } from '../score/score.service';
import { toLoanDraftResult, LoanDraftResult } from '../loans/loans.service';

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
  loans: LoanDraftResult[];
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly score: ScoreService,
  ) {}

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
        include: { schedule: true },
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
      loans: loans.map(toLoanDraftResult),
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
