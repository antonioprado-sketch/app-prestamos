import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

export interface EncryptedPassword {
  iv: string;
  tag: string;
  data: string;
}

function getKey(): Buffer {
  const secret = process.env.EMAIL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'EMAIL_ENCRYPTION_KEY no configurada — requerida para guardar credenciales de correo',
    );
  }
  return scryptSync(secret, 'appprestamos-email-config', 32);
}

export function encryptPassword(plain: string): EncryptedPassword {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

export function decryptPassword(encrypted: EncryptedPassword): string {
  const key = getKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encrypted.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const data = Buffer.concat([
    decipher.update(Buffer.from(encrypted.data, 'base64')),
    decipher.final(),
  ]);
  return data.toString('utf8');
}
