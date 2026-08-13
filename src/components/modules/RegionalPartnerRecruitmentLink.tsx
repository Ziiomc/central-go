import React, { useMemo, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { runtimeConfig } from '../../config/runtime';

export const RegionalPartnerRecruitmentLink: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => `${runtimeConfig.officialAppUrl.replace(/\/$/, '')}/?regional_partner=${encodeURIComponent(code)}`, [code]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Trabaja con Central GO', text: 'Postula como Partner Comercial de mi equipo regional en Central GO.', url: link });
      return;
    }
    await copy();
  };

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300"><Share2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white">Recluta Partners Comerciales</p>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Comparte este enlace en tus redes. Los postulantes quedarán atribuidos a tu estructura regional cuando sean aprobados por Superadmin.</p>
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-[9px] text-zinc-400 break-all">{link}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void copy()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-black text-cyan-200">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : 'Copiar link'}</button>
            <button type="button" onClick={() => void share()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-[10px] font-black text-slate-950"><Share2 className="h-3.5 w-3.5" />Compartir</button>
          </div>
        </div>
      </div>
    </div>
  );
};
