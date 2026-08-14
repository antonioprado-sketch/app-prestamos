import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async updateMe(
    phone: string,
    dto: UpdateCustomerDto,
    ip: string,
    ua: string,
  ) {
    const existing = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (!existing) throw new NotFoundException('Cliente no encontrado');

    const updated = await this.prisma.customer.update({
      where: { phone },
      data: { ...dto, onboardingComplete: true },
    });

    await this.audit.log({
      userPhone: phone,
      action: 'customer_data_updated',
      entity: 'customer',
      entityId: phone,
      prevValue: {
        nombres: existing.nombres,
        apellidos: existing.apellidos,
        aval: existing.aval,
        avalPhone: existing.avalPhone,
        calle: existing.calle,
        numero: existing.numero,
        colonia: existing.colonia,
        cp: existing.cp,
        ciudad: existing.ciudad,
        estado: existing.estado,
        referencias: existing.referencias,
      },
      newValue: { ...dto },
      ip,
      userAgent: ua,
    });

    return updated;
  }
}
