import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class SignPagareDto {
  @Matches(/^data:image\/png;base64,.+$/, {
    message: 'La firma debe ser una imagen PNG en formato data URL',
  })
  signature: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;
}
