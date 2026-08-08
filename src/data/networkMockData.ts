export type CentralSubscriptionStatus = 'active' | 'trial' | 'past_due' | 'suspended';
export type PartnerTier = 'regional' | 'commercial';
export type CommissionStatus = 'pending' | 'available' | 'paid' | 'reversed';

export interface NetworkCentral {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  owner: string;
  phone: string;
  email: string;
  vehicles: number;
  operators: number;
  plan: 'Start' | 'Pro' | 'Enterprise';
  monthlyFee: number;
  status: CentralSubscriptionStatus;
  partner: string;
  regionalPartner: string;
  joinedAt: string;
  nextBillingAt: string;
  activityScore: number;
}

export interface NetworkPartner {
  id: string;
  name: string;
  tier: PartnerTier;
  territory: string;
  countryCode: string;
  email: string;
  phone: string;
  centrals: number;
  activeCentrals: number;
  monthlySales: number;
  pendingCommission: number;
  availableCommission: number;
  status: 'active' | 'onboarding' | 'paused';
  conversionRate: number;
  satisfaction: number;
}

export interface NetworkCommission {
  id: string;
  central: string;
  partner: string;
  regionalPartner: string;
  period: string;
  paymentAmount: number;
  directRate: number;
  regionalRate: number;
  directAmount: number;
  regionalAmount: number;
  status: CommissionStatus;
  availableAt: string;
}

export const NETWORK_CENTRALS: NetworkCentral[] = [
  {
    id: 'net-001', name: 'Royal Taxis Linares', country: 'Chile', countryCode: 'CL', region: 'Maule', city: 'Linares',
    owner: 'Marcelo Contreras', phone: '+56 9 6123 4870', email: 'contacto@royaltaxis.cl', vehicles: 42, operators: 6,
    plan: 'Enterprise', monthlyFee: 149000, status: 'active', partner: 'Ignacio Varas', regionalPartner: 'María Paz Herrera',
    joinedAt: '2026-05-14', nextBillingAt: '2026-08-14', activityScore: 96,
  },
  {
    id: 'net-002', name: 'Taxi Seguro Talca', country: 'Chile', countryCode: 'CL', region: 'Maule', city: 'Talca',
    owner: 'Carolina Lagos', phone: '+56 9 7744 2920', email: 'admin@taxisegurotalca.cl', vehicles: 28, operators: 4,
    plan: 'Pro', monthlyFee: 99000, status: 'trial', partner: 'Ignacio Varas', regionalPartner: 'María Paz Herrera',
    joinedAt: '2026-08-01', nextBillingAt: '2026-08-15', activityScore: 82,
  },
  {
    id: 'net-003', name: 'Radio Móvil Mendoza', country: 'Argentina', countryCode: 'AR', region: 'Mendoza', city: 'Mendoza',
    owner: 'Santiago Cornejo', phone: '+54 9 261 488 2260', email: 'operaciones@movilmendoza.ar', vehicles: 61, operators: 8,
    plan: 'Enterprise', monthlyFee: 179000, status: 'active', partner: 'Luciano Ferreyra', regionalPartner: 'Valentina Núñez',
    joinedAt: '2026-03-22', nextBillingAt: '2026-08-22', activityScore: 91,
  },
  {
    id: 'net-004', name: 'Central Taxi Arequipa', country: 'Perú', countryCode: 'PE', region: 'Arequipa', city: 'Arequipa',
    owner: 'Diego Quispe', phone: '+51 956 802 111', email: 'gerencia@taxiarequipa.pe', vehicles: 36, operators: 5,
    plan: 'Pro', monthlyFee: 109000, status: 'past_due', partner: 'Camila Rojas', regionalPartner: 'Renzo Medina',
    joinedAt: '2026-04-08', nextBillingAt: '2026-08-02', activityScore: 69,
  },
  {
    id: 'net-005', name: 'Movilidad Norte CDMX', country: 'México', countryCode: 'MX', region: 'Ciudad de México', city: 'CDMX',
    owner: 'Fernanda Salas', phone: '+52 55 3902 4418', email: 'hola@movilidadnorte.mx', vehicles: 74, operators: 10,
    plan: 'Enterprise', monthlyFee: 199000, status: 'active', partner: 'Emiliano Torres', regionalPartner: 'Paola Hernández',
    joinedAt: '2026-02-17', nextBillingAt: '2026-08-17', activityScore: 94,
  },
  {
    id: 'net-006', name: 'Taxi Costa Barcelona', country: 'España', countryCode: 'ES', region: 'Cataluña', city: 'Barcelona',
    owner: 'Jordi Navarro', phone: '+34 612 554 811', email: 'direccion@taxicosta.es', vehicles: 53, operators: 7,
    plan: 'Enterprise', monthlyFee: 229000, status: 'trial', partner: 'Lucía Martín', regionalPartner: 'Alejandro Ruiz',
    joinedAt: '2026-07-29', nextBillingAt: '2026-08-12', activityScore: 88,
  },
  {
    id: 'net-007', name: 'Cooperativa Taxi Quito', country: 'Ecuador', countryCode: 'EC', region: 'Pichincha', city: 'Quito',
    owner: 'Andrés Cevallos', phone: '+593 99 713 8821', email: 'sistemas@taxiquito.ec', vehicles: 31, operators: 4,
    plan: 'Pro', monthlyFee: 99000, status: 'suspended', partner: 'Sofía Naranjo', regionalPartner: 'Mateo Almeida',
    joinedAt: '2026-01-11', nextBillingAt: '2026-07-11', activityScore: 42,
  },
];

