import React, { useState, useMemo } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  KanbanSquare,
  TrendingUp,
  UserCheck,
  PhoneCall,
  Calendar,
  Layers,
  Building,
  ArrowRight,
  MessageCircle,
  FileText,
  Tag,
  BarChart3,
  Phone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCrm } from '../context/CrmContext';
import {
  PIPELINE_STAGES,
  FUNNEL_STAGES,
  CLIENT_SEGMENTS,
  TIPOS_CLIENTE,
  ROLES_CARGO,
  Contacto,
} from '../types/crm';
import {
  isFollowUpOverdue,
  isFollowUpToday,
  formatDateSpanish,
  daysSinceLastContact,
  createWhatsAppUrl,
  formatPhoneNumber,
} from '../utils/formatters';

interface DashboardViewProps {
  onOpenContact: (contact: Contacto) => void;
  onGoToKanban: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenContact,
  onGoToKanban,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const { contacts, allContacts, users, claimContact, updateContact } = useCrm();

  const [neglectedDaysThreshold, setNeglectedDaysThreshold] = useState<number>(14);

  // Stats calculation
  const targetContacts = isAdmin ? allContacts : contacts;

  // Personal / Assigned stats
  const totalContacts = targetContacts.length;
  const overdueFollowUps = targetContacts.filter((c) =>
    isFollowUpOverdue(c.proximoSeguimiento)
  );
  const todayFollowUps = targetContacts.filter(
    (c) => isFollowUpToday(c.proximoSeguimiento) && !isFollowUpOverdue(c.proximoSeguimiento)
  );
  const wonContacts = targetContacts.filter((c) => c.estadoContacto === 'Ganado');
  const vipContacts = targetContacts.filter((c) => c.tipoCliente === 'VIP');

  // Contactos en F6 — Cotización Enviada
  const f6Contacts = targetContacts.filter(
    (c) => c.etapa === 'F6 — Cotización Enviada' || (c.etapa && c.etapa.startsWith('F6'))
  );

  // Contacts without follow up for > X days (sorted by most neglected first)
  const neglectedContacts = useMemo(() => {
    const source = isAdmin ? allContacts : contacts;
    return source
      .filter((c) => {
        // Exclude won/lost contacts from neglected follow-ups if desired, but keep active prospects
        if (c.estadoContacto === 'Ganado' || c.estadoContacto === 'Perdido' || c.etapa?.startsWith('M13')) {
          return false;
        }
        if (!c.fechaUltimoContacto) return true;
        const days = daysSinceLastContact(c.fechaUltimoContacto);
        return days !== null && days >= neglectedDaysThreshold;
      })
      .map((c) => {
        const days = daysSinceLastContact(c.fechaUltimoContacto);
        return {
          contact: c,
          days,
          // null/never contacted treated as infinity (top priority)
          sortPriority: days === null ? 999999 : days,
        };
      })
      .sort((a, b) => b.sortPriority - a.sortPriority);
  }, [isAdmin, allContacts, contacts, neglectedDaysThreshold]);

  // Funnel stage distribution
  const funnelStageCounts = FUNNEL_STAGES.map((s) => {
    const count = targetContacts.filter(
      (c) => c.etapa === s.label || c.etapa?.startsWith(s.code)
    ).length;
    return {
      stage: s,
      count,
      percent: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0,
    };
  });

  // Segment distribution
  const segmentCounts = CLIENT_SEGMENTS.map((s) => {
    const count = targetContacts.filter(
      (c) =>
        c.segmento === s.label ||
        c.segmento?.startsWith(s.code) ||
        (!c.segmento && (c.etapa === s.label || c.etapa?.startsWith(s.code)))
    ).length;
    return {
      stage: s,
      count,
      percent: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0,
    };
  });

  // Client type distribution
  const tipoCounts = TIPOS_CLIENTE.map((tipo) => {
    const count = targetContacts.filter((c) => c.tipoCliente === tipo).length;
    return {
      tipo,
      count,
      percent: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0,
    };
  });

