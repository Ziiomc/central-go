import type { DispatchMode } from '../types';

const key = (companyId: string) => `centralgo:operator-dispatch-mode:v1:${companyId}`;

export const readOperatorDispatchMode = (companyId: string): DispatchMode => {
  if (typeof window === 'undefined') return 'manual';
  try {
    return window.localStorage.getItem(key(companyId)) === 'automatic' ? 'automatic' : 'manual';
  } catch {
    return 'manual';
  }
};

export const saveOperatorDispatchMode = (companyId: string, mode: DispatchMode) => {
  try { window.localStorage.setItem(key(companyId), mode); } catch { /* preference remains for this session */ }
  window.dispatchEvent(new CustomEvent('centralgo:dispatch-mode', { detail: { companyId, mode } }));
};

