import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface CentralGoBackDetail {
  handled: boolean;
}

const isMobileOrStandalone = () => {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return Boolean(standalone || mobile);
};

const guardState = () => ({
  ...(window.history.state ?? {}),
  centralgoAuthenticated: true,
  centralgoBackGuard: true,
});

/**
 * Android/iOS can navigate back to the pre-login history entry even though the
 * Supabase session is still valid. Keep one same-document sentinel while the
 * user is authenticated, let the active UI consume Back (modal/module), and
 * only leave the app when there is nothing internal to close.
 */
export const SessionBackGuard: React.FC = () => {
  const { session } = useAuth();

  useEffect(() => {
    if (!session || !isMobileOrStandalone()) return;

    const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({ ...(window.history.state ?? {}), centralgoAuthenticated: true }, document.title, url);
    window.history.pushState(guardState(), document.title, url);

    const onPopState = () => {
      const detail: CentralGoBackDetail = { handled: false };
      window.dispatchEvent(new CustomEvent<CentralGoBackDetail>('centralgo:hardware-back', { detail }));

      window.setTimeout(() => {
        if (detail.handled) {
          const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.history.pushState(guardState(), document.title, currentUrl);
          return;
        }
        // Nothing inside Central GO consumed Back: preserve normal phone/PWA exit behavior.
        window.history.back();
      }, 0);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [session?.user.id]);

  return null;
};
