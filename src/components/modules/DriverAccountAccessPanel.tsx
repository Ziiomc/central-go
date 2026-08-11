import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clipboard, Link2, Loader2, Mail, Send } from 'lucide-react';
import { requestDriverAccess, type DriverAccessResult } from '../../lib/driverAccessRepository';
import type { Driver } from '../../types';

interface DriverAccountAccessPanelProps {
  driver: Driver;
  companyId: string;
}

export const DriverAccountAccessPanel: React.FC<DriverAccountAccessPanelProps> = ({ driver, companyId }) => {
  const [account, setAccount] = useState<DriverAccessResult | null>(null);
  const [busy, setBusy] = useState<'status' | 'send' | 'link' | null>('status');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [secureLink, setSecureLink] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!driver.userId) {
        setBusy(null);
        return;
      }
      setBusy('status');
      setError('');
      try {
        const result = await requestDriverAccess({
          companyId,
          userId: driver.userId,
          action: 'status',
        });
        if (!cancelled) setAccount(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No fue posible consultar la cuenta profesional.');
      } finally {
        if (!cancelled) setBusy(null);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [companyId, driver.userId]);

  const runAction = async (action: 'send' | 'link') => {
    if (!driver.userId) return;
    setBusy(action);
    setError('');
    setMessage('');
    try {
      const result = await requestDriverAccess({ companyId, userId: driver.userId, action });
      setAccount(result);
      setMessage(result.message);
      if (result.actionLink) setSecureLink(result.actionLink);
      else if (action === 'link') setSecureLink('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible administrar el acceso del conductor.');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!secureLink) return;
    try {
      await navigator.clipboard.writeText(secureLink);
      setMessage('Enlace seguro copiado. Envíalo únicamente al conductor por un canal privado.');
      setError('');
    } catch {
      setError('El navegador no permitió copiar el enlace automáticamente.');
    }
  };

  if (!driver.userId) {
    return (
      <div className="sm:col-span-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-[10px] text-amber-200">
        Este conductor todavía no tiene una cuenta profesional vinculada.
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">
            <Mail className="h-4 w-4 text-blue-400" />Acceso profesional
          </div>
          <p className="mt-1 text-xs font-bold text-zinc-200">
            {busy === 'status' && !account ? 'Consultando correo…' : account?.email || 'Correo no disponible'}
          </p>
        </div>
        {account && (
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${account.active ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>
            {account.active ? 'Activada' : 'Pendiente'}
          </span>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
        Este es el correo con el que el conductor inicia sesión. Puedes reenviar el acceso por correo o generar manualmente un enlace seguro de un solo uso.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void runAction('send')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2.5 text-[10px] font-black text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
        >
          {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Reenviar acceso
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void runAction('link')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[10px] font-black text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Generar enlace seguro
        </button>
      </div>

      {secureLink && (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[10px] text-amber-100/80">{secureLink}</p>
            <button type="button" onClick={() => void copyLink()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-2 text-[9px] font-black text-amber-200 hover:bg-amber-500/25">
              <Clipboard className="h-3.5 w-3.5" />Copiar
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[10px] font-semibold leading-relaxed text-emerald-200">
          <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />{message}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[10px] font-semibold leading-relaxed text-rose-200">
          <AlertCircle className="mr-1.5 inline h-3.5 w-3.5" />{error}
        </div>
      )}
    </div>
  );
};
