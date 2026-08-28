export function validatePassword(password: string): string | null {
  if (password.length < 8)
    return 'La contraseña debe tener mínimo 8 caracteres';
  if (password.length > 64)
    return 'La contraseña debe tener máximo 64 caracteres';
  if (!/[A-Z]/.test(password))
    return 'La contraseña debe tener al menos una mayúscula';
  if (!/[a-z]/.test(password))
    return 'La contraseña debe tener al menos una minúscula';
  if (!/\d/.test(password))
    return 'La contraseña debe tener al menos un número';
  if (!/[^A-Za-z0-9]/.test(password))
    return 'La contraseña debe tener al menos un carácter especial';
  return null;
}

export function passwordRules(password: string) {
  return {
    min8: password.length >= 8,
    max64: password.length <= 64 && password.length > 0,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}
