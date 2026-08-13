import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { readDriverInviteTokenFromUrl, readRememberedDriverInviteToken } from '../../lib/driverInvite';
import { DriverInviteAcceptGate } from '../auth/DriverInviteAcceptGate';
import { DriverOnboardingPortal as MarketplacePortal } from './DriverOnboardingPortalEnhanced';

const MarketplacePortalWithValidationFeedback: React.FC = () => {
  const [visibleError, setVisibleError] = useState('');
  const invalidCycle = useRef(false);

  useEffect(() => {
    const mirrorPageError = () => {
      const modal = document.querySelector('.cg-driver-application-modal');
      if (!modal) return;
      const error = Array.from(document.querySelectorAll<HTMLElement>('.cg-alert-error'))
        .find((element) => !modal.contains(element));
      const message = error?.textContent?.trim();
      if (message) setVisibleError(message);
    };
    mirrorPageError();
    const observer = new MutationObserver(mirrorPageError);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const handleInvalid = (event: React.InvalidEvent<HTMLElement>) => {
    event.preventDefault();
    if (invalidCycle.current) return;
    invalidCycle.current = true;
    window.setTimeout(() => { invalidCycle.current = false; }, 400);

    const control = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const label = control.closest('label')?.querySelector('span')?.textContent?.trim()
      || control.getAttribute('aria-label')
      || 'un dato obligatorio';
    setVisibleError(`Falta completar ${label}. Revisa ese dato y vuelve a enviar la solicitud.`);
    window.requestAnimationFrame(() => {
      control.scrollIntoView({ behavior: 'smooth', block: 'center' });
      control.focus({ preventScroll: true });
    });
  };

  return (
    <div onInvalidCapture={handleInvalid} onInputCapture={() => { if (visibleError.startsWith('Falta completar')) setVisibleError(''); }}>
      {visibleError && (
        <div role="alert" aria-live="assertive" className="fixed bottom-4 left-1/2 z-[160] flex w-[min(92vw,520px)] -translate-x-1/2 items-start gap-2 rounded-2xl border border-rose-400/35 bg-[#211014]/95 px-4 py-3 text-xs font-bold leading-relaxed text-rose-100 shadow-2xl backdrop-blur-xl">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <span className="flex-1">{visibleError}</span>
          <button type="button" onClick={() => setVisibleError('')} className="rounded-lg px-2 py-0.5 text-rose-200/70" aria-label="Cerrar aviso">×</button>
        </div>
      )}
      <MarketplacePortal />
    </div>
  );
};

export const DriverOnboardingPortal: React.FC = () => {
  const token = readDriverInviteTokenFromUrl() || readRememberedDriverInviteToken();
  return token ? <DriverInviteAcceptGate token={token} /> : <MarketplacePortalWithValidationFeedback />;
};
