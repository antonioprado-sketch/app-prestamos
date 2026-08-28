import { IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(8, 64)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'La contraseña debe tener al menos una mayúscula, una minúscula, un número y un carácter especial',
  })
  newPassword!: string;
}
