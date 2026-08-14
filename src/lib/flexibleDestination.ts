const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const isFlexibleDestinationAddress = (address: string | null | undefined) => {
  const value = normalize(address);
  if (!value) return true;
  return (
    value === 'a convenir' ||
    value.startsWith('a convenir /') ||
    value.includes('taximetro') ||
    value.includes('destino a convenir') ||
    value === 'por definir'
  );
};

export const isValidMapCoordinate = (lat: number | null | undefined, lng: number | null | undefined) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180 &&
  !(Number(lat) === 0 && Number(lng) === 0);
