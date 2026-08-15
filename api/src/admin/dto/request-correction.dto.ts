import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestCorrectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
