import { IsInt, IsNumber, Min } from 'class-validator';

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
}
