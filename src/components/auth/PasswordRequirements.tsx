import React from 'react';
import { Check, Circle } from 'lucide-react';
import { getAuthPasswordChecks } from '../../lib/authPasswordPolicy';

export const PasswordRequirements: React.FC<{ password: string }> = ({ password }) => {
  const checks = getAuthPasswordChecks(password);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5" aria-label="Requisitos de contraseña">
      <span className={`flex items-center gap-1.5 text-[10px] font-bold ${checks.length ? 'text-emerald-400' : 'text-[var(--cg-muted)]'}`}>
        {checks.length ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
        8 caracteres como mínimo. Sin requisitos de mayúsculas, números ni símbolos.
      </span>
    </div>
  );
};
