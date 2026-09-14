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
  Upload,
  Plus,
  PhoneCall,
  Calendar,
  AlertTriangle,
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
  const { userProfile, isAdmin, logout, simulateRole } = useAuth();
  const { contacts } = useCrm();

  const [showOverdueDropdown, setShowOverdueDropdown] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomLogoUrl(url);
    }
  };

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

        {/* Role & Demo Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Modo de prueba:</span>
          <div className="relative">
            <button
              id="role-switch-btn"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
            >
              <span className={isAdmin ? 'text-amber-400 font-bold' : 'text-orange-400 font-bold'}>
                {isAdmin ? '👑 Admin' : '💼 Vendedor'}
              </span>
              <span className="text-slate-300">({userProfile?.nombre?.split(' ')[0]})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleMenu && (
              <div
                id="role-menu-dropdown"
                className="absolute right-0 mt-1 w-64 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-1"
              >
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Cambiar rol / usuario
                </div>
                <button
                  onClick={() => {
                    simulateRole('admin', {
                      nombre: 'Esteban Gavotti (Admin)',
                      email: 'esteban.gavotti@quicksurfaces.com',
                    });
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between transition ${
                    isAdmin ? 'bg-orange-50 text-[#FF8407] font-semibold' : 'hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-1">
                      <span>👑 Esteban Gavotti</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Admin</span>
                    </div>
                    <div className="text-[10px] text-slate-600">Acceso total, reasignación, CSV</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    simulateRole('vendedor', {
                      nombre: 'Ruben Valverde (Vendedor)',
                      email: 'ruben.valverde@quicksurfaces.com',
                    });
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between transition ${
                    !isAdmin && userProfile?.nombre?.includes('Ruben')
                      ? 'bg-orange-50 text-[#FF8407] font-semibold'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-1">
                      <span>💼 Ruben Valverde</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Vendedor</span>
                    </div>
                    <div className="text-[10px] text-slate-600">Cartera de clientes y sin asignar</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    simulateRole('vendedor', {
                      nombre: 'Carlos Mendoza (Vendedor)',
                      email: 'carlos.mendoza@quicksurfaces.com',
                    });
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between transition ${
                    !isAdmin && userProfile?.nombre?.includes('Carlos')
                      ? 'bg-orange-50 text-[#FF8407] font-semibold'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-1">
                      <span>💼 Carlos Mendoza</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Vendedor</span>
                    </div>
                    <div className="text-[10px] text-slate-600">Cartera personal y seguimientos</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            {customLogoUrl ? (
              <img
                src={customLogoUrl}
                alt="Quicksurfaces Logo"
                className="h-9 max-w-[140px] object-contain cursor-pointer"
                onClick={() => setActiveTab('kanban')}
              />
            ) : (
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
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Surfaces
                </span>
              </div>
            )}

            {/* Logo Upload Placeholder as requested */}
            <label
              title="Subir logo real de Quicksurfaces"
              className="cursor-pointer text-[11px] text-slate-600 hover:text-[#FF8407] flex items-center gap-1 p-1 rounded hover:bg-slate-50 transition border border-dashed border-slate-300 hidden md:flex"
            >
              <Upload className="w-3 h-3 text-[#FF8407]" />
              <span>Logo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </label>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
            <button
              id="nav-tab-kanban"
              onClick={() => setActiveTab('kanban')}
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
              onClick={() => setActiveTab('list')}
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
              onClick={() => setActiveTab('dashboard')}
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
                  onClick={() => setActiveTab('csv')}
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
                  onClick={() => setActiveTab('users')}
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

              {/* Overdue Dropdown */}
              {showOverdueDropdown && (
                <div
                  id="overdue-list-dropdown"
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span>Seguimientos Urgentes</span>
                    </div>
                    <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                      {totalUrgentCount} pendientes
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 py-1">
                    {totalUrgentCount === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">
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
                            className="p-2 hover:bg-red-50/50 rounded-lg cursor-pointer transition group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-slate-900 group-hover:text-[#FF8407]">
                                {c.nombre}
                              </span>
                              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
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
                            className="p-2 hover:bg-amber-50/50 rounded-lg cursor-pointer transition group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-slate-900 group-hover:text-[#FF8407]">
                                {c.nombre}
                              </span>
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
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
                  </div>
                </div>
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

      {/* Mobile Bottom Navigation Bar (Mobile-first for sales reps on field) */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 bg-white py-2 px-1">
        <button
          onClick={() => setActiveTab('kanban')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-xs font-semibold ${
            activeTab === 'kanban' ? 'text-[#FF8407]' : 'text-slate-500'
          }`}
        >
          <KanbanSquare className="w-5 h-5" />
          <span>Pipeline</span>
        </button>

        <button
          onClick={() => setActiveTab('list')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-xs font-semibold ${
            activeTab === 'list' ? 'text-[#FF8407]' : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Contactos</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-xs font-semibold ${
            activeTab === 'dashboard' ? 'text-[#FF8407]' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-xs font-semibold ${
              activeTab === 'csv' ? 'text-[#FF8407]' : 'text-slate-500'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>CSV</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-xs font-semibold ${
              activeTab === 'users' ? 'text-[#FF8407]' : 'text-slate-500'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <span>Equipo</span>
          </button>
        )}
      </div>
    </header>
  );
};
