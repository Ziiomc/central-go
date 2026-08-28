import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface CentralGoBackDetail {
  handled: boolean;
}

const guardState = () => ({
  ...(window.history.state ?? {}),
  centralgoAuthenticated: true,
  centralgoBackGuard: true,
});

/**
 * Keep authenticated navigation inside Central GO. Back first closes the active
 * modal/module; when there is nothing internal to close, the session remains on
 * the current screen instead of returning accidentally to the pre-login page.
 */
export const SessionBackGuard: React.FC = () => {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({ ...(window.history.state ?? {}), centralgoAuthenticated: true }, document.title, url);
    window.history.pushState(guardState(), document.title, url);

    const onPopState = () => {
      const detail: CentralGoBackDetail = { handled: false };
      window.dispatchEvent(new CustomEvent<CentralGoBackDetail>('centralgo:hardware-back', { detail }));

      window.setTimeout(() => {
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.history.pushState(guardState(), document.title, currentUrl);
      }, 0);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [session?.user.id]);

  return null;
};
