import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  nombre?: string;
}
