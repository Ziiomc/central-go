import { supabase } from './supabase';

const REFERRAL_KEY = 'centralgo:regional-partner-referral';
const ONBOARDING_INTENT_KEY = 'centralgo:onboarding-intent';

const normalize = (value: string | null | undefined) => {
  const code = (value ?? '').trim().toUpperCase();
  return /^[A-Z0-9-]{3,40}$/.test(code) ? code : null;
};

const capture = () => {
  if (typeof window === 'undefined') return null;
  const urlCode = normalize(new URLSearchParams(window.location.search).get('regional_partner'));
  const storedCode = normalize(window.localStorage.getItem(REFERRAL_KEY));
  const code = urlCode ?? storedCode;
  if (!code) return null;
  window.localStorage.setItem(REFERRAL_KEY, code);
  window.localStorage.setItem(ONBOARDING_INTENT_KEY, 'sales_partner');
  return code;
};

const preselectCommercialRole = (code: string) => {
  if (typeof document === 'undefined') return () => undefined;
  const apply = () => {
    const group = document.querySelector('[aria-label="Cómo quieres participar"]');
    if (!group) return;
    const buttons = Array.from(group.querySelectorAll('button'));
    const salesButton = buttons.find((button) => /Socio comercial/i.test(button.textContent ?? '')) as HTMLButtonElement | undefined;
    if (salesButton && salesButton.dataset.active !== 'true') salesButton.click();
    group.setAttribute('data-regional-referral', code);
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
};

export const registerRegionalPartnerReferralBootstrap = () => {
  const code = capture();
  if (!code || !supabase) return;

  const stopPreselect = preselectCommercialRole(code);
  const claim = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return;
    const { error } = await supabase.rpc('centralgo_claim_regional_partner_referral', { p_code: code });
    if (error) {
      console.warn('[Central GO] regional partner referral unavailable', error);
      return;
    }
    window.localStorage.removeItem(REFERRAL_KEY);
    stopPreselect();
  };

  void claim();
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void claim();
  });
};
