import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  KeyRound,
  Link2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unplug,
  WalletCards,
  Webhook,
} from 'lucide-react';
import {
  disconnectMercadoPagoPlatform,
  loadMercadoPagoPlatformStatus,
  startMercadoPagoConnection,
  type MercadoPagoPlatformStatus,
} from '../../lib/mercadoPagoRepository';

const emptyStatus: MercadoPagoPlatformStatus = {
  connected: false,
  mpUserId: null,
  connectedAt: null,
  tokenExpiresAt: null,
  connectedByName: null,
};

const formatDate = (value: string | null) => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin registro'
    : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const PlatformPaymentsModule: React.FC = () => {
  const [status, setStatus] = useState<MercadoPagoPlatformStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const callbackUrl = 'https://cuazdzsvgwrnpczbvrgx.supabase.co/functions/v1/mercadopago-oauth-callback';
  const tokenHealthy = status.connected && (!status.tokenExpiresAt || new Date(status.tokenExpiresAt).getTime() > Date.now());

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await loadMercadoPagoPlatformStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible revisar Mercado Pago.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('mercadopago');
    if (!result) return;
    if (result === 'connected') setMessage('Cuenta vinculada correctamente. Central Go ya puede cobrar suscripciones con Mercado Pago.');
    else if (result === 'cancelled') setMessage('La vinculación fue cancelada; no se realizó ningún cambio.');
    else setError(params.get('detail') || 'Mercado Pago no pudo completar la vinculación.');
    params.delete('mercadopago');
    params.delete('detail');
    const query = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    if (result === 'connected') void reload();
  }, [reload]);

  const connect = async () => {
    setConnecting(true);
    setError('');
    setMessage('');
    try {
      window.location.assign(await startMercadoPagoConnection());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la conexión.');
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('¿Desvincular la cuenta de Mercado Pago? Los nuevos cobros quedarán pausados hasta conectar otra cuenta.')) return;
    setDisconnecting(true);
    setError('');
    try {
      await disconnectMercadoPagoPlatform();
      setMessage('Cuenta desvinculada. Ninguna credencial quedó disponible para nuevos cobros.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible desvincular la cuenta.');
    } finally {
      setDisconnecting(false);
    }
  };

  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('No pudimos copiar la URL automáticamente. Puedes seleccionarla y copiarla manualmente.');
    }
  };

  return (
    <div className="cg-page-stack">
      <section className="cg-payment-hero">
        <div className="cg-payment-orb cg-payment-orb-one" />
        <div className="cg-payment-orb cg-payment-orb-two" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.3fr_.7fr] xl:items-end">
          <div>
            <span className="cg-eyebrow"><Sparkles className="h-3.5 w-3.5" /> Centro financiero</span>
            <h1>Pagos simples, control total.</h1>
            <p>Vincula la cuenta oficial de Mercado Pago una sola vez. Central Go utilizará esa conexión para cobrar planes, validar pagos y distribuir comisiones sin exponer credenciales en el navegador.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="cg-trust-chip"><ShieldCheck className="h-4 w-4" /> Acceso Superadmin</span>
              <span className="cg-trust-chip"><KeyRound className="h-4 w-4" /> OAuth + PKCE</span>
              <span className="cg-trust-chip"><RefreshCw className="h-4 w-4" /> Renovación automática</span>
            </div>
          </div>
          <div className={`cg-payment-status-card ${status.connected ? 'is-connected' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="cg-payment-logo">M<span>P</span></span>
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin text-[var(--cg-primary)]" /> : (
                <span className={`cg-status-badge ${status.connected ? 'is-online' : ''}`}>
                  <span />{status.connected ? 'Cuenta conectada' : 'Pendiente de vincular'}
                </span>
              )}
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-[var(--cg-muted)]">Cuenta receptora</p>
            <p className="mt-1 text-xl font-black text-[var(--cg-text)]">{status.mpUserId ? `Mercado Pago · ${status.mpUserId}` : 'Aún no configurada'}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--cg-muted)]">{status.connected ? `Vinculada por ${status.connectedByName || 'Superadmin'} · ${formatDate(status.connectedAt)}` : 'Presiona vincular para autorizar la cuenta oficial.'}</p>
          </div>
        </div>
      </section>

      {(message || error) && <div className={`cg-inline-notice ${error ? 'is-error' : 'is-success'}`}>{error ? <CircleDollarSign className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}<span>{error || message}</span></div>}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="cg-panel-card p-5 md:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="cg-eyebrow"><WalletCards className="h-3.5 w-3.5" /> Cuenta de cobro</span>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-[var(--cg-text)]">{status.connected ? 'Mercado Pago está operativo' : 'Conecta Mercado Pago'}</h2>
              <p className="mt-2 max-w-xl text-xs leading-6 text-[var(--cg-muted)]">La autorización ocurre directamente en Mercado Pago. Central Go nunca te pedirá la contraseña ni mostrará el Access Token.</p>
            </div>
            <div className={`cg-connection-icon ${status.connected ? 'is-connected' : ''}`}>{status.connected ? <BadgeCheck className="h-7 w-7" /> : <Link2 className="h-7 w-7" />}</div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StepCard number="01" title="Autoriza" detail="Inicia sesión en Mercado Pago" ready={status.connected} />
            <StepCard number="02" title="Protegemos" detail="Guardamos el token solo en backend" ready={status.connected} />
            <StepCard number="03" title="Cobra" detail="Planes y webhooks sincronizados" ready={status.connected && tokenHealthy} />
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void connect()} disabled={connecting || loading} className="cg-mp-primary">
              {connecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : status.connected ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {connecting ? 'Abriendo Mercado Pago…' : status.connected ? 'Cambiar cuenta vinculada' : 'Vincular mi cuenta de Mercado Pago'}
              {!connecting && <ArrowUpRight className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => void reload()} disabled={loading} className="cg-quiet-button"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
            {status.connected && <button type="button" onClick={() => void disconnect()} disabled={disconnecting} className="cg-danger-quiet"><Unplug className="h-4 w-4" />{disconnecting ? 'Desvinculando…' : 'Desvincular'}</button>}
          </div>
        </section>

        <section className="cg-panel-card p-5 md:p-7">
          <span className="cg-eyebrow"><Webhook className="h-3.5 w-3.5" /> Preparación técnica</span>
          <h2 className="mt-3 text-xl font-black tracking-tight text-[var(--cg-text)]">Todo el circuito queda conectado</h2>
          <div className="mt-5 space-y-3">
            <ReadinessRow icon={ShieldCheck} title="Credenciales fuera del navegador" detail="Solo las Edge Functions pueden leerlas." />
            <ReadinessRow icon={RefreshCw} title="Token renovable" detail="Se actualiza antes de vencer sin interrumpir cobros." />
            <ReadinessRow icon={Webhook} title="Webhook verificado" detail="Confirma monto, moneda, plan y referencia." />
          </div>
          <div className="mt-5 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-bg-soft)] p-4">
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-[var(--cg-muted)]">URL de redirección OAuth</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-[10px] text-[var(--cg-text)]">{callbackUrl}</code>
              <button onClick={() => void copyCallback()} className="cg-copy-button" aria-label="Copiar URL OAuth">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
            </div>
          </div>
        </section>
      </div>

      <section className="cg-info-strip">
        <div className="cg-connection-icon is-connected"><ShieldCheck className="h-6 w-6" /></div>
        <div><p className="font-black text-[var(--cg-text)]">Conexión exclusiva de la plataforma</p><p className="mt-1 text-[11px] leading-relaxed text-[var(--cg-muted)]">Los administradores de centrales pueden pagar sus planes, pero solo un administrador global puede cambiar la cuenta que recibe el dinero.</p></div>
      </section>
    </div>
  );
};

const StepCard = ({ number, title, detail, ready }: { number: string; title: string; detail: string; ready: boolean }) => (
  <div className={`cg-step-card ${ready ? 'is-ready' : ''}`}>
    <div className="flex items-center justify-between"><span>{number}</span>{ready && <CheckCircle2 className="h-4 w-4" />}</div>
    <strong>{title}</strong><small>{detail}</small>
  </div>
);

const ReadinessRow = ({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-bg-soft)] p-3.5">
    <div className="mt-0.5 rounded-xl bg-[var(--cg-primary-soft)] p-2 text-[var(--cg-primary)]"><Icon className="h-4 w-4" /></div>
    <div><p className="text-xs font-black text-[var(--cg-text)]">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-[var(--cg-muted)]">{detail}</p></div>
  </div>
);