  // Rep distribution (Admin only)
  const repCounts = users.map((u) => {
    const assigned = allContacts.filter(
      (c) => c.responsable === u.nombre || c.responsable === u.email || c.responsable === u.uid
    );
    const overdue = assigned.filter((c) => isFollowUpOverdue(c.proximoSeguimiento)).length;
    const won = assigned.filter((c) => c.estadoContacto === 'Ganado').length;

    return {
      user: u,
      total: assigned.length,
      overdue,
      won,
    };
  });

  const unassignedCount = allContacts.filter(
    (c) =>
      !c.responsable ||
      c.responsable.toLowerCase().trim() === 'sin asignar' ||
      c.responsable.toLowerCase().trim() === 'unassigned'
  ).length;

  // KPI Distribución por rolCargo (Admin only) - Ordenado de mayor a menor
  const rolCargoCounts = useMemo(() => {
    return ROLES_CARGO.map((cargo) => {
      const count = allContacts.filter((c) => c.rolCargo === cargo).length;
      const percent = allContacts.length > 0 ? Math.round((count / allContacts.length) * 100) : 0;
      return {
        cargo,
        count,
        percent,
      };
    }).sort((a, b) => b.count - a.count);
  }, [allContacts]);

  const maxCargoCount = useMemo(() => {
    return Math.max(...rolCargoCounts.map((r) => r.count), 1);
  }, [rolCargoCounts]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome & Role Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-wider font-bold text-orange-400">
            <span>{isAdmin ? 'Panel de Control Administrativo' : 'Dashboard del Vendedor'}</span>
            <span>•</span>
            <span>Quicksurfaces Miami-Dade</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Hola, {userProfile?.nombre || 'Equipo'} 👋
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            {isAdmin
              ? 'Monitorea el rendimiento del pipeline comercial, vendedores y clientes desatendidos.'
              : 'Aquí está el resumen de tus clientes, cotizaciones y llamadas pendientes para hoy.'}
          </p>
        </div>

        <button
          onClick={onGoToKanban}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF8407] hover:bg-[#E57300] text-white font-bold text-sm rounded-xl shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
        >
          <KanbanSquare className="w-4 h-4" />
          <span>Ver Tablero Kanban</span>
        </button>
      </div>

      {/* Primary KPI Metric Cards (5 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Contactos */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isAdmin ? 'Contactos' : 'Mis Contactos'}
            </span>
            <div className="p-2 rounded-xl bg-orange-50 text-[#FF8407]">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalContacts}
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {vipContacts.length} clientes VIP
          </p>
        </div>

