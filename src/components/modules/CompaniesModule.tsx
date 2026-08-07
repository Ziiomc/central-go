import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Driver, Trip, PaymentMethod } from '../../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  Car,
  CreditCard,
  Wallet,
  CheckCircle2,
  Search,
  FileText,
  Printer,
  ArrowUpRight,
  Percent,
  Calendar,
  Download,
  AlertCircle,
  Phone,
  MapPin,
  Radio,
  Receipt,
  Share2,
  X,
  Award,
} from 'lucide-react';

export const CompaniesModule: React.FC = () => {
  const {
    companies,
    currentCompany,
    setCurrentCompany,
    drivers,
    trips,
    settleDriverCommission,
    currentRole,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'drivers_breakdown' | 'payments' | 'agencies'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_fee' | 'high_earner'>('all');
  const [selectedDriverForSettlement, setSelectedDriverForSettlement] = useState<Driver | null>(null);
  const [settledSuccessMessage, setSettledSuccessMessage] = useState<string | null>(null);

  // Filter drivers for current company
  const companyDrivers = useMemo(() => {
    return drivers.filter((d) => d.companyId === currentCompany.id);
  }, [drivers, currentCompany.id]);

  // Filter completed trips for current company
  const companyTrips = useMemo(() => {
    return trips.filter((t) => t.companyId === currentCompany.id);
  }, [trips, currentCompany.id]);

  const completedCompanyTrips = useMemo(() => {
    return companyTrips.filter((t) => t.status === 'completed');
  }, [companyTrips]);

  // Overall Financial Calculations
  const COMMISSION_RATE = 0.15; // 15% agency commission

  const financialMetrics = useMemo(() => {
    let totalGross = 0;
    let totalCash = 0;
    let totalDigital = 0;
    let totalCreditAccount = 0;

    completedCompanyTrips.forEach((t) => {
      const fare = t.finalFare || t.estimatedFare || 0;
      totalGross += fare;

      if (t.paymentMethod === 'efectivo') {
        totalCash += fare;
      } else if (t.paymentMethod === 'transferencia' || t.paymentMethod === 'posnet_tarjeta') {
        totalDigital += fare;
      } else if (t.paymentMethod === 'cuenta_corriente') {
        totalCreditAccount += fare;
      }
    });

    // If mock driver todayEarnings is higher, ensure realistic agency totals
    const driverEarningsSum = companyDrivers.reduce((acc, d) => acc + (d.todayEarnings || 0), 0);
    const grossTotal = Math.max(totalGross, driverEarningsSum);

    const agencyNetCommission = Math.round(grossTotal * COMMISSION_RATE);
    const driversNetPayout = grossTotal - agencyNetCommission;

    const totalPendingCommissionFees = companyDrivers.reduce((acc, d) => {
      return acc + (d.commissionBalance > 0 ? d.commissionBalance : 0);
    }, 0);

    const avgFarePerTrip = completedCompanyTrips.length > 0
      ? Math.round(grossTotal / completedCompanyTrips.length)
      : 0;

    return {
      grossTotal,
      agencyNetCommission,
      driversNetPayout,
      totalPendingCommissionFees,
      avgFarePerTrip,
      completedTripsCount: completedCompanyTrips.length,
      totalCash,
      totalDigital,
      totalCreditAccount,
    };
  }, [completedCompanyTrips, companyDrivers]);

  // Driver Earnings Breakdown Table Data
  const driverBreakdownList = useMemo(() => {
    return companyDrivers.map((driver) => {
      const driverTrips = completedCompanyTrips.filter((t) => t.driverId === driver.id);
      const calculatedGrossFromTrips = driverTrips.reduce((acc, t) => acc + (t.finalFare || t.estimatedFare || 0), 0);
      const grossEarnings = Math.max(driver.todayEarnings, calculatedGrossFromTrips);

      const agencyFee = Math.round(grossEarnings * COMMISSION_RATE);
      const driverPayout = grossEarnings - agencyFee;

      let cashTotal = 0;
      let digitalTotal = 0;
      let creditAccountTotal = 0;

      driverTrips.forEach((t) => {
        const fare = t.finalFare || t.estimatedFare || 0;
        if (t.paymentMethod === 'efectivo') cashTotal += fare;
        else if (t.paymentMethod === 'cuenta_corriente') creditAccountTotal += fare;
        else digitalTotal += fare;
      });

      return {
        driver,
        tripsCount: driverTrips.length > 0 ? driverTrips.length : (driver.todayEarnings > 0 ? Math.floor(driver.todayEarnings / 4500) : 0),
        grossEarnings,
        agencyFee,
        driverPayout,
        cashTotal,
        digitalTotal,
        creditAccountTotal,
        commissionBalance: driver.commissionBalance,
        tripsList: driverTrips,
      };
    });
  }, [companyDrivers, completedCompanyTrips]);

  // Filtered drivers for search
  const filteredDriverBreakdown = useMemo(() => {
    return driverBreakdownList.filter((item) => {
      const matchesSearch =
        item.driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.driver.unitNumber.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'pending_fee') return item.commissionBalance > 0;
      if (statusFilter === 'high_earner') return item.grossEarnings > 35000;

      return true;
    });
  }, [driverBreakdownList, searchQuery, statusFilter]);

  // Weekly Revenue Trend Data for Recharts
  const weeklyRevenueTrend = [
    { dia: 'Lun', bruto: 240000, comision: 36000 },
    { dia: 'Mar', bruto: 280000, comision: 42000 },
    { dia: 'Mié', bruto: 210000, comision: 31500 },
    { dia: 'Jue', bruto: 310000, comision: 46500 },
    { dia: 'Vie', bruto: 450000, comision: 67500 },
    { dia: 'Sáb', bruto: 520000, comision: 78000 },
    { dia: 'Dom (Hoy)', bruto: financialMetrics.grossTotal, comision: financialMetrics.agencyNetCommission },
  ];

  // Top Drivers Bar Chart Data
  const topDriversData = useMemo(() => {
    return driverBreakdownList
      .map((item) => ({
        movil: item.driver.unitNumber,
        conductor: item.driver.name,
        recaudacion: item.grossEarnings,
        comision: item.agencyFee,
      }))
      .sort((a, b) => b.recaudacion - a.recaudacion)
      .slice(0, 5);
  }, [driverBreakdownList]);

  // Payment Breakdown Pie Data
  const paymentBreakdownPie = [
    { name: 'Efectivo en Mano', value: financialMetrics.totalCash || 120000, color: '#10b981' },
    { name: 'Transferencias / MP / Posnet', value: financialMetrics.totalDigital || 65000, color: '#3b82f6' },
    { name: 'Cuentas Corrientes Empresas', value: financialMetrics.totalCreditAccount || 25000, color: '#f59e0b' },
  ];

  // Handle Settle Commission Action
  const handleSettleCommission = (driverId: string, driverName: string, unitNumber: string) => {
    settleDriverCommission(driverId);
    setSettledSuccessMessage(`Comisión de ${unitNumber} (${driverName}) saldada correctamente.`);
    setTimeout(() => setSettledSuccessMessage(null), 4000);
  };

  // Helper for WhatsApp Share
  const handleShareWhatsApp = (driver: Driver, item: any) => {
    const text = `*CentralGo - Rendición de Cuentas Diaria*\n` +
      `📌 *Central:* ${currentCompany.name}\n` +
      `🚖 *Móvil:* ${driver.unitNumber} - ${driver.name}\n` +
      `----------------------------------------\n` +
      `▪ *Viajes Realizados:* ${item.tripsCount}\n` +
      `▪ *Recaudación Bruta Total:* $${item.grossEarnings.toLocaleString('es-CL')}\n` +
      `▪ *Comisión Central (15%):* $${item.agencyFee.toLocaleString('es-CL')}\n` +
      `▪ *Dinero Neto Conductor:* $${item.driverPayout.toLocaleString('es-CL')}\n` +
      `▪ *Estado Saldo Cuota Radio:* $${item.commissionBalance.toLocaleString('es-CL')}\n` +
      `----------------------------------------\n` +
      `Comprobante generado el ${new Date().toLocaleDateString('es-CL')} a las ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-2xl text-white tracking-tight font-sans">
              Central<span className="text-amber-400">GO</span> • Panel Admin de Empresa
            </h1>
            <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] rounded-md uppercase tracking-wider">
              {currentCompany.name}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Módulo completo de control financiero, recaudación total de choferes, cuotas de radio y rendición de cuentas.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap gap-1 bg-[#121215] p-1.5 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ganancias Agencia</span>
          </button>

          <button
            onClick={() => setActiveTab('drivers_breakdown')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === 'drivers_breakdown'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Desglose Choferes ({companyDrivers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Medios de Pago</span>
          </button>

          <button
            onClick={() => setActiveTab('agencies')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === 'agencies'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Mis Centrales</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {settledSuccessMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 p-4 rounded-xl text-xs font-mono flex items-center gap-3 animate-fade-in shadow-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{settledSuccessMessage}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW & GAIN METRICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Financial KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Gross Total Agency Revenue */}
            <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-zinc-800 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
                <span>Recaudación Bruta Flota</span>
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
                ${financialMetrics.grossTotal.toLocaleString('es-CL')}
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +14.2%
                </span>
                <span>vs. mismo día semana anterior</span>
              </div>
            </div>

            {/* KPI 2: Agency Net Income (Commission 15%) */}
            <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-xl relative overflow-hidden group hover:border-amber-500/60 transition">
              <div className="flex items-center justify-between text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                <span>Comisión Central (15%)</span>
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-300 border border-amber-500/30">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-amber-300 tracking-tight font-mono">
                ${financialMetrics.agencyNetCommission.toLocaleString('es-CL')}
              </div>
              <div className="mt-2 text-[11px] text-amber-400/80 font-medium">
                Ganancia Neta para la Central
              </div>
            </div>

            {/* KPI 3: Driver Total Payout (85%) */}
            <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-zinc-800 shadow-xl relative overflow-hidden group hover:border-blue-500/40 transition">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
                <span>Ingresos Choferes (85%)</span>
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-blue-400 tracking-tight font-mono">
                ${financialMetrics.driversNetPayout.toLocaleString('es-CL')}
              </div>
              <div className="mt-2 text-[11px] text-zinc-400">
                Monto distribuido entre {companyDrivers.length} conductores
              </div>
            </div>

            {/* KPI 4: Pending Commission Balance */}
            <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-zinc-800 shadow-xl relative overflow-hidden group hover:border-rose-500/40 transition">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
                <span>Cuotas Radio Pendientes</span>
                <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-rose-400 tracking-tight font-mono">
                ${financialMetrics.totalPendingCommissionFees.toLocaleString('es-CL')}
              </div>
              <div className="mt-2 text-[11px] text-rose-300/80 font-medium flex items-center justify-between">
                <span>Por cobrar a conductores</span>
                <button
                  onClick={() => setActiveTab('drivers_breakdown')}
                  className="underline hover:text-white"
                >
                  Cobrar
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Quick Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 flex items-center justify-between font-mono">
              <div className="text-xs text-zinc-400 uppercase">Viajes Completados Hoy</div>
              <div className="text-xl font-bold text-white">{financialMetrics.completedTripsCount} viajes</div>
            </div>
            <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 flex items-center justify-between font-mono">
              <div className="text-xs text-zinc-400 uppercase">Ticket Promedio por Viaje</div>
              <div className="text-xl font-bold text-emerald-400">${financialMetrics.avgFarePerTrip.toLocaleString('es-CL')}</div>
            </div>
            <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 flex items-center justify-between font-mono">
              <div className="text-xs text-zinc-400 uppercase">Conductores Activos</div>
              <div className="text-xl font-bold text-blue-400">{companyDrivers.filter((d) => d.status !== 'offline').length} / {companyDrivers.length}</div>
            </div>
          </div>

          {/* Recharts Graphical Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Revenue Trend */}
            <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2 uppercase tracking-tight font-sans">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Evolución Diaria de Recaudación y Comisión Central
                </h3>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Últimos 7 Días</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyRevenueTrend}>
                    <defs>
                      <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorComision" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dia" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={(val) => `$${val / 1000}k`} />
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toLocaleString('es-CL')}`, '']}
                      contentStyle={{ backgroundColor: '#121215', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="bruto" name="Recaudación Flota" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBruto)" />
                    <Area type="monotone" dataKey="comision" name="Comisión Central (15%)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorComision)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Top Drivers Earnings */}
            <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2 uppercase tracking-tight font-sans">
                  <Award className="w-4 h-4 text-emerald-400" />
                  Top Conductores con Mayor Recaudación Hoy
                </h3>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Ranking</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDriversData} layout="vertical">
                    <XAxis type="number" stroke="#71717a" fontSize={11} tickFormatter={(val) => `$${val / 1000}k`} />
                    <YAxis type="category" dataKey="movil" stroke="#71717a" fontSize={11} width={70} />
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toLocaleString('es-CL')}`, 'Recaudación']}
                      contentStyle={{ backgroundColor: '#121215', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                    />
                    <Bar dataKey="recaudacion" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVERS DETAILED EARNINGS BREAKDOWN */}
      {activeTab === 'drivers_breakdown' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xl">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por conductor o móvil (ej: Móvil 05)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121215] border border-zinc-800 text-white pl-9 pr-3 py-2 rounded-xl text-xs focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                Todos ({driverBreakdownList.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending_fee')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  statusFilter === 'pending_fee'
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Con Cuota Pendiente ({driverBreakdownList.filter((d) => d.commissionBalance > 0).length})
              </button>
              <button
                onClick={() => setStatusFilter('high_earner')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'high_earner'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                Mayor Recaudación ($35k+)
              </button>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-[#0d0d0f] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#121215] text-zinc-400 border-b border-zinc-800 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Conductor / Móvil</th>
                    <th className="py-3 px-4">Viajes Hoy</th>
                    <th className="py-3 px-4">Recaudado Bruto</th>
                    <th className="py-3 px-4">Comisión Central (15%)</th>
                    <th className="py-3 px-4">Pago Chofer (85%)</th>
                    <th className="py-3 px-4">Saldo Cuota Radio</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
                  {filteredDriverBreakdown.map((item) => {
                    const { driver, tripsCount, grossEarnings, agencyFee, driverPayout, commissionBalance } = item;
                    const isPending = commissionBalance > 0;

                    return (
                      <tr key={driver.id} className="hover:bg-zinc-900/50 transition">
                        {/* Driver Info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={driver.photoUrl}
                              alt={driver.name}
                              className="w-10 h-10 rounded-full object-cover border border-amber-500/40 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{driver.unitNumber}</span>
                                <span className="text-zinc-400 font-normal">• {driver.name}</span>
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2 mt-0.5">
                                <span>★ {driver.rating.toFixed(2)}</span>
                                <span>Tel: {driver.phone}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Trips Count */}
                        <td className="py-3 px-4 font-mono font-bold text-zinc-300">
                          {tripsCount} viajes
                        </td>

                        {/* Gross Earnings */}
                        <td className="py-3 px-4 font-mono font-extrabold text-white text-sm">
                          ${grossEarnings.toLocaleString('es-CL')}
                        </td>

                        {/* Agency Fee */}
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          ${agencyFee.toLocaleString('es-CL')}
                        </td>

                        {/* Driver Net Payout */}
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          ${driverPayout.toLocaleString('es-CL')}
                        </td>

                        {/* Commission Balance */}
                        <td className="py-3 px-4">
                          {isPending ? (
                            <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-bold text-[11px] rounded-lg inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              ${commissionBalance.toLocaleString('es-CL')} Pendiente
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[11px] rounded-lg inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Al Día ($0)
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Detailed Settlement Modal */}
                            <button
                              onClick={() => setSelectedDriverForSettlement(driver)}
                              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg transition flex items-center gap-1"
                              title="Ver detalle de viajes y rendición"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                              <span>Rendición</span>
                            </button>

                            {/* WhatsApp Share */}
                            <button
                              onClick={() => handleShareWhatsApp(driver, item)}
                              className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition"
                              title="Enviar rendición por WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Settle Commission Button */}
                            {isPending && (
                              <button
                                onClick={() => handleSettleCommission(driver.id, driver.name, driver.unitNumber)}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-lg transition shadow flex items-center gap-1"
                                title="Registrar cobro de cuota"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Cobrar</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT METHOD DISTRIBUTION */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-xl space-y-2">
              <div className="text-emerald-400 font-mono text-xs uppercase font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                <span>Efectivo en Mano (Recibido Choferes)</span>
              </div>
              <div className="text-3xl font-extrabold text-white font-mono">
                ${(financialMetrics.totalCash || 120000).toLocaleString('es-CL')}
              </div>
              <p className="text-xs text-zinc-400">
                Cobrado en efectivo directamente en los vehículos por los conductores.
              </p>
            </div>

            <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-blue-500/30 bg-blue-500/5 shadow-xl space-y-2">
              <div className="text-blue-400 font-mono text-xs uppercase font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Digital / MercadoPago / Posnet</span>
              </div>
              <div className="text-3xl font-extrabold text-white font-mono">
                ${(financialMetrics.totalDigital || 65000).toLocaleString('es-CL')}
              </div>
              <p className="text-xs text-zinc-400">
                Transferencias electrónicas y pagos bancarios procesados.
              </p>
            </div>

            <div className="bg-[#0d0d0f] p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-xl space-y-2">
              <div className="text-amber-400 font-mono text-xs uppercase font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Cuentas Corrientes Empresas</span>
              </div>
              <div className="text-3xl font-extrabold text-white font-mono">
                ${(financialMetrics.totalCreditAccount || 25000).toLocaleString('es-CL')}
              </div>
              <p className="text-xs text-zinc-400">
                Viajes corporativos facturados a convenio mensual de empresas clientes.
              </p>
            </div>
          </div>

          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-white uppercase tracking-tight flex items-center gap-2 font-sans">
              <PieChart className="w-4 h-4 text-amber-400" />
              Proporción Global de Pagos de la Agencia
            </h3>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdownPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => `${entry.name}: $${entry.value.toLocaleString('es-CL')}`}
                  >
                    {paymentBreakdownPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`$${Number(val).toLocaleString('es-CL')}`, 'Monto Total']}
                    contentStyle={{ backgroundColor: '#121215', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REGISTERED AGENCIES & MULTI-TENANT SELECTOR */}
      {activeTab === 'agencies' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((comp) => {
              const isSelected = comp.id === currentCompany.id;
              return (
                <div
                  key={comp.id}
                  className={`bg-[#0d0d0f] border rounded-2xl p-5 space-y-4 shadow-xl transition ${
                    isSelected ? 'border-amber-500/80 bg-amber-500/5' : 'border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-extrabold text-lg text-white">{comp.name}</h2>
                      <div className="text-xs text-amber-400 font-mono font-bold">Código: {comp.code}</div>
                    </div>
                    {isSelected && (
                      <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-extrabold text-[10px] rounded-md uppercase tracking-wider">
                        Agencia Activa
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-zinc-300 font-sans">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{comp.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{comp.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-400 font-mono">
                      <Radio className="w-3.5 h-3.5" />
                      <span>{comp.vhfFrequency}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-zinc-800">
                    <div className="bg-[#121215] p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-zinc-400 text-[10px] uppercase tracking-wider block">Móviles Flota</span>
                      <span className="font-bold text-white text-sm">{comp.totalVehicles}</span>
                    </div>
                    <div className="bg-[#121215] p-2.5 rounded-lg border border-zinc-800">
                      <span className="text-zinc-400 text-[10px] uppercase tracking-wider block">Conductores</span>
                      <span className="font-bold text-white text-sm">{comp.totalDrivers}</span>
                    </div>
                  </div>

                  {!isSelected && (
                    <button
                      onClick={() => setCurrentCompany(comp)}
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs rounded-lg transition uppercase tracking-wider"
                    >
                      Conectarse a esta Agencia
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: RENDICION DE CUENTAS DETALLADA DEL CONDUCTOR */}
      {selectedDriverForSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedDriverForSettlement.photoUrl}
                  alt={selectedDriverForSettlement.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/50"
                />
                <div>
                  <h2 className="font-extrabold text-lg text-white">
                    Hoja de Rendición - {selectedDriverForSettlement.unitNumber}
                  </h2>
                  <div className="text-xs text-amber-400 font-mono">
                    Conductor: {selectedDriverForSettlement.name} • Licencia: {selectedDriverForSettlement.licenseNumber}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedDriverForSettlement(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Grid */}
            {(() => {
              const driverItem = driverBreakdownList.find((d) => d.driver.id === selectedDriverForSettlement.id);
              if (!driverItem) return null;

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="bg-[#121215] p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] uppercase block">Recaudación Bruta</span>
                      <span className="font-bold text-white text-base">${driverItem.grossEarnings.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="bg-[#121215] p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <span className="text-amber-400 text-[10px] uppercase block">Comisión Central (15%)</span>
                      <span className="font-bold text-amber-300 text-base">${driverItem.agencyFee.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="bg-[#121215] p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] uppercase block">Neto Conductor</span>
                      <span className="font-bold text-blue-400 text-base">${driverItem.driverPayout.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="bg-[#121215] p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-500 text-[10px] uppercase block">Saldo Cuota Radio</span>
                      <span className={`font-bold text-base ${driverItem.commissionBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ${driverItem.commissionBalance.toLocaleString('es-CL')}
                      </span>
                    </div>
                  </div>

                  {/* Individual Trips List */}
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                      Detalle de Viajes Despachados Hoy ({driverItem.tripsList.length} viajes)
                    </div>

                    {driverItem.tripsList.length === 0 ? (
                      <div className="p-4 bg-[#121215] rounded-xl text-center text-xs text-zinc-500 font-mono">
                        No hay registros individuales en el historial rápido. Recaudación asignada por planilla general.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {driverItem.tripsList.map((t) => (
                          <div
                            key={t.id}
                            className="bg-[#121215] p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between text-xs font-sans"
                          >
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span className="font-mono text-amber-400">{t.code}</span>
                                <span>{t.clientName}</span>
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                {t.origin.address} ➔ {t.destination.address}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="font-bold text-emerald-400">${(t.finalFare || t.estimatedFare).toLocaleString('es-CL')}</div>
                              <div className="text-[10px] text-zinc-500 uppercase">{t.paymentMethod}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>

                      <button
                        onClick={() => handleShareWhatsApp(selectedDriverForSettlement, driverItem)}
                        className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    </div>

                    {driverItem.commissionBalance > 0 && (
                      <button
                        onClick={() => {
                          handleSettleCommission(
                            selectedDriverForSettlement.id,
                            selectedDriverForSettlement.name,
                            selectedDriverForSettlement.unitNumber
                          );
                          setSelectedDriverForSettlement(null);
                        }}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Registrar Cobro de Cuota</span>
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
