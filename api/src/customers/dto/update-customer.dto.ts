import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(25)
  nombres: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(35)
  apellidos: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  aval: string;

  @Matches(/^[0-9]{10}$/, {
    message: 'El teléfono del aval debe tener 10 dígitos',
  })
  avalPhone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  calle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numero: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  colonia: string;

  @Matches(/^[0-9]{5}$/, { message: 'El código postal debe tener 5 dígitos' })
  cp: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ciudad: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  estado: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  referencias: string;
}
