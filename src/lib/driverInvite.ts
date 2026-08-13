import { runtimeConfig } from '../config/runtime';

export const DRIVER_INVITE_PARAM = 'driver_invite';
export const DRIVER_INVITE_STORAGE_KEY = 'centralgo:driver-invite';

const normalizeInviteCode = (value: string | null | undefined) => {
  const code = (value ?? '').trim();
  if (!code || code.length > 80 || !/^[\p{L}\p{N}._-]+$/u.test(code)) return null;
  return code;
};

export const rememberDriverInviteCode = (value: string | null | undefined) => {
  const code = normalizeInviteCode(value);
  if (typeof window === 'undefined' || !code) return null;
  window.localStorage.setItem(DRIVER_INVITE_STORAGE_KEY, code);
  return code;
};

export const readDriverInviteCodeFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const code = normalizeInviteCode(new URLSearchParams(window.location.search).get(DRIVER_INVITE_PARAM));
  if (code) rememberDriverInviteCode(code);
  return code;
};

export const readRememberedDriverInviteCode = () => {
  if (typeof window === 'undefined') return null;
  return normalizeInviteCode(window.localStorage.getItem(DRIVER_INVITE_STORAGE_KEY));
};

export const buildDriverInviteUrl = (companyCode: string) => {
  const code = normalizeInviteCode(companyCode);
  if (!code) throw new Error('La central no tiene un código válido para generar invitaciones.');
  const url = new URL(runtimeConfig.officialAppUrl);
  url.searchParams.set(DRIVER_INVITE_PARAM, code);
  return url.toString();
};

export const clearDriverInvite = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DRIVER_INVITE_STORAGE_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete(DRIVER_INVITE_PARAM);
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
};
