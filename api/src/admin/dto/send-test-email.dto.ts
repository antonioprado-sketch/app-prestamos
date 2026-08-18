import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendTestEmailDto {
  @IsEmail()
  to: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
