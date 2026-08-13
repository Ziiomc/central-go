import { supabase } from './supabase';

const INTENT_KEY = 'centralgo:onboarding-intent';
const OVERLAY_ID = 'centralgo-google-role-choice';

const roleOptions = [
  { id: 'central', label: 'Central', detail: 'Administrar una central de taxis' },
  { id: 'driver', label: 'Conductor', detail: 'Trabajar como chofer' },
  { id: 'sales_partner', label: 'Socio comercial', detail: 'Vender y dar soporte a Central GO' },
] as const;

const isGoogleUser = (user: any) =>
  user?.app_metadata?.provider === 'google' || user?.identities?.some((identity: any) => identity?.provider === 'google') === true;

const makeButton = (label: string, detail: string, onClick: () => void) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cg-role-card';
  button.style.width = '100%';
  button.addEventListener('click', onClick);

  const title = document.createElement('strong');
  title.textContent = label;
  const small = document.createElement('small');
  small.textContent = detail;
  button.append(title, small);
  return button;
};

export const registerGoogleOnboardingRoleBootstrap = () => {
  if (typeof window === 'undefined' || !supabase) return;

  let stopped = false;
  let observer: MutationObserver | null = null;

  const ensureChooser = async () => {
    if (stopped || document.getElementById(OVERLAY_ID)) return;
    const roleGroup = document.querySelector('[aria-label="Selecciona tu rol"]');
    if (!roleGroup) return;

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user || !isGoogleUser(user)) return;

    const choiceKey = `centralgo:google-role-choice:${user.id}`;
    const previousChoice = window.localStorage.getItem(choiceKey);
    if (roleOptions.some((option) => option.id === previousChoice)) {
      window.localStorage.setItem(INTENT_KEY, previousChoice!);
      const matching = Array.from(roleGroup.querySelectorAll('button')).find((button) =>
        button.textContent?.toLowerCase().includes(previousChoice === 'central' ? 'central' : previousChoice === 'driver' ? 'conductor' : 'socio comercial'),
      ) as HTMLButtonElement | undefined;
      matching?.click();
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,10,18,.88);backdrop-filter:blur(14px)';

    const card = document.createElement('div');
    card.className = 'cg-card';
    card.style.cssText = 'width:min(560px,100%);padding:24px;box-shadow:0 30px 90px rgba(0,0,0,.55)';

    const kicker = document.createElement('p');
    kicker.className = 'cg-card-kicker';
    kicker.textContent = 'Cuenta de Google verificada';
    const title = document.createElement('h1');
    title.className = 'cg-card-title';
    title.textContent = '¿Qué tipo de usuario quieres ser?';
    const copy = document.createElement('p');
    copy.className = 'cg-card-copy';
    copy.textContent = 'Google solo verificó tu identidad. Central GO no asignará ningún rol hasta que elijas una opción.';

    const grid = document.createElement('div');
    grid.className = 'cg-role-grid';
    grid.style.marginTop = '18px';

    for (const option of roleOptions) {
      grid.appendChild(makeButton(option.label, option.detail, () => {
        window.localStorage.setItem(INTENT_KEY, option.id);
        window.localStorage.setItem(choiceKey, option.id);
        const matching = Array.from(roleGroup.querySelectorAll('button')).find((button) =>
          button.textContent?.toLowerCase().includes(option.label.toLowerCase()),
        ) as HTMLButtonElement | undefined;
        matching?.click();
        overlay.remove();
      }));
    }

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'cg-subtle-button';
    exit.style.cssText = 'width:100%;margin-top:14px';
    exit.textContent = 'Cerrar sesión';
    exit.addEventListener('click', () => void supabase.auth.signOut());

    card.append(kicker, title, copy, grid, exit);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  };

  observer = new MutationObserver(() => { void ensureChooser(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  void ensureChooser();

  return () => {
    stopped = true;
    observer?.disconnect();
    document.getElementById(OVERLAY_ID)?.remove();
  };
};
