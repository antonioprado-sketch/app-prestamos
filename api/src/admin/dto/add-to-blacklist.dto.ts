import { Matches, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AddToBlacklistDto {
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(255, { message: 'El motivo no puede superar 255 caracteres' })
  reason: string;
}
