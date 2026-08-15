import { Matches } from 'class-validator';

export class AssignCollectorDto {
  @Matches(/^\d+$/, { message: 'collectorId inválido' })
  collectorId: string;
}
