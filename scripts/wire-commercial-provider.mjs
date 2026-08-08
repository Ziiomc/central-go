import fs from 'node:fs';

const patch = (file, transform) => {
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No se aplicaron cambios esperados en ${file}`);
  fs.writeFileSync(file, after);
};

patch('src/context/AppContext.tsx', (source) => {
  let text = source;
  text = text.replace('interface AppContextType {', 'export type MaybePromise<T> = T | Promise<T>;\n\nexport interface AppContextType {');
  text = text.replace('const AppContext = createContext<AppContextType | undefined>(undefined);', 'export const AppContext = createContext<AppContextType | undefined>(undefined);');
  const replacements = new Map([
    ['createTrip: (data: Partial<Trip>) => Trip;', 'createTrip: (data: Partial<Trip>) => MaybePromise<Trip>;'],
    ['assignTrip: (tripId: string, driverId: string) => void;', 'assignTrip: (tripId: string, driverId: string) => MaybePromise<void>;'],
    ['reassignTrip: (tripId: string, newDriverId: string) => void;', 'reassignTrip: (tripId: string, newDriverId: string) => MaybePromise<void>;'],
    ['updateTripStatus: (tripId: string, status: TripStatus, notes?: string) => void;', 'updateTripStatus: (tripId: string, status: TripStatus, notes?: string) => MaybePromise<void>;'],
    ['cancelTrip: (tripId: string, reason: string) => void;', 'cancelTrip: (tripId: string, reason: string) => MaybePromise<void>;'],
    ['rejectTripOffer: (tripId: string, reason: string) => void;', 'rejectTripOffer: (tripId: string, reason: string) => MaybePromise<void>;'],
    ['toggleDriverAvailability: (driverId: string, status: DriverStatus) => void;', 'toggleDriverAvailability: (driverId: string, status: DriverStatus) => MaybePromise<void>;'],
    ['updateDriverLocation: (driverId: string, lat: number, lng: number, address?: string) => void;', 'updateDriverLocation: (driverId: string, lat: number, lng: number, address?: string) => MaybePromise<void>;'],
    ['triggerDriverSOS: (driverId: string) => void;', 'triggerDriverSOS: (driverId: string) => MaybePromise<void>;'],
    ['resolveDriverSOS: (driverId: string) => void;', 'resolveDriverSOS: (driverId: string) => MaybePromise<void>;'],
    ['autoAssignClosestDriver: (tripId: string) => Driver | null;', 'autoAssignClosestDriver: (tripId: string) => MaybePromise<Driver | null>;'],
    ['unassignTrip: (tripId: string) => void;', 'unassignTrip: (tripId: string) => MaybePromise<void>;'],
    ['settleDriverCommission: (driverId: string) => void;', 'settleDriverCommission: (driverId: string) => MaybePromise<void>;'],
    ["addClient: (client: Omit<Client, 'id' | 'totalTrips'>) => Client;", "addClient: (client: Omit<Client, 'id' | 'totalTrips'>) => MaybePromise<Client>;"],
    ["addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Vehicle;", "addVehicle: (vehicle: Omit<Vehicle, 'id'>) => MaybePromise<Vehicle>;"],
    ["addDriver: (driver: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>) => Driver;", "addDriver: (driver: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>) => MaybePromise<Driver>;"],
    ['updateFareConfig: (config: FareConfig) => void;', 'updateFareConfig: (config: FareConfig) => MaybePromise<void>;'],
    ['markNotificationAsRead: (id: string) => void;', 'markNotificationAsRead: (id: string) => MaybePromise<void>;'],
    ['clearAllNotifications: () => void;', 'clearAllNotifications: () => MaybePromise<void>;'],
    ['addAuditLog: (action: string, description: string) => void;', 'addAuditLog: (action: string, description: string) => MaybePromise<void>;'],
    ["addNotification: (title: string, message: string, type: AppNotification['type'], relatedId?: string) => void;", "addNotification: (title: string, message: string, type: AppNotification['type'], relatedId?: string) => MaybePromise<void>;"],
  ]);
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Firma no encontrada: ${from}`);
    text = text.replace(from, to);
  }
  const movement = '  useEffect(() => {\n    const movementInterval = window.setInterval(() => {';
  if (!text.includes(movement)) throw new Error('No se encontró el bucle de movimiento GPS secundario');
  text = text.replace(movement, '  useEffect(() => {\n    if (!runtimeConfig.isDemo) return;\n\n    const movementInterval = window.setInterval(() => {');
  return text;
});

patch('src/lib/commercialRepository.ts', (source) => {
  const marker = 'export async function reportDriverLocation(companyId: string, lat: number, lng: number, address?: string): Promise<void> {';
  if (!source.includes(marker)) throw new Error('No se encontró punto para control de móvil por operadora');
  const addition = `export async function setDriverStatusAsOperator(driverId: string, status: DriverStatus): Promise<void> {\n  const { error } = await requireSupabase().rpc('centralgo_operator_set_driver_status', { p_driver_id: driverId, p_new_status: status });\n  if (error) throw error;\n}\n\n`;
  return source.replace(marker, addition + marker);
});

patch('src/App.tsx', (source) => {
  let text = source;
  if (!text.includes("./context/CommercialAppProvider")) {
    text = text.replace("import { AuthProvider, useAuth } from './context/AuthContext';", "import { AuthProvider, useAuth } from './context/AuthContext';\nimport { CommercialAppProvider } from './context/CommercialAppProvider';");
  }
  const oldReturn = '  return <AppProvider><MainAppContent /></AppProvider>;';
  if (!text.includes(oldReturn)) throw new Error('No se encontró proveedor principal en App');
  text = text.replace(oldReturn, "  return runtimeConfig.isCommercial\n    ? <CommercialAppProvider><MainAppContent /></CommercialAppProvider>\n    : <AppProvider><MainAppContent /></AppProvider>;");
  return text;
});

