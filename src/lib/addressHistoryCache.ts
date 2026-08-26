import type { Trip } from '../types';

export type CachedAddress = {
  address: string;
  uses: number;
  lastUsedAt: number;
};

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

export const loadAddressHistory = (companyId: string): CachedAddress[] => {
  if (!companyId || companyId === 'network' || typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey(companyId)) || '[]') as CachedAddress[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && usable(item.address)).slice(0, MAX_ADDRESSES)
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

export const rememberAddressHistory = (companyId: string, addresses: string[], usedAt = Date.now()) => {
  if (!companyId || companyId === 'network') return;
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
      let score = 100;
      if (candidate === term) score = 0;
      else if (candidate.startsWith(term)) score = 5;
      else if (candidate.includes(term)) score = 12;
      else if (words.every((word) => candidate.includes(word))) score = 20;
      else if (words.some((word) => word.length >= 3 && candidate.includes(word))) score = 35;
      return { item, score };
    })
    .filter(({ score }) => score < 100)
    .sort((a, b) => a.score - b.score || b.item.uses - a.item.uses || b.item.lastUsedAt - a.item.lastUsedAt)
    .slice(0, limit)
    .map(({ item }) => item);
};
