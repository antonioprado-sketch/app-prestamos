import { IsBoolean } from 'class-validator';

export class UpdateCollectorStatusDto {
  @IsBoolean()
  active: boolean;
}