patch('src/components/modules/OperatorConsole.tsx', (source) => {
  const oldHandler = `  const handleAutoAssign = (tripId: string, tripCode: string) => {\n    const driver = autoAssignClosestDriver(tripId);\n    if (!driver) return;\n    setFocusDriverId(driver.id);\n    setAssignmentToast({ tripId, tripCode, driverUnitNumber: driver.unitNumber });\n  };`;
  if (!source.includes(oldHandler)) throw new Error('No se encontró handleAutoAssign');
  const newHandler = `  const handleAutoAssign = async (tripId: string, tripCode: string) => {\n    const driver = await autoAssignClosestDriver(tripId);\n    if (!driver) return;\n    setFocusDriverId(driver.id);\n    setAssignmentToast({ tripId, tripCode, driverUnitNumber: driver.unitNumber });\n  };`;
  return source.replace(oldHandler, newHandler);
});

patch('src/components/modals/NewTripModal.tsx', (source) => {
  let text = source;
  text = text.replace("  const [error, setError] = useState('');", "  const [error, setError] = useState('');\n  const [submitting, setSubmitting] = useState(false);");
  text = text.replace('  const submitTrip = (event: React.FormEvent) => {', '  const submitTrip = async (event: React.FormEvent) => {');
  const callStart = '    createTrip({';
  if (!text.includes(callStart)) throw new Error('No se encontró createTrip del modal');
  text = text.replace(callStart, '    setSubmitting(true);\n    try {\n      await createTrip({');
  const closeBlock = `    });\n\n    setNewTripModalOpen(false);\n    resetForm();\n  };`;
  if (!text.includes(closeBlock)) throw new Error('No se encontró cierre del submit de carrera');
  text = text.replace(closeBlock, `      });\n\n      setNewTripModalOpen(false);\n      resetForm();\n    } catch (err) {\n      setError(err instanceof Error ? err.message : 'No fue posible crear la carrera.');\n    } finally {\n      setSubmitting(false);\n    }\n  };`);
  text = text.replace('type="submit"', 'type="submit" disabled={submitting}');
  return text;
});

patch('src/components/Header.tsx', (source) => {
  let text = source;
  if (!text.includes("../config/runtime")) text = text.replace("import { UserRole } from '../types';", "import { UserRole } from '../types';\nimport { runtimeConfig } from '../config/runtime';\nimport { useAuth } from '../context/AuthContext';");
  text = text.replace('  LockKeyhole,\n  X,', '  LockKeyhole,\n  LogOut,\n  X,');
  text = text.replace('export const Header: React.FC<HeaderProps> = ({ onToggleNotifications }) => {', "export const Header: React.FC<HeaderProps> = ({ onToggleNotifications }) => {\n  const { signOut } = useAuth();");
  text = text.replace('  const openOwnerAccess = () => {\n    setRoleMenuOpen(false);', '  const openOwnerAccess = () => {\n    if (!runtimeConfig.isDemo) return;\n    setRoleMenuOpen(false);');
  text = text.replace('  const handleOwnerLogoTap = () => {\n    ownerTapCount.current += 1;', '  const handleOwnerLogoTap = () => {\n    if (!runtimeConfig.isDemo) return;\n    ownerTapCount.current += 1;');
  text = text.replace('  const enterRole = (role: UserRole) => {\n    if (role ===', "  const enterRole = (role: UserRole) => {\n    if (!runtimeConfig.isDemo) return;\n    if (role ===");
  text = text.replace('onClick={() => setRoleMenuOpen(!roleMenuOpen)} className="flex items-center', 'onClick={() => runtimeConfig.isDemo && setRoleMenuOpen(!roleMenuOpen)} className="flex items-center');
  text = text.replace('{roleMenuOpen && (', '{runtimeConfig.isDemo && roleMenuOpen && (');
  text = text.replace('{ownerAccessOpen && (', '{runtimeConfig.isDemo && ownerAccessOpen && (');
  const roleClosing = `          </div>\n        </div>\n      </div>\n\n      {runtimeConfig.isDemo && ownerAccessOpen && (`;
  if (text.includes(roleClosing)) {
    text = text.replace(roleClosing, `          </div>\n          {runtimeConfig.isCommercial && (\n            <button onClick={() => void signOut()} className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 transition" title="Cerrar sesión"><LogOut className="w-4 h-4" /></button>\n          )}\n        </div>\n      </div>\n\n      {runtimeConfig.isDemo && ownerAccessOpen && (`);
  } else {
    throw new Error('No se encontró cierre de controles del Header');
  }
  return text;
});

patch('vercel.json', (source) => {
  const config = JSON.parse(source);
  for (const group of config.headers ?? []) {
    for (const header of group.headers ?? []) {
      if (header.key === 'Content-Security-Policy') {
        header.value = header.value.replace("connect-src 'self' https://router.project-osrm.org;", "connect-src 'self' https://cuazdzsvgwrnpczbvrgx.supabase.co wss://cuazdzsvgwrnpczbvrgx.supabase.co https://router.project-osrm.org;");
      }
    }
  }
  return JSON.stringify(config, null, 2) + '\n';
});

console.log('Cableado comercial aplicado.');
