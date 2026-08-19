const REQUIRED_DRIVER_LABELS = ['número de móvil', 'nombre', 'nombre completo', 'correo de acceso'];

const normalizeLabel = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const makeOptionalDriverFields = () => {
  document.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
    const text = normalizeLabel(form.textContent || '');
    const isDriverForm = text.includes('guardar ficha') || text.includes('registrar y crear acceso');
    if (!isDriverForm) return;

    form.querySelectorAll<HTMLInputElement>('input[required]').forEach((input) => {
      const label = normalizeLabel(input.closest('label')?.textContent || '');
      const mustRemainRequired = REQUIRED_DRIVER_LABELS.some((requiredLabel) => label.startsWith(requiredLabel));
      if (!mustRemainRequired) input.required = false;
    });
  });
};

export const registerDriverFormOptionalFields = () => {
  if (typeof window === 'undefined') return;
  makeOptionalDriverFields();
  const observer = new MutationObserver(() => makeOptionalDriverFields());
  observer.observe(document.documentElement, { childList: true, subtree: true });
};