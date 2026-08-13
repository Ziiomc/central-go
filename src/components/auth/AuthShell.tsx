import React from 'react';
import { CheckCircle2, RadioTower, Route, ShieldCheck } from 'lucide-react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { ThemeToggle } from './ThemeToggle';

interface AuthShellProps extends React.PropsWithChildren {
  eyebrow?: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  children,
  eyebrow = 'La operación completa, en movimiento',
  title = 'Una cuenta. Tres formas de avanzar.',
  description = 'Centrales, conductores y socios comerciales conectados en una plataforma de despacho profesional.',
  compact = false,
}) => (
  <main className="cg-auth-shell">
    <div className="cg-auth-grid" aria-hidden="true" />
    <header className="cg-auth-header">
      <a href="/" className="cg-brand" aria-label="Central GO, inicio">
        <img src={centralGoLogo} alt="" className="h-11 w-11 rounded-xl" />
        <span><strong>CENTRAL</strong> GO</span>
      </a>
      <ThemeToggle />
    </header>

    <div className={`cg-auth-content ${compact ? 'cg-auth-content-compact' : ''}`}>
      {!compact && (
        <aside className="cg-auth-story">
          <span className="cg-kicker"><RadioTower className="h-4 w-4" /> {eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="cg-story-points">
            <div><Route /><span><strong>Despacho inteligente</strong><small>Viajes, flota y GPS en tiempo real.</small></span></div>
            <div><ShieldCheck /><span><strong>Accesos por rol</strong><small>Cada persona ve solamente lo que necesita.</small></span></div>
            <div><CheckCircle2 /><span><strong>5 días Full</strong><small>Las centrales prueban la operación completa.</small></span></div>
          </div>
          <p className="cg-story-note">Tecnología para centrales que quieren competir sin perder su identidad.</p>
        </aside>
      )}
      <section className="cg-auth-card">{children}</section>
    </div>

    <footer className="cg-auth-footer">
      <span>Central GO · Despacho profesional</span>
      <a href="mailto:ziiomc3@gmail.com">Contacto: ziiomc3@gmail.com</a>
    </footer>
  </main>
);

