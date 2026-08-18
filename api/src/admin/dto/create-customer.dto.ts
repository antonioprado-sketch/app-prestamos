import { Matches } from 'class-validator';

export class CreateCustomerDto {
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener 10 dígitos' })
  phone: string;
}
