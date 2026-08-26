import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterHistoricalPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @IsString()
  receivedAt: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
