import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsPhoneOrAdmin(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneOrAdmin',
      target: object.constructor,
      propertyName,
      options: {
        message: 'El teléfono debe tener 10 dígitos',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          if (/^[0-9]{10}$/.test(value)) return true;
          return value === (process.env.ADMIN_PHONE ?? 'admin');
        },
      },
    });
  };
}
