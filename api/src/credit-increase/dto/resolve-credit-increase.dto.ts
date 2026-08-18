import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveCreditIncreaseDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
