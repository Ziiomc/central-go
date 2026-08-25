export interface DriverIdentityInput {
  name: string;
  phone: string;
  nationalIdNumber: string;
  address: string;
}

const compactDocument = (value: string) => value.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');

export const isValidChileanRut = (value: string) => {
  const clean = compactDocument(value).replace(/[^0-9K]/g, '');
  if (!/^[0-9]{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const digit = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  const expected = result === 11 ? '0' : result === 10 ? 'K' : String(result);
  return digit === expected;
};

export const normalizeIdentityDocument = (value: string, countryCode = 'CL') => {
  const raw = value.trim().toUpperCase();
  if (countryCode.toUpperCase() !== 'CL') return raw;
  const clean = compactDocument(raw).replace(/[^0-9K]/g, '');
  if (clean.length < 2) return raw;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
};

export const validateDriverIdentity = (input: DriverIdentityInput, countryCode = 'CL') => {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 5 || !name.includes(' ')) return 'Ingresa tu nombre completo y al menos un apellido.';
  if (input.phone.replace(/\D/g, '').length < 8) return 'Ingresa un teléfono válido.';
  if (input.address.trim().length < 5) return 'Ingresa tu dirección particular.';
  if (countryCode.toUpperCase() === 'CL') {
    if (!isValidChileanRut(input.nationalIdNumber)) return 'Ingresa un RUT chileno válido.';
  } else if (compactDocument(input.nationalIdNumber).length < 3) {
    return 'Ingresa tu documento de identidad.';
  }
  return '';
};
