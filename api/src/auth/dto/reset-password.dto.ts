import { IsString, Matches } from 'class-validator';

export class ResetPasswordDto {
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  phone: string;

  @Matches(/^[0-9]{6}$/, { message: 'El código debe tener 6 dígitos' })
  code: string;

  @IsString()
  newPassword: string;
}
