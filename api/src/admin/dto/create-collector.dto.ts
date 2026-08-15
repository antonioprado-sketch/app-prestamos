import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCollectorDto {
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  name: string;
}
