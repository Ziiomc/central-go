import React from 'react';
import { Check, Circle } from 'lucide-react';
import { getAuthPasswordChecks } from '../../lib/authPasswordPolicy';

export const PasswordRequirements: React.FC<{ password: string }> = ({ password }) => {
  const checks = getAuthPasswordChecks(password);
  const items = [
    [checks.length, '10 caracteres o más'],
    [checks.lowercase, 'Una letra minúscula'],
    [checks.uppercase, 'Una letra mayúscula'],
    [checks.number, 'Un número'],
    [checks.symbol, 'Un símbolo (! @ # $ ...)'],
  ] as const;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5" aria-label="Requisitos de contraseña">
      <p className="mb-2 text-[10px] font-black text-[var(--cg-muted)]">Tu contraseña debe incluir:</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map(([valid, label]) => (
          <span key={label} className={`flex items-center gap-1.5 text-[10px] font-bold ${valid ? 'text-emerald-400' : 'text-[var(--cg-muted)]'}`}>
            {valid ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};
