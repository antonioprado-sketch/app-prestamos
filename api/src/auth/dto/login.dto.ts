import { IsString } from 'class-validator';
import { IsPhoneOrAdmin } from '../validators/is-phone-or-admin.validator';

export class LoginDto {
  @IsPhoneOrAdmin()
  phone: string;

  @IsString()
  password: string;
}
