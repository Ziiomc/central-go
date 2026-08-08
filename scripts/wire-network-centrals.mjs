import fs from 'node:fs';

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No se aplicaron cambios a ${path}`);
  fs.writeFileSync(path, after);
}

patch('src/components/modules/CentralsNetworkModule.tsx', (source) => {
  let text = source;
  text = text.replace("import React, { useMemo, useState } from 'react';", "import React, { useEffect, useMemo, useState } from 'react';");
  text = text.replace("import { CentralRegistrationModal } from '../network/CentralRegistrationModal';", "import { CentralRegistrationModal } from '../network/CentralRegistrationModal';\nimport { runtimeConfig } from '../../config/runtime';\nimport { loadNetworkCentrals } from '../../lib/networkRepository';");
  text = text.replace('  const [centrals, setCentrals] = useState<NetworkCentral[]>(NETWORK_CENTRALS);', "  const [centrals, setCentrals] = useState<NetworkCentral[]>(runtimeConfig.isDemo ? NETWORK_CENTRALS : []);\n  const [loading, setLoading] = useState(runtimeConfig.isCommercial);\n  const [loadError, setLoadError] = useState('');");

  const viewMarker = "  const [view, setView] = useState<'table' | 'cards'>('table');";
  if (!text.includes(viewMarker)) throw new Error('view marker no encontrado');
  text = text.replace(viewMarker, `${viewMarker}\n\n  const reloadCentrals = async () => {\n    if (!runtimeConfig.isCommercial) return;\n    setLoading(true);\n    setLoadError('');\n    try {\n      setCentrals(await loadNetworkCentrals());\n    } catch (error) {\n      setLoadError(error instanceof Error ? error.message : 'No fue posible cargar las centrales reales.');\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  useEffect(() => { void reloadCentrals(); }, []);`);

  text = text.replace(`<NetworkKpi label="Centrales registradas" value="38" detail={\`${centrals.length} representadas en la maqueta\`} icon={Building2} accent="blue" />`, `<NetworkKpi label="Centrales registradas" value={String(centrals.length)} detail={runtimeConfig.isCommercial ? 'Empresas reales registradas' : 'Representadas en la maqueta'} icon={Building2} accent="blue" />`);
  text = text.replace(`<NetworkKpi label="Suscripciones activas" value="34" detail="89,5% de la cartera" icon={UsersRound} accent="emerald" />`, `<NetworkKpi label="Suscripciones activas" value={String(centrals.filter((c) => c.status === 'active').length)} detail={centrals.length ? \`${Math.round((centrals.filter((c) => c.status === 'active').length / centrals.length) * 100)}% de la cartera\` : 'Sin centrales aún'} icon={UsersRound} accent="emerald" />`);
  text = text.replace(`<NetworkKpi label="MRR administrado" value={money(4036000)} detail={\`${money(mrr)} visible en esta lista\`} icon={CalendarClock} accent="purple" />`, `<NetworkKpi label="MRR administrado" value={money(mrr)} detail={runtimeConfig.isCommercial ? 'Equivalente mensual de suscripciones' : \`${money(mrr)} visible en esta lista\`} icon={CalendarClock} accent="purple" />`);
  text = text.replace(`<NetworkKpi label="Móviles conectados" value="1.284" detail={\`${vehicles} móviles en los registros demo\`} icon={ShieldAlert} accent="amber" />`, `<NetworkKpi label="Móviles registrados" value={String(vehicles)} detail={runtimeConfig.isCommercial ? 'Flota real cargada en la plataforma' : \`${vehicles} móviles en los registros demo\`} icon={ShieldAlert} accent="amber" />`);

  const sectionMarker = `      <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">`;
  text = text.replace(sectionMarker, `      {loadError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{loadError}</div>}\n      {loading && <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300">Sincronizando red comercial…</div>}\n\n${sectionMarker}`);

  const modal = `<CentralRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onCreate={(central) => setCentrals((prev) => [central, ...prev])} />`;
  if (!text.includes(modal)) throw new Error('modal central no encontrado');
  text = text.replace(modal, `<CentralRegistrationModal open={registerOpen} onClose={() => setRegisterOpen(false)} onCreate={(central) => {\n        if (runtimeConfig.isCommercial) void reloadCentrals();\n        else setCentrals((prev) => [central, ...prev]);\n      }} />`);
  return text;
});

