import React, { useState } from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  FileSpreadsheet,
  UserCheck,
  Bell,
  LogOut,
  Sparkles,
  ChevronDown,
  Plus,
  PhoneCall,
  Calendar,
  AlertTriangle,
  X,
  Target,
  MessageCircle,
  Phone,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCrm } from '../context/CrmContext';
import {
  isFollowUpOverdue,
  isFollowUpToday,
  formatDateTimeSpanish,
  createWhatsAppUrl,
  formatPhoneNumber,
  isContactAssignedToUser,
} from '../utils/formatters';
import { Contacto } from '../types/crm';

export type ActiveTab = 'kanban' | 'list' | 'dashboard' | 'csv' | 'users';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNewContact: () => void;
  onOpenContact: (contact: Contacto) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onNewContact,
  onOpenContact,
}) => {
  const { userProfile, isAdmin, logout } = useAuth();
  const { contacts, myAssignedContacts, allContacts, users } = useCrm();

  const [showOverdueDropdown, setShowOverdueDropdown] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'assigned' | 'urgent'>('assigned');

  // Helper to change tab and ensure scroll resets to top
  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // Leads asignados a este usuario pendientes de atención
  // (nunca contactados, estado pendiente o asignados recientemente en los últimos 7 días)
  const newlyAssignedLeads = React.useMemo(() => {
    const pool = isAdmin
      ? allContacts.filter((c) => isContactAssignedToUser(c, userProfile, users))
      : myAssignedContacts;

    return pool
      .filter((c) => {
        if (c.estadoContacto === 'Ganado' || c.estadoContacto === 'Perdido' || c.etapa?.startsWith('M13')) {
          return false;
        }
        // Sin contactar aún o estado pendiente
        if (!c.fechaUltimoContacto || c.estadoContacto === 'Pendiente') return true;
        // O asignado en los últimos 7 días
        if (c.fechaAsignacion) {
          const diffMs = Date.now() - new Date(c.fechaAsignacion).getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays <= 7) return true;
        }
        return false;
      })
      .sort((a, b) => {
        const aNo = !a.fechaUltimoContacto ? 1 : 0;
        const bNo = !b.fechaUltimoContacto ? 1 : 0;
        if (aNo !== bNo) return bNo - aNo;
        const aD = a.fechaAsignacion || a.actualizadoEn || a.creadoEn;
        const bD = b.fechaAsignacion || b.actualizadoEn || b.creadoEn;
        return new Date(bD).getTime() - new Date(aD).getTime();
      });
  }, [isAdmin, allContacts, myAssignedContacts, userProfile, users]);

  // Cartera relevante para seguimientos programados (para vendedor, su cartera asignada)
  const followUpTargetContacts = isAdmin ? contacts : myAssignedContacts;

  // Overdue and today follow-ups
  const overdueContacts = followUpTargetContacts.filter(
    (c) =>
      c.proximoSeguimiento &&
      isFollowUpOverdue(c.proximoSeguimiento) &&
      c.estadoContacto !== 'Ganado' &&
      c.estadoContacto !== 'Perdido'
  );

  const todayContacts = followUpTargetContacts.filter(
    (c) =>
      c.proximoSeguimiento &&
      isFollowUpToday(c.proximoSeguimiento) &&
      !isFollowUpOverdue(c.proximoSeguimiento)
  );

  const urgentFollowUpsCount = overdueContacts.length + todayContacts.length;
  const totalUrgentCount = urgentFollowUpsCount + newlyAssignedLeads.length;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
      {/* Top Banner with Quick Role Switcher */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium text-slate-200">Quicksurfaces Miami</span>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline text-slate-400">Pisos Vinil SPC, Tile, Wall Panels & Steps</span>
        </div>

        {/* User Real Role & Identity + Firebase Status */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-[11px] text-amber-300">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-semibold">🔥 Firestore Activo</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold">
            <span className={isAdmin ? 'text-amber-400 font-bold' : 'text-[#FF8407] font-bold'}>
              {isAdmin ? '👑 Admin' : '💼 Vendedor'}
            </span>
            <span className="text-slate-300">
              {userProfile?.nombre || userProfile?.email}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('kanban')}
              className="flex items-baseline cursor-pointer select-none group"
            >
              <span className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-slate-800">
                Quick
              </span>
              <span className="text-2xl font-black tracking-tight text-[#FF8407]">
                CRM
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
            <button
              id="nav-tab-kanban"
              onClick={() => handleSelectTab('kanban')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                activeTab === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <KanbanSquare className={`w-4 h-4 ${activeTab === 'kanban' ? 'text-[#FF8407]' : 'text-slate-500'}`} />
              <span>Kanban</span>
            </button>

            <button
              id="nav-tab-list"
              onClick={() => handleSelectTab('list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                activeTab === 'list'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'list' ? 'text-[#FF8407]' : 'text-slate-500'}`} />
              <span>Contactos</span>
            </button>

            <button
              id="nav-tab-dashboard"
              onClick={() => handleSelectTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-[#FF8407]' : 'text-slate-500'}`} />
              <span>Dashboard</span>
            </button>

            {/* Admin Only Tabs */}
            {isAdmin && (
              <>
                <button
                  id="nav-tab-csv"
                  onClick={() => handleSelectTab('csv')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === 'csv'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'csv' ? 'text-[#FF8407]' : 'text-slate-500'}`} />
                  <span>CSV</span>
                  <span className="text-[10px] font-bold px-1 rounded bg-amber-100 text-amber-800">Admin</span>
                </button>

                <button
                  id="nav-tab-users"
                  onClick={() => handleSelectTab('users')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === 'users'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <UserCheck className={`w-4 h-4 ${activeTab === 'users' ? 'text-[#FF8407]' : 'text-slate-500'}`} />
                  <span>Equipo</span>
                  <span className="text-[10px] font-bold px-1 rounded bg-amber-100 text-amber-800">Admin</span>
                </button>
              </>
            )}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Follow-up Alerts Bell */}
            <div className="relative">
              <button
                id="overdue-alerts-bell"
                onClick={() => setShowOverdueDropdown(!showOverdueDropdown)}
                className={`relative p-2 rounded-xl transition ${
                  totalUrgentCount > 0
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Seguimientos pendientes y vencidos"
              >
                <Bell className="w-5 h-5" />
                {totalUrgentCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-bounce">
                    {totalUrgentCount}
                  </span>
                )}
              </button>

              {/* Notifications Alerts Modal / Dropdown */}
              {showOverdueDropdown && (
                <>
                  {/* Backdrop on mobile */}
                  <div
                    className="fixed inset-0 bg-black/40 z-50 sm:hidden"
                    onClick={() => setShowOverdueDropdown(false)}
                  />

                  <div
                    id="overdue-list-dropdown"
                    className="fixed inset-0 sm:inset-auto sm:absolute sm:right-0 sm:mt-2 w-full sm:w-[26rem] h-full sm:h-auto max-h-none sm:max-h-[34rem] bg-white sm:rounded-2xl shadow-2xl sm:shadow-xl sm:border sm:border-slate-200 p-4 sm:p-3.5 z-50 flex flex-col animate-in fade-in duration-150"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
                        <Bell className="w-5 h-5 sm:w-4 sm:h-4 text-[#FF8407]" />
                        <span>Centro de Notificaciones</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-orange-100 text-[#EA580C] font-bold px-2 py-0.5 rounded-full">
                          {totalUrgentCount} pendientes
                        </span>
                        <button
                          onClick={() => setShowOverdueDropdown(false)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                          title="Cerrar"
                          aria-label="Cerrar"
                        >
                          <X className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Dual Tabs: Leads Asignados vs Seguimientos */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl my-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setNotificationTab('assigned')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          notificationTab === 'assigned'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Target className={`w-3.5 h-3.5 ${notificationTab === 'assigned' ? 'text-[#FF8407]' : 'text-slate-400'}`} />
                        <span>Leads Asignados</span>
                        {newlyAssignedLeads.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500 text-white font-black animate-pulse">
                            {newlyAssignedLeads.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setNotificationTab('urgent')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          notificationTab === 'urgent'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <AlertTriangle className={`w-3.5 h-3.5 ${notificationTab === 'urgent' ? 'text-red-500' : 'text-slate-400'}`} />
                        <span>Seguimientos</span>
                        {urgentFollowUpsCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-600 text-white font-black">
                            {urgentFollowUpsCount}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-1">
                      {/* ================= TAB 1: LEADS ASIGNADOS ================= */}
                      {notificationTab === 'assigned' && (
                        <>
                          {newlyAssignedLeads.length === 0 ? (
                            <div className="py-12 sm:py-8 text-center text-xs text-slate-500 space-y-1">
                              <div className="text-2xl mb-1">🎉</div>
                              <p className="font-semibold text-slate-800">No tienes leads asignados pendientes</p>
                              <p className="text-[11px] text-slate-400">Todos tus clientes asignados han sido contactados.</p>
                            </div>
                          ) : (
                            newlyAssignedLeads.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  onOpenContact(c);
                                  setShowOverdueDropdown(false);
                                }}
                                className="p-3 hover:bg-orange-50/60 rounded-xl cursor-pointer transition group space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 animate-ping" />
                                    <span className="font-bold text-xs text-slate-900 group-hover:text-[#FF8407] truncate">
                                      {c.nombre}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-black text-[#EA580C] bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-md shrink-0">
                                    {c.etapa ? c.etapa.split('—')[0].trim() : 'Asignado'}
                                  </span>
                                </div>

                                {c.personaEncargada && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-700 font-medium truncate">
                                    <User className="w-3 h-3 text-[#FF8407] shrink-0" />
                                    <span className="truncate">
                                      Encargado: <strong className="text-slate-900 font-semibold">{c.personaEncargada}</strong>
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span>{c.rolCargo}</span>
                                    {c.telefono && (
                                      <>
                                        <span>•</span>
                                        <span className="font-semibold text-slate-700">{formatPhoneNumber(c.telefono)}</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Quick Actions */}
                                  <div
                                    className="flex items-center gap-1 shrink-0 ml-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {c.telefono && (
                                      <a
                                        href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                                        title="Llamar al cliente"
                                        className="p-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 transition"
                                      >
                                        <Phone className="w-3 h-3" />
                                      </a>
                                    )}
                                    {c.telefono && (
                                      <a
                                        href={createWhatsAppUrl(c.telefono, c.personaEncargada || c.nombre)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Enviar WhatsApp"
                                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition"
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {c.asignadoPor && (
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    Asignado por: <span className="text-slate-600 font-semibold">{c.asignadoPor}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </>
                      )}

                      {/* ================= TAB 2: SEGUIMIENTOS URGENTES ================= */}
                      {notificationTab === 'urgent' && (
                        <>
                          {urgentFollowUpsCount === 0 ? (
                            <div className="py-12 sm:py-8 text-center text-xs text-slate-500">
                              🎉 ¡Excelente! No tienes llamadas vencidas ni programadas para hoy.
                            </div>
                          ) : (
                            <>
                              {overdueContacts.map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    onOpenContact(c);
                                    setShowOverdueDropdown(false);
                                  }}
                                  className="p-3 hover:bg-red-50/50 rounded-xl cursor-pointer transition group"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-slate-900 group-hover:text-[#FF8407]">
                                      {c.nombre}
                                    </span>
                                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                      ¡Vencido!
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                                    <span>{c.rolCargo}</span>
                                    <span className="font-medium text-red-700">
                                      {formatDateTimeSpanish(c.proximoSeguimiento)}
                                    </span>
                                  </div>
                                </div>
                              ))}

                              {todayContacts.map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    onOpenContact(c);
                                    setShowOverdueDropdown(false);
                                  }}
                                  className="p-3 hover:bg-amber-50/50 rounded-xl cursor-pointer transition group"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-slate-900 group-hover:text-[#FF8407]">
                                      {c.nombre}
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                      Hoy
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                                    <span>{c.rolCargo}</span>
                                    <span className="font-medium text-amber-800">
                                      {formatDateTimeSpanish(c.proximoSeguimiento)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick New Contact Button */}
            <button
              id="btn-new-contact-main"
              onClick={onNewContact}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF8407] hover:bg-[#E57300] text-white text-sm font-bold shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Nuevo Contacto</span>
            </button>

            {/* Logout */}
            <button
              onClick={() => logout()}
              title="Cerrar sesión"
              className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Fixed Navigation Bar (Thumb-friendly for field sales) */}
      <nav
        id="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.07)] py-1 px-2 md:hidden flex items-center justify-around pb-safe"
      >
        <button
          onClick={() => handleSelectTab('kanban')}
          className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
            activeTab === 'kanban' ? 'text-[#FF8407] bg-orange-50/80' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <KanbanSquare className="w-5 h-5 mb-0.5" />
          <span>Pipeline</span>
        </button>

        <button
          onClick={() => handleSelectTab('list')}
          className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
            activeTab === 'list' ? 'text-[#FF8407] bg-orange-50/80' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Contactos</span>
        </button>

        <button
          onClick={() => handleSelectTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
            activeTab === 'dashboard' ? 'text-[#FF8407] bg-orange-50/80' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Dashboard</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => handleSelectTab('csv')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
              activeTab === 'csv' ? 'text-[#FF8407] bg-orange-50/80' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5 mb-0.5" />
            <span>CSV</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => handleSelectTab('users')}
            className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
              activeTab === 'users' ? 'text-[#FF8407] bg-orange-50/80' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-5 h-5 mb-0.5" />
            <span>Equipo</span>
          </button>
        )}
      </nav>
    </header>
  );
};
