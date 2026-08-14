import { Matches } from 'class-validator';

export class ForgotPasswordDto {
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  phone: string;
}
