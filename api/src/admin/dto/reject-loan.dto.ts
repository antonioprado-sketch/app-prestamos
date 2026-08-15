import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectLoanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
