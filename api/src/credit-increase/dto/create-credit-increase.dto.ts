import { IsInt, Max, Min } from 'class-validator';

export class CreateCreditIncreaseDto {
  @IsInt()
  @Min(500)
  @Max(20000)
  amount: number;
}
