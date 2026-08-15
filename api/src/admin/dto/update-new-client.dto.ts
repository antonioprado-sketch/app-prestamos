import { IsBoolean } from 'class-validator';

export class UpdateNewClientDto {
  @IsBoolean()
  isNewCustomer: boolean;
}
