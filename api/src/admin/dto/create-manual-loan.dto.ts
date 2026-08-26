import { IsIn, IsNumber, IsString, Matches, Max, Min } from 'class-validator';

export class CreateManualLoanDto {
  @IsString()
  @Matches(/^\d{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  customerPhone: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(500)
  @Max(20000)
  amount: number;

  @IsIn(['WEEKLY', 'BIWEEKLY'], { message: 'Modelo inválido' })
  model: 'WEEKLY' | 'BIWEEKLY';

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha inválida (YYYY-MM-DD)' })
  openingDate: string;
}
