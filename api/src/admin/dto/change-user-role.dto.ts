import { IsIn } from 'class-validator';

export class ChangeUserRoleDto {
  @IsIn(['CLIENT', 'COLLECTOR'])
  role: 'CLIENT' | 'COLLECTOR';
}
