import React, { useEffect, useRef, useState } from 'react';
import { Clock3, RadioTower, Volume2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { primeRadioAudio, speakVHFDispatch } from '../../lib/audioService';
import { requireSupabase } from '../../lib/supabase';

type IncomingRadio = {
  id: string;
  company_id: string;
  driver_id: string;
  unit_number: string;
  driver_name: string;
  preset_code: string | null;
  message: string;
  created_at: string;
};

export const CentralRadioReceiver: React.FC = () => {
  const { currentRole, currentCompany, soundMuted } = useApp();
  const [current, setCurrent] = useState<IncomingRadio | null>(null);
  const [queued, setQueued] = useState(0);
  const [visible, setVisible] = useState(false);
  const [recent, setRecent] = useState<IncomingRadio[]>([]);
  const queueRef = useRef<IncomingRadio[]>([]);
  const processingRef = useRef(false);
  const seenRef = useRef(new Set<string>());
  const hideTimerRef = useRef<number | null>(null);

  const centralRole = currentRole === 'operator' || currentRole === 'company_admin' || currentRole === 'super_admin';

  useEffect(() => {
    if (!centralRole || currentCompany.id === 'network') return;
    const db = requireSupabase();

    const unlockAudio = () => { void primeRadioAudio(); };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    const processQueue = async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      while (queueRef.current.length) {
        const next = queueRef.current.shift()!;
        setQueued(queueRef.current.length);
        setCurrent(next);
        setVisible(true);
        if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);

        if (!soundMuted) {
          await speakVHFDispatch(`Móvil ${next.unit_number}. ${next.message}`);
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }
      }
      processingRef.current = false;
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 9000);
    };

    const channel = db.channel(`centralgo-radio-central:${currentCompany.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_radio_messages',
        filter: `company_id=eq.${currentCompany.id}`,
      }, (payload) => {
        const row = payload.new as IncomingRadio;
        if (!row?.id || seenRef.current.has(row.id)) return;
        seenRef.current.add(row.id);
        queueRef.current.push(row);
        setQueued(queueRef.current.length + (processingRef.current ? 1 : 0));
        setRecent((items) => [row, ...items.filter((item) => item.id !== row.id)].slice(0, 4));
        setVisible(true);

        if ('vibrate' in navigator) navigator.vibrate([120, 80, 180]);
        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          try {
            new Notification(`Central GO · ${row.unit_number}`, { body: row.message, icon: '/icon.svg', tag: `driver-radio-${row.id}` });
          } catch { /* desktop notification is best effort */ }
        }
        void processQueue();
      })
      .subscribe();

    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      void db.removeChannel(channel);
    };
  }, [centralRole, currentCompany.id, soundMuted]);

  if (!centralRole || currentCompany.id === 'network' || (!visible && !current)) return null;

  return (
    <aside className={`fixed bottom-4 right-4 z-[120] w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-amber-400/35 bg-[#0a0a0d]/95 shadow-2xl shadow-black/70 backdrop-blur-xl transition ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}>
      <div className="flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-amber-500/15 to-transparent px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-300">
            <RadioTower className="h-4.5 w-4.5" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0d]" />
          </span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Radio móvil → central</p>
            <p className="text-xs font-black text-white">Canal digital operativo</p>
          </div>
        </div>
        <button onClick={() => setVisible(false)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label="Minimizar radio"><X className="h-4 w-4" /></button>
      </div>

      {current && (
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-black text-zinc-950">{current.unit_number}</span>
                <span className="text-xs font-bold text-zinc-300">{current.driver_name}</span>
              </div>
              <p className="mt-3 text-sm font-bold leading-relaxed text-white">{current.message}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300">
              <Volume2 className="h-3 w-3" /> EN AIRE
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-[9px] font-bold text-zinc-500">
            <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(current.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span>{queued > 0 ? `${queued} mensaje${queued === 1 ? '' : 's'} en cola` : 'Canal despejado'}</span>
          </div>

          {recent.length > 1 && (
            <div className="mt-3 space-y-1.5 border-t border-zinc-900 pt-3">
              {recent.slice(1, 4).map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-zinc-950/70 px-2.5 py-2 text-[9px] text-zinc-500">
                  <span className="font-black text-zinc-300">{item.unit_number}</span>
                  <span className="truncate">{item.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
