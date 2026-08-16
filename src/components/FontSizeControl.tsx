import React, { useEffect, useMemo, useState } from 'react';
import { Type } from 'lucide-react';
import {
  applyFontSizeMode,
  FONT_SIZE_OPTIONS,
  readFontSizeMode,
  type FontSizeMode,
} from '../lib/fontSizePreference';

export const FontSizeControl: React.FC = () => {
  const [mode, setMode] = useState<FontSizeMode>(readFontSizeMode);
  const activeOption = useMemo(() => FONT_SIZE_OPTIONS.find((option) => option.value === mode) ?? FONT_SIZE_OPTIONS[0], [mode]);

  useEffect(() => {
    applyFontSizeMode(mode);
  }, [mode]);

  return (
    <div className="w-full sm:w-auto" aria-label="Tamaño de letra">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
        <Type className="h-4 w-4 text-blue-300" />
        Tamaño de letra
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1.5">
        {FONT_SIZE_OPTIONS.map((option) => {
          const active = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setMode(option.value)}
              className={`min-w-[76px] rounded-lg px-3 py-2 text-center transition ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              <span className={`block font-black ${option.value === 'normal' ? 'text-sm' : option.value === 'large' ? 'text-base' : 'text-lg'}`}>{option.shortLabel}</span>
              <span className="mt-0.5 block text-[9px] font-bold">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 max-w-sm text-[10px] leading-relaxed text-zinc-500">{activeOption.description}</p>
    </div>
  );
};
