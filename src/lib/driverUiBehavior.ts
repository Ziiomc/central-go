let installed = false;
let scheduled = false;

const setButtonLabel = (button: HTMLButtonElement, label: string) => {
  const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  if (textNode && textNode.textContent?.trim() !== label) textNode.textContent = label;
};

const syncDriverTripButtons = () => {
  scheduled = false;
  const app = document.querySelector('.cg-driver-app');
  if (!app) return;

  app.querySelectorAll('section').forEach((section) => {
    const buttons = [...section.querySelectorAll('button')] as HTMLButtonElement[];
    const arrive = buttons.find((button) => button.textContent?.includes('Llegué al pasajero'));
    const start = buttons.find((button) => button.dataset.cgStartTrip === '1' || button.textContent?.includes('Pasajero a bordo') || button.textContent?.includes('Iniciar viaje'));
    const finish = buttons.find((button) => button.textContent?.includes('Finalizar y cobrar'));
    if (!arrive || !start || !finish) return;

    start.dataset.cgStartTrip = '1';
    setButtonLabel(start, 'Iniciar viaje');

    const text = section.textContent || '';
    const inProgress = text.includes('Pasajero a bordo');
    const arrived = text.includes('En domicilio');

    arrive.style.display = inProgress || arrived ? 'none' : '';
    start.style.display = arrived ? '' : 'none';
    finish.style.display = inProgress ? '' : 'none';
  });
};

const scheduleSync = () => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(syncDriverTripButtons);
};

export function installDriverTripButtonBehavior() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  // Observe structural React renders only. Text changes made by this helper must
  // not immediately undo the optimistic button transition before Supabase confirms it.
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest('button') as HTMLButtonElement | null;
    if (!button || !button.closest('.cg-driver-app')) return;
    const section = button.closest('section');
    if (!section) return;
    const buttons = [...section.querySelectorAll('button')] as HTMLButtonElement[];

    if (button.textContent?.includes('Llegué al pasajero')) {
      const start = buttons.find((candidate) => candidate.dataset.cgStartTrip === '1' || candidate.textContent?.includes('Pasajero a bordo') || candidate.textContent?.includes('Iniciar viaje'));
      const finish = buttons.find((candidate) => candidate.textContent?.includes('Finalizar y cobrar'));
      button.style.display = 'none';
      if (start) { start.dataset.cgStartTrip = '1'; setButtonLabel(start, 'Iniciar viaje'); start.style.display = ''; }
      if (finish) finish.style.display = 'none';
      window.setTimeout(scheduleSync, 1600);
    } else if (button.dataset.cgStartTrip === '1' || button.textContent?.includes('Iniciar viaje')) {
      const finish = buttons.find((candidate) => candidate.textContent?.includes('Finalizar y cobrar'));
      button.style.display = 'none';
      if (finish) finish.style.display = '';
      window.setTimeout(scheduleSync, 1600);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  else scheduleSync();
}
