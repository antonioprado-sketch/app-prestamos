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
}
