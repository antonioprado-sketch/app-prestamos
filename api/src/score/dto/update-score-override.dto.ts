import { IsEnum, ValidateIf } from 'class-validator';
import { ScoreLevel } from '@prisma/client';

export class UpdateScoreOverrideDto {
  @ValidateIf((o) => o.level !== null)
  @IsEnum(ScoreLevel)
  level: ScoreLevel | null;
}
