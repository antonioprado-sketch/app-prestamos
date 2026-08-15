import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { LocationSource } from '@prisma/client';

const SOURCES: LocationSource[] = ['ONBOARDING', 'LOGIN', 'PAYMENT', 'REQUEST'];

export class RecordLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsIn(SOURCES)
  source: LocationSource;
}
