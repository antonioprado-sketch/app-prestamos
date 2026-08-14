import { IsIn, IsISO8601, IsNumber, IsPositive } from 'class-validator';

export class QuoteDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsIn(['WEEKLY', 'BIWEEKLY'])
  model: 'WEEKLY' | 'BIWEEKLY';

  @IsISO8601({ strict: true })
  openingDate: string;
}
