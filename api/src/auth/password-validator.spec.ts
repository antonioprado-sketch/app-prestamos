import { validatePassword } from './password.policy';

describe('validatePassword', () => {
  it('acepta una contraseña válida', () => {
    expect(validatePassword('Abcdef12!')).toBeNull();
  });
  it('rechaza menor a 8 caracteres', () => {
    expect(validatePassword('Abc12!x')).toContain('mínimo 8');
  });
  it('rechaza mayor a 64', () => {
    expect(validatePassword('A'.repeat(65) + 'a1!')).toContain('máximo 64');
  });
  it('rechaza sin mayúscula', () => {
    expect(validatePassword('abcdef12!')).toContain('mayúscula');
  });
  it('rechaza sin número', () => {
    expect(validatePassword('Abcdefgh!')).toContain('número');
  });
  it('permite símbolos', () => {
    expect(validatePassword('Abcdef12!@#$')).toBeNull();
  });
  it('rechaza sin carácter especial', () => {
    expect(validatePassword('Abcdef12x')).toContain('especial');
  });
  it('rechaza sin minúscula', () => {
    expect(validatePassword('ABCDEF12!')).toContain('minúscula');
  });
});
