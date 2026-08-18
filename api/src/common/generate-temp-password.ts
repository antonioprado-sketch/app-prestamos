import { randomBytes, randomInt } from 'crypto';

export function generateTempPassword(): string {
  const digits = randomInt(10, 99);
  const hex = randomBytes(6).toString('hex');
  return `Temp${digits}${hex}`;
}
