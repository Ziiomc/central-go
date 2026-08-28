import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { History, Loader2, MapPin, UserRound } from 'lucide-react';
import { suggestCommercialAddresses, type GeocodedAddress } from '../../lib/geocoding';
import { searchAddressHistory, type CachedAddress } from '../../lib/addressHistoryCache';

interface AddressAutocompleteProps {
  companyId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputClassName: string;
  required?: boolean;
  iconClassName?: string;
  onSelectHistory?: (entry: CachedAddress) => void;
}

export const AddressAutocomplete = forwardRef<HTMLInputElement, AddressAutocompleteProps>(({
  companyId,
  label,
  value,
  onChange,
  placeholder,
  inputClassName,
  required = false,
  iconClassName = 'text-blue-300',
  onSelectHistory,
}, forwardedRef) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodedAddress[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    const term = value.trim();
    if (!focused || term.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void suggestCommercialAddresses(companyId, term)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [companyId, focused, value]);

  const choose = (suggestion: GeocodedAddress) => {
    onChange(suggestion.displayName);
    setSuggestions([]);
    setFocused(false);
    setActiveIndex(-1);
  };

  const chooseHistory = (entry: CachedAddress) => {
    onChange(entry.address);
    onSelectHistory?.(entry);
    setSuggestions([]);
    setFocused(false);
    setActiveIndex(-1);
  };

  const historySuggestions = focused && value.trim().length >= 2
    ? searchAddressHistory(companyId, value, 6)
    : [];
  const cachedNames = new Set(historySuggestions.map((entry) => entry.address.trim().toLocaleLowerCase('es-CL')));
  const remoteSuggestions = suggestions.filter((entry) => !cachedNames.has(entry.displayName.trim().toLocaleLowerCase('es-CL')));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!remoteSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % remoteSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? remoteSuggestions.length - 1 : current - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(remoteSuggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  const open = focused && value.trim().length >= 2 && (historySuggestions.length > 0 || loading || remoteSuggestions.length > 0);

  return <div className="relative space-y-1 md:col-span-2">
    <label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><MapPin className={`h-3.5 w-3.5 ${iconClassName}`} />{label}{required ? ' *' : ''}</label>
    <div className="relative">
      <input
        id={inputId}
        ref={inputRef}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        className={`${inputClassName} pr-10`}
      />
      {loading ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-cyan-300" /> : <MapPin className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-700" />}
      {open && <div id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-56 overflow-y-auto rounded-xl border border-cyan-400/25 bg-[#11151a] p-1.5 shadow-2xl shadow-black/70">
        {historySuggestions.length > 0 ? <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-1 text-[8px] font-black uppercase tracking-wider text-amber-300"><History className="h-3 w-3" />Usadas anteriormente</p> : null}
        {historySuggestions.map((entry) => {
          const contact = entry.contacts?.[0];
          return <button
            key={`history-${entry.address}`}
            type="button"
            role="option"
            aria-selected="false"
            onMouseDown={(event) => { event.preventDefault(); chooseHistory(entry); }}
            className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-amber-400/[0.06]"
          >
            <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold leading-relaxed text-zinc-100">{entry.address}</span>{contact ? <span className="mt-0.5 flex items-center gap-1 truncate text-[8px] text-zinc-500"><UserRound className="h-2.5 w-2.5" />{contact.name || 'Cliente'}{contact.phone ? ` · ${contact.phone}` : ''}</span> : null}</span>
            <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[7px] font-black text-amber-200">{entry.uses}×</span>
          </button>;
        })}
        {remoteSuggestions.length > 0 ? <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[8px] font-black uppercase tracking-wider text-cyan-300"><MapPin className="h-3 w-3" />Resultados del mapa</p> : null}
        {remoteSuggestions.map((suggestion, index) => <button
          id={`${listId}-${index}`}
          key={`${suggestion.lat}-${suggestion.lng}-${suggestion.displayName}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => { event.preventDefault(); choose(suggestion); }}
          className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${index === activeIndex ? 'bg-cyan-400/10' : 'hover:bg-white/[0.04]'}`}
        >
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <span className="min-w-0 text-[10px] font-bold leading-relaxed text-zinc-200">{suggestion.displayName}</span>
        </button>)}
        {loading && !remoteSuggestions.length ? <p className="px-3 py-3 text-center text-[10px] text-zinc-500">Buscando calles y lugares cercanos…</p> : null}
      </div>}
    </div>
    <span className="block text-[8px] text-zinc-600">Busca calles, hospitales, plazas, terminales y otros lugares de la ciudad.</span>
  </div>;
});

AddressAutocomplete.displayName = 'AddressAutocomplete';