export const NETWORK_PARTNERS: NetworkPartner[] = [
  { id: 'par-001', name: 'María Paz Herrera', tier: 'regional', territory: 'Chile Centro-Sur', countryCode: 'CL', email: 'maria@centralgo.network', phone: '+56 9 8812 0911', centrals: 12, activeCentrals: 10, monthlySales: 1188000, pendingCommission: 59400, availableCommission: 184500, status: 'active', conversionRate: 38, satisfaction: 96 },
  { id: 'par-002', name: 'Valentina Núñez', tier: 'regional', territory: 'Argentina Oeste', countryCode: 'AR', email: 'valentina@centralgo.network', phone: '+54 9 11 4203 0182', centrals: 8, activeCentrals: 7, monthlySales: 812000, pendingCommission: 40600, availableCommission: 118800, status: 'active', conversionRate: 34, satisfaction: 93 },
  { id: 'par-003', name: 'Renzo Medina', tier: 'regional', territory: 'Perú Sur', countryCode: 'PE', email: 'renzo@centralgo.network', phone: '+51 977 400 822', centrals: 6, activeCentrals: 5, monthlySales: 545000, pendingCommission: 27250, availableCommission: 80100, status: 'active', conversionRate: 31, satisfaction: 89 },
  { id: 'par-004', name: 'Paola Hernández', tier: 'regional', territory: 'México Centro', countryCode: 'MX', email: 'paola@centralgo.network', phone: '+52 55 4102 9881', centrals: 7, activeCentrals: 6, monthlySales: 896000, pendingCommission: 44800, availableCommission: 132000, status: 'active', conversionRate: 42, satisfaction: 95 },
  { id: 'par-005', name: 'Ignacio Varas', tier: 'commercial', territory: 'Maule, Chile', countryCode: 'CL', email: 'ignacio@centralgo.network', phone: '+56 9 7330 4431', centrals: 4, activeCentrals: 3, monthlySales: 347000, pendingCommission: 69400, availableCommission: 138800, status: 'active', conversionRate: 44, satisfaction: 98 },
  { id: 'par-006', name: 'Luciano Ferreyra', tier: 'commercial', territory: 'Mendoza, Argentina', countryCode: 'AR', email: 'luciano@centralgo.network', phone: '+54 9 261 501 7720', centrals: 3, activeCentrals: 3, monthlySales: 429000, pendingCommission: 85800, availableCommission: 114400, status: 'active', conversionRate: 36, satisfaction: 92 },
  { id: 'par-007', name: 'Lucía Martín', tier: 'commercial', territory: 'Cataluña, España', countryCode: 'ES', email: 'lucia@centralgo.network', phone: '+34 611 029 418', centrals: 1, activeCentrals: 0, monthlySales: 0, pendingCommission: 0, availableCommission: 0, status: 'onboarding', conversionRate: 20, satisfaction: 100 },
];

export const NETWORK_COMMISSIONS: NetworkCommission[] = [
  { id: 'COM-2608-001', central: 'Royal Taxis Linares', partner: 'Ignacio Varas', regionalPartner: 'María Paz Herrera', period: 'Agosto 2026', paymentAmount: 149000, directRate: 20, regionalRate: 5, directAmount: 29800, regionalAmount: 7450, status: 'pending', availableAt: '2026-08-21' },
  { id: 'COM-2608-002', central: 'Radio Móvil Mendoza', partner: 'Luciano Ferreyra', regionalPartner: 'Valentina Núñez', period: 'Agosto 2026', paymentAmount: 179000, directRate: 20, regionalRate: 5, directAmount: 35800, regionalAmount: 8950, status: 'available', availableAt: '2026-08-04' },
  { id: 'COM-2608-003', central: 'Movilidad Norte CDMX', partner: 'Emiliano Torres', regionalPartner: 'Paola Hernández', period: 'Agosto 2026', paymentAmount: 199000, directRate: 20, regionalRate: 5, directAmount: 39800, regionalAmount: 9950, status: 'paid', availableAt: '2026-08-01' },
  { id: 'COM-2607-004', central: 'Central Taxi Arequipa', partner: 'Camila Rojas', regionalPartner: 'Renzo Medina', period: 'Julio 2026', paymentAmount: 109000, directRate: 20, regionalRate: 5, directAmount: 21800, regionalAmount: 5450, status: 'reversed', availableAt: '2026-07-20' },
  { id: 'COM-2608-005', central: 'Taxi Seguro Talca', partner: 'Ignacio Varas', regionalPartner: 'María Paz Herrera', period: 'Conversión de prueba', paymentAmount: 99000, directRate: 20, regionalRate: 5, directAmount: 19800, regionalAmount: 4950, status: 'pending', availableAt: '2026-08-29' },
];

export const COUNTRY_ACTIVITY = [
  { country: 'Chile', code: 'CL', centrals: 14, partners: 7, mrr: 1386000, growth: 18 },
  { country: 'Argentina', code: 'AR', centrals: 8, partners: 4, mrr: 812000, growth: 12 },
  { country: 'México', code: 'MX', centrals: 6, partners: 5, mrr: 896000, growth: 31 },
  { country: 'Perú', code: 'PE', centrals: 5, partners: 3, mrr: 545000, growth: 9 },
  { country: 'España', code: 'ES', centrals: 3, partners: 2, mrr: 397000, growth: 24 },
];

export const MONTHLY_NETWORK_REVENUE = [
  { month: 'Mar', revenue: 1680000, commissions: 420000, centrals: 19 },
  { month: 'Abr', revenue: 2050000, commissions: 512500, centrals: 23 },
  { month: 'May', revenue: 2470000, commissions: 617500, centrals: 27 },
  { month: 'Jun', revenue: 2960000, commissions: 740000, centrals: 31 },
  { month: 'Jul', revenue: 3460000, commissions: 865000, centrals: 35 },
  { month: 'Ago', revenue: 4036000, commissions: 1009000, centrals: 38 },
];
