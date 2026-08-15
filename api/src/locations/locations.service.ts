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
        accuracy:
          location.accuracy === null ? null : Number(location.accuracy),
        capturedAt: location.capturedAt,
      },
    };
  }
}
