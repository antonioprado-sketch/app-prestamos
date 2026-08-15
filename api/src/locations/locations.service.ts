import { Injectable } from '@nestjs/common';
import { LocationSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordLocationInput {
  lat: number;
  lng: number;
  accuracy?: number;
  source: LocationSource;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(phone: string, input: RecordLocationInput) {
    const location = await this.prisma.location.create({
      data: {
        customerPhone: phone,
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy,
        source: input.source,
      },
    });

    return {
      id: String(location.id),
      capturedAt: location.capturedAt,
    };
  }

  async findLatestForCustomer(phone: string): Promise<{
    location: {
      lat: number;
      lng: number;
      accuracy: number | null;
      capturedAt: Date;
    } | null;
  }> {
    const location = await this.prisma.location.findFirst({
      where: { customerPhone: phone },
      orderBy: { capturedAt: 'desc' },
    });
    if (!location) return { location: null };

    return {
      location: {
        lat: Number(location.lat),
        lng: Number(location.lng),
        accuracy: location.accuracy === null ? null : Number(location.accuracy),
        capturedAt: location.capturedAt,
      },
    };
  }

  /** Última ubicación conocida de cada cliente que haya compartido al menos una — para el mapa admin. */
  async findAllLatest(): Promise<
    {
      customerPhone: string;
      customerName: string | null;
      lat: number;
      lng: number;
      capturedAt: Date;
    }[]
  > {
    const locations = await this.prisma.location.findMany({
      orderBy: { capturedAt: 'desc' },
      include: {
        customer: { select: { nombres: true, apellidos: true } },
      },
    });

    const seen = new Set<string>();
    const latest: {
      customerPhone: string;
      customerName: string | null;
      lat: number;
      lng: number;
      capturedAt: Date;
    }[] = [];

    for (const location of locations) {
      if (seen.has(location.customerPhone)) continue;
      seen.add(location.customerPhone);

      const customerName = [
        location.customer.nombres,
        location.customer.apellidos,
      ]
        .filter(Boolean)
        .join(' ');

      latest.push({
        customerPhone: location.customerPhone,
        customerName: customerName || null,
        lat: Number(location.lat),
        lng: Number(location.lng),
        capturedAt: location.capturedAt,
      });
    }

    return latest;
  }
}
