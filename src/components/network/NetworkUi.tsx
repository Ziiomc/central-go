import React from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight, LucideIcon } from 'lucide-react';

export const money = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;

export const statusLabel: Record<string, string> = {
  active: 'Activa',
  trial: 'En prueba',
  past_due: 'Pago atrasado',
  suspended: 'Suspendida',
  pending: 'Pendiente',
  available: 'Disponible',
  paid: 'Pagada',
  reversed: 'Revertida',
  onboarding: 'En activación',
  paused: 'Pausado',
};

export const statusClasses: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  trial: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
  past_due: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  suspended: 'bg-red-500/10 text-red-300 border-red-500/25',
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  available: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  reversed: 'bg-red-500/10 text-red-300 border-red-500/25',
  onboarding: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
  paused: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25',
};

export const CountryFlag: React.FC<{ code: string; className?: string }> = ({ code, className = '' }) => {
  const flags: Record<string, string> = { CL: '🇨🇱', AR: '🇦🇷', PE: '🇵🇪', MX: '🇲🇽', ES: '🇪🇸', EC: '🇪🇨' };
  return <span className={className}>{flags[code] || '🌎'}</span>;
};

export const StatusPill: React.FC<{ status: string; label?: string }> = ({ status, label }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wide ${statusClasses[status] || statusClasses.paused}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
    {label || statusLabel[status] || status}
  </span>
);

export const NetworkKpi: React.FC<{
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent?: 'amber' | 'blue' | 'emerald' | 'purple';
}> = ({ label, value, detail, icon: Icon, accent = 'blue' }) => {
  const accents = {
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    purple: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 shadow-xl hover:border-zinc-700 transition group overflow-hidden relative">
      <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-20 ${accent === 'amber' ? 'bg-amber-400' : accent === 'blue' ? 'bg-blue-400' : accent === 'emerald' ? 'bg-emerald-400' : 'bg-purple-400'}`} />
      <div className="flex items-start justify-between gap-3 relative">
        <div>
          <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-black text-white mt-2 tracking-tight">{value}</p>
          <p className="text-[11px] text-zinc-400 mt-1.5">{detail}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${accents[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export const SectionTitle: React.FC<{
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}> = ({ title, description, action, onAction }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <h2 className="text-base font-extrabold text-white tracking-tight">{title}</h2>
      {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
    </div>
    {action && (
      <button onClick={onAction} className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-blue-200 transition">
        {action}<ChevronRight className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

export const ProgressBar: React.FC<{ value: number; tone?: 'amber' | 'blue' | 'emerald' | 'purple' }> = ({ value, tone = 'blue' }) => {
  const bar = tone === 'amber' ? 'bg-amber-400' : tone === 'emerald' ? 'bg-emerald-400' : tone === 'purple' ? 'bg-purple-400' : 'bg-blue-400';
  return (
    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
};

export const EmptySuccess: React.FC<{ title: string; detail: string; onClose?: () => void }> = ({ title, detail, onClose }) => (
  <div className="text-center py-10">
    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-300">
      <CheckCircle2 className="w-7 h-7" />
    </div>
    <h3 className="font-black text-white mt-4">{title}</h3>
    <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">{detail}</p>
    {onClose && <button onClick={onClose} className="mt-5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white">Continuar</button>}
  </div>
);

export const MiniAction: React.FC<{ label: string; detail: string; icon: LucideIcon; onClick?: () => void; tone?: string }> = ({ label, detail, icon: Icon, onClick, tone = 'text-blue-300 bg-blue-500/10 border-blue-500/20' }) => (
  <button onClick={onClick} className="w-full text-left p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition flex items-center gap-3 group">
    <div className={`p-2 rounded-lg border ${tone}`}><Icon className="w-4 h-4" /></div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold text-zinc-200">{label}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{detail}</p>
    </div>
    <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300" />
  </button>
);
