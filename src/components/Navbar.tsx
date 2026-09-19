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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCrm } from '../context/CrmContext';
import { isFollowUpOverdue, isFollowUpToday, formatDateTimeSpanish } from '../utils/formatters';
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
  const { contacts } = useCrm();

  const [showOverdueDropdown, setShowOverdueDropdown] = useState(false);

  // Helper to change tab and ensure scroll resets to top
  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // Overdue and today follow-ups
  const overdueContacts = contacts.filter(
    (c) =>
      c.proximoSeguimiento &&
      isFollowUpOverdue(c.proximoSeguimiento) &&
      c.estadoContacto !== 'Ganado' &&
      c.estadoContacto !== 'Perdido'
  );

  const todayContacts = contacts.filter(
    (c) =>
      c.proximoSeguimiento &&
      isFollowUpToday(c.proximoSeguimiento) &&
      !isFollowUpOverdue(c.proximoSeguimiento)
  );

  const totalUrgentCount = overdueContacts.length + todayContacts.length;

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

              {/* Overdue Alerts Modal / Dropdown */}
              {showOverdueDropdown && (
                <>
                  {/* Backdrop on mobile */}
                  <div
                    className="fixed inset-0 bg-black/40 z-50 sm:hidden"
                    onClick={() => setShowOverdueDropdown(false)}
                  />

                  <div
                    id="overdue-list-dropdown"
                    className="fixed inset-0 sm:inset-auto sm:absolute sm:right-0 sm:mt-2 w-full sm:w-96 h-full sm:h-auto max-h-none sm:max-h-[32rem] bg-white sm:rounded-2xl shadow-2xl sm:shadow-xl sm:border sm:border-slate-200 p-4 sm:p-3 z-50 flex flex-col animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
                        <AlertTriangle className="w-5 h-5 sm:w-4 sm:h-4 text-red-500" />
                        <span>Seguimientos Urgentes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
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

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-1">
                      {totalUrgentCount === 0 ? (
                        <div className="py-12 sm:py-6 text-center text-sm sm:text-xs text-slate-500">
                          🎉 ¡Excelente! No tienes seguimientos vencidos por ahora.
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
                              className="p-3 sm:p-2 hover:bg-red-50/50 rounded-xl sm:rounded-lg cursor-pointer transition group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm sm:text-xs text-slate-900 group-hover:text-[#FF8407]">
                                  {c.nombre}
                                </span>
                                <span className="text-[11px] sm:text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                  ¡Vencido!
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-xs sm:text-[11px] text-slate-500">
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
                              className="p-3 sm:p-2 hover:bg-amber-50/50 rounded-xl sm:rounded-lg cursor-pointer transition group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm sm:text-xs text-slate-900 group-hover:text-[#FF8407]">
                                  {c.nombre}
                                </span>
                                <span className="text-[11px] sm:text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                  Hoy
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-xs sm:text-[11px] text-slate-500">
                                <span>{c.rolCargo}</span>
                                <span className="font-medium text-amber-800">
                                  {formatDateTimeSpanish(c.proximoSeguimiento)}
                                </span>
                              </div>
                            </div>
                          ))}
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
