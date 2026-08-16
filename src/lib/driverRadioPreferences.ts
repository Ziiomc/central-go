const DRIVER_RADIO_AUDIO_KEY = 'centralgo:driver-radio-audio-enabled';
export const DRIVER_RADIO_AUDIO_CHANGE_EVENT = 'centralgo:driver-radio-audio-change';

export const isDriverRadioAudioEnabled = () => {
  if (typeof window === 'undefined') return true;
  try { return window.localStorage.getItem(DRIVER_RADIO_AUDIO_KEY) !== '0'; }
  catch { return true; }
};

const setDriverRadioAudioEnabled = (enabled: boolean) => {
  try { window.localStorage.setItem(DRIVER_RADIO_AUDIO_KEY, enabled ? '1' : '0'); }
  catch { /* Keep the preference for this page even if storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent(DRIVER_RADIO_AUDIO_CHANGE_EVENT, { detail: { enabled } }));
};

const findProfilePanel = () => {
  if (!window.location.pathname.startsWith('/driver')) return null;
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h2'));
  const driverHeading = headings.find((heading) => heading.closest('.fixed') && heading.parentElement?.textContent?.includes('Móvil'));
  return driverHeading?.closest('section') as HTMLElement | null;
};

const createPreferenceCard = () => {
  const card = document.createElement('div');
  card.dataset.cgDriverRadioPreference = '1';
  card.className = 'mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3';

  const render = () => {
    const enabled = isDriverRadioAudioEnabled();
    card.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-black text-white">Sonidos de Radio Central</p>
          <p class="mt-0.5 text-[8px] leading-relaxed text-zinc-500">${enabled ? 'Voz de la operadora y tono de radio activados.' : 'Los mensajes seguirán visibles, pero sin voz ni tono.'}</p>
        </div>
        <button type="button" data-cg-radio-toggle="1" aria-pressed="${enabled ? 'true' : 'false'}" class="relative h-7 w-12 shrink-0 rounded-full border transition ${enabled ? 'border-blue-400/60 bg-blue-500/30' : 'border-zinc-700 bg-zinc-900'}">
          <span class="absolute top-1 h-5 w-5 rounded-full shadow transition-all ${enabled ? 'left-6 bg-blue-300' : 'left-1 bg-zinc-500'}"></span>
          <span class="sr-only">${enabled ? 'Desactivar sonidos de Radio Central' : 'Activar sonidos de Radio Central'}</span>
        </button>
      </div>
      <div class="mt-2 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2">
        <span class="text-[9px] font-bold text-zinc-400">Estado</span>
        <span class="text-[9px] font-black ${enabled ? 'text-emerald-300' : 'text-zinc-500'}">${enabled ? 'AUDIO ACTIVADO' : 'AUDIO DESACTIVADO'}</span>
      </div>`;

    card.querySelector<HTMLButtonElement>('[data-cg-radio-toggle]')?.addEventListener('click', () => {
      const next = !isDriverRadioAudioEnabled();
      setDriverRadioAudioEnabled(next);
      render();
    }, { once: true });
  };

  render();
  return card;
};

export const installDriverRadioAudioPreferenceControl = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.location.pathname.startsWith('/driver')) return;

  let frame = 0;
  const mount = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      const panel = findProfilePanel();
      if (!panel || panel.querySelector('[data-cg-driver-radio-preference]')) return;
      const appearanceTitle = Array.from(panel.querySelectorAll<HTMLElement>('p')).find((element) => element.textContent?.trim() === 'Apariencia');
      const appearanceCard = appearanceTitle?.closest('.rounded-2xl') as HTMLElement | null;
      const control = createPreferenceCard();
      if (appearanceCard?.parentElement === panel) appearanceCard.insertAdjacentElement('afterend', control);
      else panel.appendChild(control);
    });
  };

  const observer = new MutationObserver(mount);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pageshow', mount);
  mount();
};
