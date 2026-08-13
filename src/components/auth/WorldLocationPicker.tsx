import React, { useEffect, useMemo, useState } from 'react';
import { Globe2, Loader2, MapPinned } from 'lucide-react';

type CountryOption = { code: string; name: string; cityCount: number };
type CityOption = { name: string; region: string };
type CountryLocations = { code: string; name: string; regions: string[]; cities: CityOption[] };

export interface WorldLocationValue {
  countryCode: string;
  countryName: string;
  region: string;
  regionCode: string;
  city: string;
}

interface WorldLocationPickerProps {
  value: WorldLocationValue;
  onChange: (value: WorldLocationValue) => void;
  required?: boolean;
}

const flag = (countryCode: string) => countryCode
  .toUpperCase()
  .replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt(0)));
const cityKey = (city: CityOption) => `${city.name}|${city.region}`;

const loadCountries = async () => {
  const response = await fetch('/data/world-locations/countries.json');
  if (!response.ok) throw new Error('No fue posible cargar los países.');
  return response.json() as Promise<CountryOption[]>;
};

const loadCountry = async (countryCode: string) => {
  const response = await fetch(`/data/world-locations/${countryCode}.json`);
  if (!response.ok) throw new Error('No fue posible cargar las ciudades del país.');
  return response.json() as Promise<CountryLocations>;
};

export const WorldCountrySelect: React.FC<{
  value: string;
  onChange: (countryCode: string) => void;
  required?: boolean;
  label?: string;
}> = ({ value, onChange, required = true, label = 'País emisor' }) => {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  useEffect(() => {
    let active = true;
    void loadCountries().then((items) => { if (active) setCountries(items); });
    return () => { active = false; };
  }, []);
  return (
    <label className="cg-field">
      <span>{label}</span>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} disabled={!countries.length}>
        <option value="">Selecciona un país</option>
        {countries.map((country) => <option key={country.code} value={country.code}>{flag(country.code)} {country.name}</option>)}
      </select>
    </label>
  );
};

export const WorldCitySelect: React.FC<{
  countryCode: string;
  value: string;
  onChange: (city: string) => void;
  required?: boolean;
  label?: string;
  allowAll?: boolean;
}> = ({ countryCode, value, onChange, required = false, label = 'Ciudad', allowAll = true }) => {
  const [locations, setLocations] = useState<CountryLocations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!countryCode) {
      setLocations(null);
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    void loadCountry(countryCode)
      .then((nextLocations) => { if (active) setLocations(nextLocations); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No fue posible cargar las ciudades.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [countryCode]);

  const cities = locations?.cities ?? [];
  return (
    <label className="cg-field">
      <span><MapPinned className="h-3.5 w-3.5" /> {label}</span>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} disabled={loading || !countryCode || !cities.length}>
        <option value="">{loading ? 'Cargando ciudades reales…' : allowAll ? `Todas las ciudades (${cities.length.toLocaleString('es-CL')})` : `Selecciona una ciudad (${cities.length.toLocaleString('es-CL')})`}</option>
        {cities.map((city) => <option key={cityKey(city)} value={city.name}>{city.name}{city.region ? ` · ${city.region}` : ''}</option>)}
      </select>
      {error && <small className="cg-field-error">{error}</small>}
    </label>
  );
};

export const WorldLocationPicker: React.FC<WorldLocationPickerProps> = ({ value, onChange, required = true }) => {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryLocations, setCountryLocations] = useState<CountryLocations | null>(null);
  const [selectedCityKey, setSelectedCityKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const code = value.countryCode || 'CL';
    setLoading(true);
    void Promise.all([loadCountries(), loadCountry(code)])
      .then(([nextCountries, nextLocations]) => {
        if (!active) return;
        setCountries(nextCountries);
        setCountryLocations(nextLocations);
        if (value.city) {
          const existingCity = nextLocations.cities.find((city) => city.name === value.city && (!value.region || city.region === value.region));
          setSelectedCityKey(existingCity ? cityKey(existingCity) : '');
        }
        if (!value.countryCode) onChange({ ...value, countryCode: code, countryName: nextLocations.name });
        setError('');
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No pudimos cargar el directorio mundial de ciudades.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Initial data load only. Country changes are handled explicitly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCountry = async (countryCode: string) => {
    const selectedCountry = countries.find((country) => country.code === countryCode);
    if (!selectedCountry) return;
    setLoading(true);
    setError('');
    try {
      const nextLocations = await loadCountry(countryCode);
      setCountryLocations(nextLocations);
      setSelectedCityKey('');
      onChange({ countryCode, countryName: selectedCountry.name, region: '', regionCode: '', city: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las ciudades.');
    } finally {
      setLoading(false);
    }
  };

  const regions = countryLocations?.regions ?? [];
  const cities = countryLocations?.cities ?? [];
  const visibleCities = useMemo(
    () => value.region ? cities.filter((city) => city.region === value.region) : cities,
    [cities, value.region],
  );

  const changeRegion = (region: string) => {
    setSelectedCityKey('');
    onChange({ ...value, region, regionCode: region, city: '' });
  };

  const changeCity = (key: string) => {
    setSelectedCityKey(key);
    const selectedCity = cities.find((city) => cityKey(city) === key);
    if (!selectedCity) return;
    onChange({ ...value, city: selectedCity.name, region: selectedCity.region, regionCode: selectedCity.region });
  };

  return (
    <div className="cg-location-picker">
      <div className="cg-form-row">
        <label className="cg-field">
          <span><Globe2 className="h-3.5 w-3.5" /> País</span>
          <select required={required} value={value.countryCode} onChange={(event) => void changeCountry(event.target.value)} disabled={loading || !countries.length}>
            <option value="">Selecciona un país</option>
            {countries.map((country) => <option key={country.code} value={country.code}>{flag(country.code)} {country.name}</option>)}
          </select>
        </label>
        <label className="cg-field">
          <span>Región / estado</span>
          <select value={value.region} onChange={(event) => changeRegion(event.target.value)} disabled={loading || !regions.length}>
            <option value="">{regions.length ? 'Todas las regiones' : 'No aplica'}</option>
            {regions.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
        </label>
      </div>
      <label className="cg-field">
        <span><MapPinned className="h-3.5 w-3.5" /> Ciudad</span>
        <select required={required} value={selectedCityKey} onChange={(event) => changeCity(event.target.value)} disabled={loading || !cities.length}>
          <option value="">{loading ? 'Cargando ciudades reales…' : `Selecciona una ciudad (${visibleCities.length.toLocaleString('es-CL')} disponibles)`}</option>
          {visibleCities.map((city) => <option key={cityKey(city)} value={cityKey(city)}>{city.name}{city.region ? ` · ${city.region}` : ''}</option>)}
        </select>
      </label>
      {loading && <p className="cg-auth-hint flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando el directorio internacional…</p>}
      {error && <div className="cg-alert cg-alert-error mt-2">{error}</div>}
      <p className="cg-location-attribution">Datos geográficos: <a href="https://simplemaps.com/data/world-cities" target="_blank" rel="noreferrer">SimpleMaps World Cities Database</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</p>
    </div>
  );
};