patch('src/components/network/CentralRegistrationModal.tsx', (source) => {
  let text = source;
  text = text.replace("import { NetworkCentral } from '../../data/networkMockData';", "import { NetworkCentral } from '../../data/networkMockData';\nimport { runtimeConfig } from '../../config/runtime';\nimport { createNetworkCentral, loadNetworkCentrals } from '../../lib/networkRepository';");
  text = text.replace("    name: '', country: 'Chile', region: '', city: '', owner: '', phone: '', email: '', vehicles: '20', plan: 'Enterprise' as NetworkCentral['plan'], partner: 'Ignacio Varas', regionalPartner: 'María Paz Herrera',", "    name: '', code: '', country: 'Chile', region: '', city: '', owner: '', phone: '', email: '', vehicles: '20', plan: 'Enterprise' as NetworkCentral['plan'], partner: 'Ignacio Varas', regionalPartner: 'María Paz Herrera',");
  text = text.replace("  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');", "  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');\n  const [saving, setSaving] = useState(false);\n  const [submitError, setSubmitError] = useState('');\n  const [ownerAssigned, setOwnerAssigned] = useState(true);");
  text = text.replace("  const canContinue = step === 1 ? form.name && form.region && form.city :", "  const canContinue = step === 1 ? form.name && form.region && form.city && (!runtimeConfig.isCommercial || form.code) :");

  const oldSubmitStart = '  const submit = () => {';
  if (!text.includes(oldSubmitStart)) throw new Error('submit modal no encontrado');
  const submitEndMarker = `    onCreate?.(created);\n    setFinished(true);\n  };`;
  const submitStartIdx = text.indexOf(oldSubmitStart);
  const submitEndIdx = text.indexOf(submitEndMarker, submitStartIdx);
  if (submitEndIdx < 0) throw new Error('fin submit modal no encontrado');
  const oldSubmitBlock = text.slice(submitStartIdx, submitEndIdx + submitEndMarker.length);
  const newSubmitBlock = `  const submit = async () => {\n    setSubmitError('');\n    setSaving(true);\n    try {\n      if (runtimeConfig.isCommercial) {\n        const countryCode = form.country === 'Chile' ? 'CL' : form.country === 'Argentina' ? 'AR' : form.country === 'México' ? 'MX' : form.country === 'Perú' ? 'PE' : form.country === 'España' ? 'ES' : 'EC';\n        const result = await createNetworkCentral({\n          name: form.name, code: form.code, city: form.city, countryCode, phone: form.phone, address: form.region,\n          plan: form.plan, billing, ownerEmail: form.email,\n        });\n        setOwnerAssigned(result.ownerAssigned);\n        const realCentrals = await loadNetworkCentrals();\n        const created = realCentrals.find((item) => item.id === result.companyId);\n        if (created) onCreate?.(created);\n        setFinished(true);\n        return;\n      }\n\n      const created: NetworkCentral = {\n        id: \`net-demo-\${Date.now()}\`,\n        name: form.name || 'Nueva Central Demo',\n        country: form.country,\n        countryCode: form.country === 'Chile' ? 'CL' : form.country === 'Argentina' ? 'AR' : form.country === 'México' ? 'MX' : form.country === 'Perú' ? 'PE' : form.country === 'España' ? 'ES' : 'EC',\n        region: form.region, city: form.city, owner: form.owner, phone: form.phone, email: form.email,\n        vehicles: Number(form.vehicles) || 0, operators: 1, plan: form.plan, monthlyFee: selectedMonthlyPrice, status: 'trial',\n        partner: form.partner, regionalPartner: form.regionalPartner, joinedAt: new Date().toISOString().slice(0, 10),\n        nextBillingAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), activityScore: 15,\n      };\n      onCreate?.(created);\n      setFinished(true);\n    } catch (error) {\n      setSubmitError(error instanceof Error ? error.message : 'No fue posible registrar la central.');\n    } finally {\n      setSaving(false);\n    }\n  };`;
  text = text.replace(oldSubmitBlock, newSubmitBlock);

  const cityField = `<Field label="Ciudad" value={form.city} onChange={(v) => update('city', v)} placeholder="Ej. Linares" />`;
  if (!text.includes(cityField)) throw new Error('campo ciudad no encontrado');
  text = text.replace(cityField, `${cityField}\n                  {runtimeConfig.isCommercial && <Field label="Código interno único" value={form.code} onChange={(v) => update('code', v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24))} placeholder="Ej. ROYAL-LINARES" />}`);

  const partnerGrid = `<div className="grid sm:grid-cols-2 gap-4">\n                    <SelectField label="Partner comercial atribuido" value={form.partner} onChange={(v) => update('partner', v)} options={['Ignacio Varas', 'Luciano Ferreyra', 'Camila Rojas', 'Lucía Martín']} />\n                    <SelectField label="Responsable regional" value={form.regionalPartner} onChange={(v) => update('regionalPartner', v)} options={['María Paz Herrera', 'Valentina Núñez', 'Renzo Medina', 'Paola Hernández']} />\n                  </div>`;
  if (!text.includes(partnerGrid)) throw new Error('partner grid no encontrado');
  text = text.replace(partnerGrid, `{runtimeConfig.isDemo ? (\n                  ${partnerGrid}\n                  ) : (\n                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[10px] text-blue-200/80">La atribución a un partner se realizará desde el padrón real de Partners después de crear la central. No se usarán nombres ficticios en producción.</div>\n                  )}`);

  const finalButton = `<button onClick={submit} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-950/50"><Zap className="w-4 h-4" />Crear central en prueba</button>`;
  if (!text.includes(finalButton)) throw new Error('botón submit no encontrado');
  text = text.replace(finalButton, `<button disabled={saving} onClick={() => void submit()} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs font-black text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-950/50"><Zap className="w-4 h-4" />{saving ? 'Creando central…' : 'Crear central en prueba'}</button>`);

  const footerMarker = `            <div className="p-5 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/35">`;
  text = text.replace(footerMarker, `            {submitError && <div className="mx-5 mb-0 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{submitError}</div>}\n${footerMarker}`);

  const success = `<div className="p-8"><EmptySuccess title="Central registrada correctamente" detail={\`${form.name || 'La nueva central'} quedó creada en modo prueba. En la versión funcional se enviarán accesos por correo y quedará atribuida automáticamente a ${form.partner}.\`} onClose={resetAndClose} /></div>`;
  if (!text.includes(success)) throw new Error('success modal no encontrado');
  text = text.replace(success, `<div className="p-8"><EmptySuccess title="Central registrada correctamente" detail={runtimeConfig.isCommercial ? (ownerAssigned ? \`${form.name} quedó creada con prueba de 14 días y el propietario ya tiene acceso administrador.\` : \`${form.name} quedó creada con prueba de 14 días. El propietario deberá crear su cuenta con ${form.email} para poder asignarle acceso.\`) : \`${form.name || 'La nueva central'} quedó creada en modo prueba y atribuida a ${form.partner}.\`} onClose={resetAndClose} /></div>`);
  return text;
});

console.log('Panel real de centrales conectado.');
