import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class RegisterDto {
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  email?: string;

  @IsString()
  password: string;
}
