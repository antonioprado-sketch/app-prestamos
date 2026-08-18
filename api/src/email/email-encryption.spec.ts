import { decryptPassword, encryptPassword } from './email-encryption';

describe('email-encryption', () => {
  const originalEnv = process.env.EMAIL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.EMAIL_ENCRYPTION_KEY = 'test-encryption-key-not-real';
  });

  afterAll(() => {
    process.env.EMAIL_ENCRYPTION_KEY = originalEnv;
  });

  it('encrypts and decrypts back to the original plaintext', () => {
    const plain = 'un-app-password-de-gmail';
    const encrypted = encryptPassword(plain);
    expect(encrypted.data).not.toBe(plain);
    expect(decryptPassword(encrypted)).toBe(plain);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plain = 'misma-password';
    const a = encryptPassword(plain);
    const b = encryptPassword(plain);
    expect(a.data).not.toBe(b.data);
    expect(decryptPassword(a)).toBe(plain);
    expect(decryptPassword(b)).toBe(plain);
  });

  it('falla al desencriptar si el tag de autenticación fue alterado (detecta manipulación)', () => {
    const encrypted = encryptPassword('algo');
    const tampered = { ...encrypted, tag: encryptPassword('otro').tag };
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it('lanza un error claro si EMAIL_ENCRYPTION_KEY no está configurada', () => {
    delete process.env.EMAIL_ENCRYPTION_KEY;
    expect(() => encryptPassword('x')).toThrow(/EMAIL_ENCRYPTION_KEY/);
  });
});
