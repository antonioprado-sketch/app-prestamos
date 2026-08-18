import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CreditIncreaseRequest, Customer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoansService } from '../loans/loans.service';
import { ScoreService } from '../score/score.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { CreateCreditIncreaseDto } from './dto/create-credit-increase.dto';
import { ResolveCreditIncreaseDto } from './dto/resolve-credit-increase.dto';

export interface CreditIncreaseRequestDto {
  id: string;
  customerPhone: string;
  customerName: string | null;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  currentMaxAmount: number | null;
  scoreLevel: string | null;
}

@Injectable()
export class CreditIncreaseService {
  private readonly logger = new Logger(CreditIncreaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loans: LoansService,
    private readonly score: ScoreService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  async create(
    phone: string,
    dto: CreateCreditIncreaseDto,
    ip: string,
    ua: string,
  ): Promise<CreditIncreaseRequestDto> {
    if (!Number.isInteger(dto.amount) || dto.amount % 500 !== 0) {
      throw new BadRequestException('El monto debe ser múltiplo de $500');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const pending = await this.prisma.creditIncreaseRequest.findFirst({
      where: { customerPhone: phone, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'Ya tienes una solicitud de aumento en revisión',
      );
    }

    const maxAmount = await this.loans.resolveMaxAmount(phone);
    if (maxAmount === null) {
      throw new BadRequestException('Tu límite de crédito ya está al máximo');
    }
    if (dto.amount <= maxAmount) {
      throw new BadRequestException(
        `El monto debe ser mayor a tu límite actual de $${maxAmount}`,
      );
    }

    const created = await this.prisma.creditIncreaseRequest.create({
      data: {
        customerPhone: phone,
        amount: dto.amount,
        status: 'PENDING',
      },
    });

    await this.audit.log({
      userPhone: phone,
      action: 'credit_increase_requested',
      entity: 'credit_increase_request',
      entityId: String(created.id),
      newValue: { amount: dto.amount },
      ip,
      userAgent: ua,
    });

    await this.notifyStaff(phone, dto.amount, String(created.id));

    return this.toDto(created, customer);
  }

  async getMyLatest(phone: string): Promise<CreditIncreaseRequestDto | null> {
    const request = await this.prisma.creditIncreaseRequest.findFirst({
      where: { customerPhone: phone },
      orderBy: { createdAt: 'desc' },
    });
    if (!request) return null;
    return this.toDto(request, undefined);
  }

  async findPending(): Promise<CreditIncreaseRequestDto[]> {
    const requests = await this.prisma.creditIncreaseRequest.findMany({
      where: { status: 'PENDING' },
      include: { customer: true },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      requests.map((request) => this.toDto(request, request.customer)),
    );
  }

  async resolve(
    actorPhone: string,
    id: string,
    dto: ResolveCreditIncreaseDto,
    ip: string,
    ua: string,
  ): Promise<CreditIncreaseRequestDto> {
    if (!/^\d+$/.test(id)) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    const request = await this.prisma.creditIncreaseRequest.findUnique({
      where: { id: BigInt(id) },
      include: { customer: true },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Esta solicitud ya fue resuelta');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const resolved = await tx.creditIncreaseRequest.update({
        where: { id: request.id },
        data: {
          status: dto.status,
          resolvedBy: actorPhone,
          resolvedAt: new Date(),
          note: dto.note ?? null,
        },
      });
      if (dto.status === 'APPROVED') {
        await tx.customer.update({
          where: { phone: request.customerPhone },
          data: { isNewCustomer: false, creditLimit: request.amount },
        });
      }
      return resolved;
    });

    await this.audit.log({
      userPhone: actorPhone,
      action: 'credit_increase_resolved',
      entity: 'credit_increase_request',
      entityId: String(updated.id),
      prevValue: { status: request.status },
      newValue: {
        status: updated.status,
        amount: Number(request.amount),
        note: updated.note,
      },
      ip,
      userAgent: ua,
    });

    const approved = updated.status === 'APPROVED';
    await this.notifications.create({
      userPhone: request.customerPhone,
      type: 'credit_increase_resolved',
      title: approved ? '¡Aumento aprobado!' : 'Aumento no aprobado',
      body: approved
        ? `Tu nuevo límite de crédito es $${Number(request.amount)}.`
        : `Tu solicitud de aumento a $${Number(request.amount)} no fue aprobada.`,
      metadata: {
        creditIncreaseRequestId: String(updated.id),
        status: updated.status,
      },
    });
    if (request.customer?.email) {
      await this.email
        .send(
          request.customer.email,
          approved
            ? 'Aumento de crédito aprobado — AppPrestamitos'
            : 'Aumento de crédito no aprobado — AppPrestamitos',
          approved
            ? `<p>Tu solicitud de aumento de crédito fue aprobada.</p><p>Tu nuevo límite es $${Number(request.amount)}.</p>`
            : `<p>Tu solicitud de aumento de crédito a $${Number(request.amount)} no fue aprobada.</p>`,
        )
        .catch((err) =>
          this.logger.warn(
            `email a ${request.customer?.email} falló: ${err?.message ?? err}`,
          ),
        );
    }

    return this.toDto(updated, request.customer);
  }

  private async toDto(
    request: CreditIncreaseRequest,
    customer: Customer | undefined,
  ): Promise<CreditIncreaseRequestDto> {
    const customerName =
      [customer?.nombres, customer?.apellidos].filter(Boolean).join(' ') ||
      null;
    const [currentMaxAmount, scoreLevel] = await Promise.all([
      this.loans.resolveMaxAmount(request.customerPhone),
      this.score
        .getForCustomer(request.customerPhone)
        .then((result) => result.level)
        .catch(() => null),
    ]);
    return {
      id: String(request.id),
      customerPhone: request.customerPhone,
      customerName,
      amount: Number(request.amount),
      status: request.status,
      note: request.note,
      createdAt: request.createdAt.toISOString(),
      resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
      resolvedBy: request.resolvedBy,
      currentMaxAmount,
      scoreLevel,
    };
  }

  private async notifyStaff(
    customerPhone: string,
    amount: number,
    requestId: string,
  ): Promise<void> {
    const staff = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'COLLECTOR'] }, status: 'ACTIVE' },
      select: { phone: true, email: true },
    });
    const body = `El cliente ${customerPhone} solicita un aumento de crédito a $${amount}.`;

    await Promise.all(
      staff.map(async (member) => {
        await this.notifications.create({
          userPhone: member.phone,
          type: 'credit_increase_request',
          title: 'Nueva solicitud de aumento',
          body,
          metadata: { creditIncreaseRequestId: requestId, customerPhone },
        });
        if (member.email) {
          await this.email
            .send(
              member.email,
              'Nueva solicitud de aumento de crédito — AppPrestamitos',
              `<p>${body}</p><p>Ingresa a la app para revisarla y resolverla.</p>`,
            )
            .catch((err) =>
              this.logger.warn(
                `email a ${member.email} falló: ${err?.message ?? err}`,
              ),
            );
        }
      }),
    );
  }
}
