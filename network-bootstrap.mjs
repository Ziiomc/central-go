import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const overlayDirectory = '.network';
const overlayArchive = '/tmp/central-go-network-ui.tar.xz';
const expectedHash = '0dafa05c39176fbf1223f1f06ae8795e5f24512efb012f98682822790e2d8797';

if (!existsSync(overlayDirectory)) {
  console.error('No se encontró la interfaz Network de Central GO.');
  process.exit(1);
}

const parts = readdirSync(overlayDirectory)
  .filter((name) => /^part-\d+$/.test(name))
  .sort();

if (parts.length !== 6) {
  console.error(`Se esperaban 6 partes de la interfaz Network y se encontraron ${parts.length}.`);
  process.exit(1);
}

const encodedOverlay = parts.map((name) => readFileSync(`${overlayDirectory}/${name}`, 'utf8')).join('');
const overlayBuffer = Buffer.from(encodedOverlay, 'base64');
const actualHash = createHash('sha256').update(overlayBuffer).digest('hex');

if (actualHash !== expectedHash) {
  console.error('La verificación de la interfaz Network no coincide.');
  process.exit(1);
}

writeFileSync(overlayArchive, overlayBuffer);
const result = spawnSync('tar', ['-xJf', overlayArchive], { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('No se pudo aplicar la interfaz Network de Central GO.');
  process.exit(result.status ?? 1);
}

const headerPath = 'src/components/Header.tsx';
let header = readFileSync(headerPath, 'utf8');
const replacements = [
  [
    "  ShieldCheck,\n  Volume2,",
    "  ShieldCheck,\n  LockKeyhole,\n  X,\n  Volume2,"
  ],
  [
    "  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);\n",
    "  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);\n  const [ownerAccessOpen, setOwnerAccessOpen] = useState(false);\n  const [ownerPin, setOwnerPin] = useState('');\n  const [ownerAccessError, setOwnerAccessError] = useState('');\n  const [ownerUnlocked, setOwnerUnlocked] = useState(false);\n"
  ],
  [
    "    { role: 'super_admin', label: 'Superadmin Global', icon: ShieldCheck, color: 'text-fuchsia-400' },",
    "    { role: 'super_admin', label: ownerUnlocked || currentRole === 'super_admin' ? 'Superadmin Global' : 'Acceso propietario', icon: ownerUnlocked || currentRole === 'super_admin' ? ShieldCheck : LockKeyhole, color: 'text-fuchsia-400' },"
  ],
  [
    "  const handleInstallClick = async () => {",
    `  const SUPERADMIN_PIN_HASH = '73a2af8864fc500fa49048bf3003776c19938f360e56bd03663866fb3087884a';

  const hashValue = async (value: string) => {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  const enterRole = (role: UserRole) => {
    if (role === 'super_admin' && !ownerUnlocked) {
      setRoleMenuOpen(false);
      setOwnerPin('');
      setOwnerAccessError('');
      setOwnerAccessOpen(true);
      return;
    }
    if (role !== 'super_admin') setOwnerUnlocked(false);
    setCurrentRole(role);
    setActiveModule('dashboard');
    setRoleMenuOpen(false);
  };

  const unlockOwnerAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOwnerAccessError('');
    try {
      const pinHash = await hashValue(ownerPin.trim());
      if (pinHash !== SUPERADMIN_PIN_HASH) {
        setOwnerAccessError('Contraseña incorrecta.');
        return;
      }
      setOwnerUnlocked(true);
      setCurrentRole('super_admin');
      setActiveModule('dashboard');
      setOwnerPin('');
      setOwnerAccessOpen(false);
    } catch {
      setOwnerAccessError('No fue posible validar el acceso en este navegador.');
    }
  };

  const handleInstallClick = async () => {`
  ],
  [
    "{rolesList.map(({ role, label, icon: Icon, color }) => <button key={role} onClick={() => { setCurrentRole(role); setActiveModule('dashboard'); setRoleMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${currentRole === role ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-500/20' : 'text-zinc-300 hover:bg-zinc-800'}`}><Icon className={`w-4 h-4 ${color}`} /><span>{label}</span></button>)}",
    "{rolesList.map(({ role, label, icon: Icon, color }) => <button key={role} onClick={() => enterRole(role)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${currentRole === role ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-500/20' : 'text-zinc-300 hover:bg-zinc-800'}`}><Icon className={`w-4 h-4 ${color}`} /><span className=\"flex-1\">{label}</span>{role === 'super_admin' && !ownerUnlocked && currentRole !== 'super_admin' && <span className=\"rounded-md border border-fuchsia-500/20 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-fuchsia-300\">Bloqueado</span>}</button>)}"
  ],
  [
    "        </div>\n      </div>\n    </header>",
    `        </div>
      </div>

      {ownerAccessOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="owner-access-title">
          <form onSubmit={unlockOwnerAccess} className="w-full max-w-sm rounded-3xl border border-fuchsia-500/25 bg-[#111116] p-6 shadow-2xl shadow-fuchsia-950/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/10 p-3 text-fuchsia-300"><LockKeyhole className="h-6 w-6" /></div>
                <div>
                  <h2 id="owner-access-title" className="text-lg font-black text-white">Acceso del propietario</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">El panel Superadmin Global está protegido y no se muestra sin autorización.</p>
                </div>
              </div>
              <button type="button" onClick={() => { setOwnerAccessOpen(false); setOwnerPin(''); setOwnerAccessError(''); }} className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white" aria-label="Cerrar acceso"><X className="h-5 w-5" /></button>
            </div>
            <label className="mt-6 block text-[10px] font-black uppercase tracking-widest text-zinc-500" htmlFor="owner-pin">Contraseña</label>
            <input id="owner-pin" autoFocus type="password" inputMode="numeric" autoComplete="current-password" value={ownerPin} onChange={(event) => { setOwnerPin(event.target.value); setOwnerAccessError(''); }} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-center text-lg font-black tracking-[0.35em] text-white outline-none transition placeholder:tracking-normal focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10" placeholder="••••" maxLength={12} />
            {ownerAccessError && <p className="mt-2 text-sm font-bold text-red-400">{ownerAccessError}</p>}
            <button type="submit" disabled={!ownerPin.trim()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-3.5 text-sm font-black text-white shadow-xl shadow-fuchsia-950/40 transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck className="h-5 w-5" /> Entrar a Superadmin Global</button>
            <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-600">El acceso vuelve a bloquearse al cambiar de perfil o recargar la página.</p>
          </form>
        </div>
      )}
    </header>`
  ]
];

for (const [oldText, newText] of replacements) {
  if (!header.includes(oldText)) {
    console.error('No se encontró un bloque esperado para proteger el acceso propietario.');
    process.exit(1);
  }
  header = header.replace(oldText, newText);
}
writeFileSync(headerPath, header);

const serviceWorkerPath = 'public/sw.js';
if (existsSync(serviceWorkerPath)) {
  const serviceWorker = readFileSync(serviceWorkerPath, 'utf8').replace('centralgo-network-v1', 'centralgo-network-v2-owner-lock');
  writeFileSync(serviceWorkerPath, serviceWorker);
}

console.log('Interfaz Central GO Network aplicada con acceso propietario protegido.');
