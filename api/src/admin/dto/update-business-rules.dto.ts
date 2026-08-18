import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBusinessRulesDto {
  @IsNumber()
  @Min(0.01)
  penaltyPerDay: number;

  @IsInt()
  @Min(1)
  yellowMaxDays: number;

  @IsInt()
  @Min(1)
  orangeMaxDays: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  greenMaxAmount: number | null;

  @IsNumber()
  @Min(0.01)
  yellowMaxAmount: number;

  @IsNumber()
  @Min(0.01)
  orangeMaxAmount: number;

  @IsNumber()
  @Min(0.01)
  redMaxAmount: number;
}
