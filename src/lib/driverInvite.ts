import { runtimeConfig } from '../config/runtime';
import { requireSupabase } from './supabase';

export const DRIVER_INVITE_PARAM = 'driver_invite';
export const DRIVER_INVITE_STORAGE_KEY = 'centralgo:driver-invite';

export interface DriverInviteTarget {
  companyId: string;
  companyName: string;
  companyCode: string;
  city: string;
  countryCode: string;
  valid: boolean;
  documentsRequired: boolean;
  immediateAccess: boolean;
}

export interface DriverRecruitmentLink extends DriverInviteTarget {
  token: string;
  url: string;
  usesCount: number;
}

export interface DriverInviteIdentity {
  name: string;
  phone: string;
  nationalIdNumber: string;
  address: string;
}

const backendErrorMessage = (value: unknown, fallback: string) => {
  let message = '';
  let code = '';
  if (value instanceof Error) message = value.message.trim();
  else if (value && typeof value === 'object') {
    if ('message' in value && typeof (value as { message?: unknown }).message === 'string') {
      message = String((value as { message: string }).message).trim();
    }
    if ('code' in value && typeof (value as { code?: unknown }).code === 'string') {
      code = String((value as { code: string }).code).trim();
    }
  }
  if (/RUT o documento ya está registrado en la central/i.test(message) || /ya está registrado en la central/i.test(message) || code === '23505') {
    return 'Este RUT o documento ya tiene un conductor registrado en esta central. Ingresa con la cuenta Google que ya estaba asociada o pide al administrador que reasigne ese móvil a tu nueva cuenta.';
  }
  return message || fallback;
};

const normalizeInviteToken = (value: string | null | undefined) => {
  const token = (value ?? '').trim();
  if (token.length < 48 || token.length > 160 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
};

export const rememberDriverInviteToken = (value: string | null | undefined) => {
  const token = normalizeInviteToken(value);
  if (typeof window === 'undefined' || !token) return null;
  window.localStorage.setItem(DRIVER_INVITE_STORAGE_KEY, token);
  return token;
};

export const readDriverInviteTokenFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const token = normalizeInviteToken(new URLSearchParams(window.location.search).get(DRIVER_INVITE_PARAM));
  if (token) rememberDriverInviteToken(token);
  return token;
};

export const readRememberedDriverInviteToken = () => {
  if (typeof window === 'undefined') return null;
  return normalizeInviteToken(window.localStorage.getItem(DRIVER_INVITE_STORAGE_KEY));
};

export const buildDriverInviteUrl = (value: string) => {
  const token = normalizeInviteToken(value);
  if (!token) throw new Error('El enlace privado de la central no es válido.');
  const url = new URL(runtimeConfig.officialAppUrl);
  url.searchParams.set(DRIVER_INVITE_PARAM, token);
  return url.toString();
};

export const getDriverRecruitmentLink = async (companyId: string, rotate = false): Promise<DriverRecruitmentLink> => {
  const { data, error } = await requireSupabase().rpc('centralgo_get_driver_recruitment_link', {
    p_company_id: companyId,
    p_rotate: rotate,
  });
  if (error) throw new Error(backendErrorMessage(error, 'No fue posible generar el enlace privado de conductores.'));
  const token = normalizeInviteToken(data?.token);
  if (!token) throw new Error('No fue posible generar el enlace privado de conductores.');
  return {
    companyId: data.companyId,
    companyName: data.companyName,
    companyCode: data.companyCode,
    city: '',
    countryCode: '',
    valid: true,
    documentsRequired: false,
    immediateAccess: true,
    token,
    url: buildDriverInviteUrl(token),
    usesCount: Number(data.usesCount ?? 0),
  };
};

export const resolveDriverInvite = async (value: string): Promise<DriverInviteTarget | null> => {
  const token = normalizeInviteToken(value);
  if (!token) return null;
  const { data, error } = await requireSupabase().rpc('centralgo_resolve_driver_recruitment_link', { p_token: token });
  if (error) throw new Error(backendErrorMessage(error, 'No fue posible validar la invitación.'));
  if (!data?.valid) return null;
  return {
    companyId: data.companyId,
    companyName: data.companyName,
    companyCode: data.companyCode,
    city: data.city ?? '',
    countryCode: data.countryCode ?? '',
    valid: true,
    documentsRequired: false,
    immediateAccess: true,
  };
};

export const acceptDriverInvite = async (value: string, identity: DriverInviteIdentity) => {
  const token = normalizeInviteToken(value);
  if (!token) throw new Error('La invitación no es válida.');
  const { data, error } = await requireSupabase().rpc('centralgo_accept_driver_recruitment_link_v2', {
    p_token: token,
    p_name: identity.name.trim(),
    p_phone: identity.phone.trim(),
    p_national_id_number: identity.nationalIdNumber.trim(),
    p_address: identity.address.trim(),
  });
  if (error) throw new Error(backendErrorMessage(error, 'No fue posible activar la invitación de la central.'));
  return data as {
    status: 'active';
    alreadyActive: boolean;
    companyId: string;
    companyName: string;
    driverId: string;
    unitNumber: string;
    documentsRequired: false;
    immediateAccess: true;
    identityComplete: true;
  };
};

export const clearDriverInvite = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DRIVER_INVITE_STORAGE_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete(DRIVER_INVITE_PARAM);
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
};

export const rememberDriverInviteCode = rememberDriverInviteToken;
export const readDriverInviteCodeFromUrl = readDriverInviteTokenFromUrl;
export const readRememberedDriverInviteCode = readRememberedDriverInviteToken;
