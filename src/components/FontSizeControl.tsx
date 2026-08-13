import React, { useEffect, useState } from 'react';
import { Type } from 'lucide-react';

type FontSizeMode = 'normal' | 'large' | 'xlarge';

const STORAGE_KEY = 'central-go-font-size';

const readInitialMode = (): FontSizeMode => {
  if (typeof window === 'undefined') return 'normal';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'large' || saved === 'xlarge' ? saved : 'normal';
};

const applyMode = (mode: FontSizeMode) => {
  document.documentElement.dataset.cgFontSize = mode;
  window.localStorage.setItem(STORAGE_KEY, mode);
};

export const FontSizeControl: React.FC = () => {
  const [mode, setMode] = useState<FontSizeMode>(readInitialMode);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  return (
    <label
      className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-300"
      title="Cambiar tamaño de las letras"
    >
      <Type className="h-4 w-4 shrink-0 text-blue-300" />
      <select
        aria-label="Tamaño de letra"
        value={mode}
        onChange={(event) => setMode(event.target.value as FontSizeMode)}
        className="max-w-[88px] bg-transparent text-[10px] font-black text-zinc-200 outline-none sm:max-w-[110px]"
      >
        <option value="normal" className="bg-zinc-950">Letra normal</option>
        <option value="large" className="bg-zinc-950">Letra grande</option>
        <option value="xlarge" className="bg-zinc-950">Muy grande</option>
      </select>
    </label>
  );
};