        {/* F6: Cotizaciones Enviadas */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-orange-200 bg-gradient-to-b from-orange-50/30 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#EA580C] uppercase tracking-wider flex items-center gap-1">
              <span>Etapa F6</span>
            </span>
            <div className="p-2 rounded-xl bg-orange-100 text-[#EA580C]">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#EA580C] mt-2">
            {f6Contacts.length}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-semibold truncate">
            Cotizaciones enviadas
          </p>
        </div>

        {/* Seguimientos para Hoy */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Llamar Hoy
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-2">
            {todayFollowUps.length}
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">Programados para el día</p>
        </div>

        {/* Seguimientos Vencidos */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Vencidos
            </span>
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-600 mt-2">
            {overdueFollowUps.length}
          </div>
          <p className="text-xs text-red-500 mt-1 truncate">Llamada urgente</p>
        </div>

        {/* Cierres Ganados o Sin Asignar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isAdmin ? 'Sin Asignar' : 'Ganadas'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              {isAdmin ? <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" /> : <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">
            {isAdmin ? unassignedCount : wonContacts.length}
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {isAdmin ? 'Por asignar' : 'Cierres exitosos'}
          </p>
        </div>
      </div>

      {/* Urgent Follow-Up Queue (Calls to make immediately) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 text-red-700">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Cola de Llamadas Prioritarias
              </h2>
              <p className="text-xs text-slate-500">
                Clientes con seguimiento vencido o programado para hoy en Miami
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-700 rounded-lg">
            {overdueFollowUps.length + todayFollowUps.length} pendientes
          </span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {overdueFollowUps.length === 0 && todayFollowUps.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
              ✨ ¡Excelente trabajo! No tienes llamadas vencidas ni pendientes para hoy.
            </div>
          ) : (
            [...overdueFollowUps, ...todayFollowUps].map((c) => {
              const isOverdue = isFollowUpOverdue(c.proximoSeguimiento);
              return (
                <div
                  key={c.id}
                  onClick={() => onOpenContact(c)}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 hover:bg-orange-50/50 border border-slate-200 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isOverdue ? 'bg-red-500 animate-ping' : 'bg-amber-400'
                      }`}
                    ></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">
                          {c.nombre}
                        </span>
                        {c.tipoCliente === 'VIP' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                            VIP
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">({c.rolCargo})</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Etapa: <strong className="text-slate-700">{c.etapa}</strong> • Resp:{' '}
                        {c.responsable}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        isOverdue
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isOverdue ? '¡Vencido!' : 'Para hoy'}
                    </span>

                    <a
                      href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                      title="Llamar directo"
                      className="p-1.5 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={createWhatsAppUrl(c.telefono, c.nombre)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir WhatsApp"
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Stage Breakdown & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts by Stage (Kanban Funnel & Segmentos) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FF8407]" />
              <span>Embudo Comercial y Segmentos</span>
            </h2>
            <span className="text-xs text-slate-500 font-semibold">{totalContacts} contactos</span>
          </div>

          {/* Sub-sección 1: Embudo Secuencial */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                <span>Embudo de Venta (A1 → F6)</span>
              </span>
              <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">
                Secuencial
              </span>
            </div>

            <div className="space-y-2.5">
              {funnelStageCounts.map(({ stage, count, percent }) => (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      ></span>
                      <span className="font-semibold text-slate-800">
                        {stage.code} — {stage.nombre}
                      </span>
                      {stage.code === 'F6' && (
                        <span className="text-[9px] font-black text-[#EA580C] bg-orange-100 px-1.5 py-0.2 rounded">
                          QuickQuote
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <span>{count}</span>
                      <span className="text-slate-400 text-[10px] w-8 text-right">{percent}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: stage.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sub-sección 2: Segmentos de Cartera */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-purple-600" />
                <span>Segmentos de Cliente (Post-Venta)</span>
              </span>
              <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded">
                Comportamiento
              </span>
            </div>

            <div className="space-y-2">
              {segmentCounts.map(({ stage, count, percent }) => (
                <div key={stage.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      ></span>
                      <span className="font-semibold text-slate-800">
                        {stage.code} — {stage.nombre}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <span>{count}</span>
                      <span className="text-slate-400 text-[10px] w-8 text-right">{percent}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: stage.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contacts by Client Type */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF8407]" />
              <span>Distribución por Tipo de Cliente</span>
            </h2>
          </div>

          <div className="space-y-4">
            {tipoCounts.map(({ tipo, count, percent }) => (
              <div key={tipo} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-900">{tipo}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800">{count} clientes</span>
                    <span className="text-slate-500 text-[10px]">({percent}%)</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      tipo === 'VIP'
                        ? 'bg-[#FF8407]'
                        : tipo === 'Compró Antes'
                        ? 'bg-blue-600'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin Exclusive: Performance by Sales Rep, KPI Rol/Cargo & Neglected Contacts */}
      {isAdmin && (
        <div className="space-y-6 pt-2">
          {/* Gráfica de Barras KPI: Distribución por rolCargo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#FF8407]" />
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Distribución de Clientes por Perfil (Rol / Cargo)
                  </h2>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-100 text-[#FF8407] border border-orange-200">
                    KPI Admin
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Volumen de contactos según su actividad comercial, ordenado de mayor a menor cantidad
                </p>
              </div>
              <div className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                Total Cartera: <span className="text-slate-900 font-extrabold">{allContacts.length}</span>
              </div>
            </div>

            {/* Gráfica de Barras Horizontal */}
            <div className="space-y-3.5">
              {rolCargoCounts.map(({ cargo, count, percent }, idx) => {
                const barWidth = maxCargoCount > 0 ? (count / maxCargoCount) * 100 : 0;
                return (
                  <div
                    key={cargo}
                    className="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 transition"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                            idx === 0
                              ? 'bg-[#FF8407] text-white shadow-2xs'
                              : idx === 1
                              ? 'bg-amber-400 text-slate-900'
                              : idx === 2
                              ? 'bg-slate-300 text-slate-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="font-extrabold text-slate-900 truncate text-xs sm:text-sm">
                          {cargo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-slate-900 text-xs sm:text-sm">
                          {count}{' '}
                          <span className="text-slate-500 font-normal text-xs">
                            {count === 1 ? 'contacto' : 'contactos'}
                          </span>
                        </span>
                        <span className="text-slate-400 font-bold text-xs min-w-10 text-right">
                          ({percent}%)
                        </span>
                      </div>
                    </div>

                    {/* Barra visual con animación de ancho */}
                    <div className="w-full h-3.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-gradient-to-r from-orange-500 to-[#FF8407]'
                            : idx === 1
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                            : idx === 2
                            ? 'bg-gradient-to-r from-sky-500 to-blue-500'
                            : 'bg-gradient-to-r from-slate-400 to-slate-500'
                        }`}
                        style={{ width: `${Math.max(barWidth, count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance by Sales Rep */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
              <UserCheck className="w-4 h-4 text-[#FF8407]" />
              <span>Contactos Asignados por Vendedor</span>
            </h2>

            <div className="space-y-3">
              {repCounts.map(({ user, total, overdue, won }) => (
                <div
                  key={user.uid}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{user.nombre}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold shrink-0">
                        {user.rol}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">{user.email}</div>
                  </div>

                  {/* 3-column fixed grid on mobile, row on sm+ */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 sm:pt-0 sm:border-0 sm:flex sm:items-center sm:gap-4 shrink-0">
                    <div className="bg-white sm:bg-transparent rounded-lg p-1.5 sm:p-0 border border-slate-200/60 sm:border-0 text-center">
                      <div className="font-black text-slate-900 text-sm sm:text-xs">{total}</div>
                      <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Total</div>
                    </div>
                    <div className="bg-white sm:bg-transparent rounded-lg p-1.5 sm:p-0 border border-slate-200/60 sm:border-0 text-center">
                      <div className="font-black text-red-600 text-sm sm:text-xs">{overdue}</div>
                      <div className="text-[10px] text-red-500 font-medium whitespace-nowrap">Vencidos</div>
                    </div>
                    <div className="bg-white sm:bg-transparent rounded-lg p-1.5 sm:p-0 border border-slate-200/60 sm:border-0 text-center">
                      <div className="font-black text-emerald-600 text-sm sm:text-xs">{won}</div>
                      <div className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">Ganados</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Neglected Contacts (No follow up > X days) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Contactos Desatendidos</span>
              </h2>

              <div className="relative inline-block shrink-0">
                <select
                  id="neglected-days-threshold-select"
                  value={neglectedDaysThreshold}
                  onChange={(e) => setNeglectedDaysThreshold(Number(e.target.value))}
                  className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  title="Cambiar umbral de días sin contacto"
                >
                  <option value={7}>Umbral: 7+ días sin contacto ▾</option>
                  <option value={14}>Umbral: 14+ días sin contacto ▾</option>
                  <option value={30}>Umbral: 30+ días sin contacto ▾</option>
                  <option value={60}>Umbral: 60+ días sin contacto ▾</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {neglectedContacts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  👏 Todo el equipo está al día con los clientes para este umbral de {neglectedDaysThreshold} días.
                </div>
              ) : (
                neglectedContacts.slice(0, 15).map(({ contact: c, days }) => {
                  const isUnassigned =
                    !c.responsable ||
                    c.responsable.toLowerCase().trim() === 'sin asignar' ||
                    c.responsable.toLowerCase().trim() === 'unassigned';

                  return (
                    <div
                      key={c.id}
                      onClick={() => onOpenContact(c)}
                      className="p-3.5 rounded-xl bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200/90 flex flex-col justify-between gap-2.5 cursor-pointer transition text-xs group shadow-2xs"
                    >
                      {/* Línea 1: Nombre del contacto + badge pequeño de la etapa */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 group-hover:text-amber-900 transition truncate text-sm">
                          {c.nombre}
                        </span>
                        {c.etapa && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shrink-0">
                            {c.etapa.split('—')[0].trim()}
                          </span>
                        )}
                      </div>

                      {/* Línea 2: Rol/Cargo seguido del teléfono con ícono sin puntos sueltos */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
                        {c.rolCargo && (
                          <span className="font-medium text-slate-700">{c.rolCargo}</span>
                        )}
                        {c.rolCargo && c.telefono && (
                          <span className="text-slate-300">•</span>
                        )}
                        {c.telefono && (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{formatPhoneNumber(c.telefono)}</span>
                          </span>
                        )}
                        {c.responsable && !isUnassigned && (
                          <>
                            {(c.rolCargo || c.telefono) && <span className="text-slate-300">•</span>}
                            <span className="text-slate-400">
                              Resp: <strong className="text-slate-600 font-semibold">{c.responsable.split(' ')[0]}</strong>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Línea 3 (fila inferior): Badge a la izquierda, acciones rápidas (+ Tomar, llamar, WhatsApp) a la derecha */}
                      <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between gap-2">
                        {/* Izquierda: Badge de estado */}
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                            days === null
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : days >= 30
                              ? 'bg-red-50 text-red-800 border-red-200 font-black'
                              : 'bg-white text-amber-900 border-amber-200'
                          }`}
                        >
                          {days !== null ? `${days} días sin contacto` : 'Nunca contactado'}
                        </span>

                        {/* Derecha: Acciones rápidas */}
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Botón "+ Tomar" si está sin asignar */}
                          {isUnassigned && (
                            isAdmin ? (
                              <div className="relative inline-flex items-center">
                                <button
                                  type="button"
                                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                  title="Asignar este contacto a un vendedor"
                                >
                                  <span>+ Tomar</span>
                                </button>
                                <select
                                  value=""
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    if (val === '__me__') {
                                      await claimContact(c.id);
                                    } else {
                                      await updateContact(c.id, { responsable: val });
                                    }
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
                                  title="Asignar a un vendedor"
                                >
                                  <option value="" disabled>Seleccionar responsable...</option>
                                  <option value="__me__">Tomar para mí ({userProfile?.nombre?.split(' ')[0] || 'Admin'})</option>
                                  <optgroup label="Asignar a vendedor">
                                    {users
                                      .filter((u) => u.activo !== false)
                                      .map((u) => (
                                        <option key={u.id} value={u.nombre}>
                                          {u.nombre} {u.rol ? `(${u.rol})` : ''}
                                        </option>
                                      ))}
                                  </optgroup>
                                </select>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  await claimContact(c.id);
                                }}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 transition flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                                title="Asignarme este contacto"
                              >
                                <span>+ Tomar</span>
                              </button>
                            )
                          )}

                          {/* Botón Llamar */}
                          {c.telefono && (
                            <a
                              href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                              className="p-1.5 rounded-lg text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 transition min-h-[32px] min-w-[32px] flex items-center justify-center shadow-2xs"
                              title="Llamar al cliente"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Botón WhatsApp */}
                          {c.telefono && (
                            <a
                              href={createWhatsAppUrl(c.telefono, c.nombre)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 transition min-h-[32px] min-w-[32px] flex items-center justify-center shadow-2xs"
                              title="Enviar WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};
