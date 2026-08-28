import type { Trip } from '../types';

export type CachedAddress = {
  address: string;
  uses: number;
  lastUsedAt: number;
  contacts?: CachedAddressContact[];
};

export type CachedAddressContact = {
  name: string;
  phone: string;
  uses: number;
  lastUsedAt: number;
};

export type AddressHistoryContact = { name?: string; phone?: string };

const MAX_ADDRESSES = 120;
const cacheKey = (companyId: string) => `centralgo:address-history:v1:${companyId}`;

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('es-CL')
  .replace(/\s+/g, ' ');

const usable = (value: string) => {
  const clean = value.trim();
  return clean.length >= 3 && !/^a convenir/i.test(clean) && !/^sin (direcci[oó]n|destino)/i.test(clean);
};

const cleanContact = (contact?: AddressHistoryContact): { name: string; phone: string } | null => {
  const name = contact?.name?.trim().replace(/\s+/g, ' ') ?? '';
  const phone = contact?.phone?.trim().replace(/\s+/g, ' ') ?? '';
  if (!name && !phone) return null;
  if (/^cliente particular$/i.test(name) && /^sin tel[eé]fono$/i.test(phone)) return null;
  return { name, phone };
};

const contactKey = (contact: { name: string; phone: string }) => `${normalize(contact.name)}|${contact.phone.replace(/\D/g, '')}`;

const rememberContact = (contacts: CachedAddressContact[] | undefined, contact: AddressHistoryContact | undefined, usedAt: number, increment = true) => {
  const clean = cleanContact(contact);
  const current = Array.isArray(contacts) ? contacts.filter((item) => item && (item.name || item.phone)) : [];
  if (!clean) return current.slice(0, 8);
  const byContact = new Map(current.map((item) => [contactKey(item), item]));
  const previous = byContact.get(contactKey(clean));
  byContact.set(contactKey(clean), {
    ...clean,
    uses: previous ? previous.uses + (increment ? 1 : 0) : 1,
    lastUsedAt: Math.max(previous?.lastUsedAt ?? 0, usedAt),
  });
  return [...byContact.values()]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.uses - a.uses)
    .slice(0, 8);
};

export const loadAddressHistory = (companyId: string): CachedAddress[] => {
  if (!companyId || companyId === 'network' || typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey(companyId)) || '[]') as CachedAddress[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && usable(item.address)).map((item) => ({
          ...item,
          contacts: Array.isArray(item.contacts) ? item.contacts.filter((contact) => contact && (contact.name || contact.phone)).slice(0, 8) : [],
        })).slice(0, MAX_ADDRESSES)
      : [];
  } catch {
    return [];
  }
};

const saveAddressHistory = (companyId: string, rows: CachedAddress[]) => {
  try {
    window.localStorage.setItem(cacheKey(companyId), JSON.stringify(rows.slice(0, MAX_ADDRESSES)));
  } catch {
    // La búsqueda sigue funcionando con las direcciones de la sesión aunque el navegador bloquee storage.
  }
};

export const rememberAddressHistory = (
  companyId: string,
  addresses: string[],
  options: { usedAt?: number; contact?: AddressHistoryContact } = {},
) => {
  if (!companyId || companyId === 'network') return;
  const usedAt = options.usedAt ?? Date.now();
  const current = loadAddressHistory(companyId);
  const byAddress = new Map(current.map((item) => [normalize(item.address), item]));

  addresses.filter(usable).forEach((raw) => {
    const address = raw.trim().replace(/\s+/g, ' ');
    const key = normalize(address);
    const previous = byAddress.get(key);
    byAddress.set(key, {
      address,
      uses: (previous?.uses ?? 0) + 1,
      lastUsedAt: Math.max(previous?.lastUsedAt ?? 0, usedAt),
      contacts: rememberContact(previous?.contacts, options.contact, usedAt),
    });
  });

  saveAddressHistory(companyId, [...byAddress.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.uses - a.uses));
};

export const seedAddressHistoryFromTrips = (companyId: string, trips: Trip[]) => {
  if (!trips.length) return;
  const current = loadAddressHistory(companyId);
  const byAddress = new Map(current.map((item) => [normalize(item.address), item]));

  trips.forEach((trip) => {
    const timestamp = new Date(trip.createdAt).getTime() || Date.now();
    [trip.origin.address, trip.destination.address].filter(usable).forEach((raw) => {
      const address = raw.trim().replace(/\s+/g, ' ');
      const key = normalize(address);
      const previous = byAddress.get(key);
      byAddress.set(key, {
        address,
        uses: Math.max(1, (previous?.uses ?? 0) + (previous ? 0 : 1)),
        lastUsedAt: Math.max(previous?.lastUsedAt ?? 0, timestamp),
        contacts: rememberContact(previous?.contacts, { name: trip.clientName, phone: trip.clientPhone }, timestamp, false),
      });
    });
  });

  saveAddressHistory(companyId, [...byAddress.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.uses - a.uses));
};

export const searchAddressHistory = (companyId: string, query: string, limit = 6): CachedAddress[] => {
  const term = normalize(query);
  if (term.length < 2) return [];
  const words = term.split(' ').filter(Boolean);

  return loadAddressHistory(companyId)
    .map((item) => {
      const candidate = normalize(item.address);
      const contactText = normalize((item.contacts ?? []).map((contact) => `${contact.name} ${contact.phone}`).join(' '));
      let score = 100;
      if (candidate === term) score = 0;
      else if (candidate.startsWith(term)) score = 5;
      else if (candidate.includes(term)) score = 12;
      else if (words.every((word) => candidate.includes(word))) score = 20;
      else if (words.some((word) => word.length >= 3 && candidate.includes(word))) score = 35;
      else if (contactText.includes(term)) score = 40;
      else if (words.some((word) => word.length >= 3 && contactText.includes(word))) score = 48;
      return { item, score };
    })
    .filter(({ score }) => score < 100)
    .sort((a, b) => a.score - b.score || b.item.uses - a.item.uses || b.item.lastUsedAt - a.item.lastUsedAt)
    .slice(0, limit)
    .map(({ item }) => item);
};
