export function getPasswordRules(password: string, confirm?: string) {
  return {
    min8: password.length >= 8,
    max64: password.length <= 64 && password.length > 0,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match: confirm === undefined ? true : password.length > 0 && password === confirm,
  };
}

const labels: Record<string, string> = {
  min8: 'Al menos 8 caracteres',
  max64: 'Máximo 64 caracteres',
  upper: 'Al menos una mayúscula (A-Z)',
  lower: 'Al menos una minúscula (a-z)',
  number: 'Al menos un número (0-9)',
  special: 'Al menos un carácter especial (!@#$...)',
  match: 'Confirmación coincide',
};

export function PasswordRules({ password, confirm }: { password: string; confirm?: string }) {
  const rules = getPasswordRules(password, confirm);
  const entries: Array<[keyof typeof rules, boolean]> = [
    ['min8', rules.min8],
    ['max64', rules.max64],
    ['upper', rules.upper],
    ['lower', rules.lower],
    ['number', rules.number],
    ['special', rules.special],
    ...(confirm !== undefined ? ([['match', rules.match]] as Array<[keyof typeof rules, boolean]>) : []),
  ];

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-sm">
      <p className="mb-2 font-label-md text-label-md text-on-surface-variant">Debe cumplir:</p>
      <ul className="flex flex-col gap-1">
        {entries.map(([key, ok]) => (
          <li key={key} className={`flex items-center gap-2 font-body-sm text-body-sm ${ok ? 'text-success' : 'text-error'}`}>
            <span aria-hidden className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${ok ? 'bg-success text-white' : 'bg-error-container text-error'}`}>
              {ok ? '✓' : '✗'}
            </span>
            {labels[key]}
            {key === 'min8' && password.length > 0 && (
              <span className="font-body-sm text-[11px] text-outline">({password.length}/8)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function isPasswordValid(password: string, confirm?: string) {
  const r = getPasswordRules(password, confirm);
  return r.min8 && r.max64 && r.upper && r.lower && r.number && r.special && r.match;
}
