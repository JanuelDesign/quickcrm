import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Sparkles,
  AlertTriangle,
  User,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  Layers,
  Users,
  Tag,
  XCircle,
  ArrowRight,
  Phone,
  MessageCircle,
  MapPin,
  Building,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Contacto,
  FUNNEL_STAGES,
  CLIENT_SEGMENTS,
  PIPELINE_STAGES,
  PipelineStage,
} from '../types/crm';
import { ContactCard } from './ContactCard';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../context/AuthContext';
import {
  isFollowUpOverdue,
  isFollowUpToday,
  formatPhoneNumber,
  createWhatsAppUrl,
  formatDateSpanish,
} from '../utils/formatters';

interface KanbanBoardProps {
  onOpenContact: (contact: Contacto) => void;
  onNewContact: () => void;
}

const EXTRA_COLORS = [
  { color: '#8B5CF6', bgLight: 'bg-violet-50 border-violet-200 text-violet-700' },
  { color: '#EC4899', bgLight: 'bg-pink-50 border-pink-200 text-pink-700' },
  { color: '#0D9488', bgLight: 'bg-teal-50 border-teal-200 text-teal-700' },
  { color: '#6366F1', bgLight: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  onOpenContact,
  onNewContact,
}) => {
  const { contacts, updateContactStage, users } = useCrm();
  const { isAdmin, userProfile } = useAuth();

  // Tab State: 'embudo' | 'segmentos'
  const [activeTab, setActiveTab] = useState<'embudo' | 'segmentos'>('embudo');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRep, setSelectedRep] = useState<string>('todos');
  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('todos');

  // Drag & Drop State (Only active in Embudo)
  const [draggingContactId, setDraggingContactId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Helper to determine a contact's segment
  const getContactSegment = (c: Contacto): string | undefined => {
    if (c.segmento) return c.segmento;
    const match = CLIENT_SEGMENTS.find(
      (s) => c.etapa === s.label || (s.code && c.etapa?.startsWith(s.code))
    );
    return match?.label;
  };

  // Helper to check if a contact belongs to a given segment
  const contactMatchesSegment = (c: Contacto, seg: PipelineStage): boolean => {
    if (c.segmento) {
      return c.segmento === seg.label || c.segmento.startsWith(seg.code);
    }
    return c.etapa === seg.label || (seg.code && c.etapa?.startsWith(seg.code));
  };

  // Identificar dinámicamente etapas no estándar en el embudo (que no sean del embudo ni de segmentos)
  const extraFunnelStages = useMemo(() => {
    const isKnown = (etapa: string) =>
      PIPELINE_STAGES.some((s) => etapa === s.label || etapa.startsWith(s.code));

    const extraStageNames: string[] = Array.from(
      new Set(contacts.map((c) => c.etapa).filter((e): e is string => Boolean(e) && !isKnown(e)))
    );

    return extraStageNames.map((name, idx) => {
      const style = EXTRA_COLORS[idx % EXTRA_COLORS.length];
      return {
        id: `extra_${encodeURIComponent(name)}`,
        code: name.split(' ')[0] || 'EXTRA',
        nombre: name,
        label: name,
        description: 'Etapa no estándar importada de CSV',
        color: style.color,
        bgLight: style.bgLight,
        isExtra: true,
      };
    });
  }, [contacts]);

  // Lista de columnas activas para el Embudo: A1, C3, E5, F6 (+ extras no estándar)
  const funnelColumns = useMemo(() => {
    return [...FUNNEL_STAGES, ...extraFunnelStages];
  }, [extraFunnelStages]);

  // Filter contacts base
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (contact.nombre || '').toLowerCase().includes(q);
        const matchPhone = (contact.telefono || '').toLowerCase().includes(q);
        const matchEmail = (contact.correo || '').toLowerCase().includes(q);
        const matchCargo = (contact.rolCargo || '').toLowerCase().includes(q);
        const matchEtapa = (contact.etapa || '').toLowerCase().includes(q);
        const matchSeg = (contact.segmento || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail && !matchCargo && !matchEtapa && !matchSeg) {
          return false;
        }
      }

      // Rep filter
      if (isAdmin && selectedRep !== 'todos') {
        if (selectedRep === 'sin_asignar') {
          const resp = (contact.responsable || '').toLowerCase();
          if (resp && resp !== 'sin asignar' && resp !== 'unassigned') return false;
        } else {
          if (contact.responsable !== selectedRep) return false;
        }
      }

      // Tipo cliente filter
      if (selectedTipo !== 'todos') {
        if (contact.tipoCliente !== selectedTipo) return false;
      }

      // Overdue filter
      if (onlyOverdue) {
        if (!isFollowUpOverdue(contact.proximoSeguimiento)) return false;
      }

      return true;
    });
  }, [contacts, searchQuery, isAdmin, selectedRep, selectedTipo, onlyOverdue]);

  // Contactos Ganados o Perdidos para la 5ta columna visual de solo lectura
  const wonOrLostContacts = useMemo(() => {
    return filteredContacts.filter(
      (c) => c.estadoContacto === 'Ganado' || c.estadoContacto === 'Perdido'
    );
  }, [filteredContacts]);

  // Drag and drop handlers (para embudo secuencial A1 -> C3 -> E5 -> F6)
  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    setDraggingContactId(contactId);
    e.dataTransfer.setData('text/plain', contactId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (e: React.DragEvent, stageLabel: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    const contactId = draggingContactId || e.dataTransfer.getData('text/plain');
    if (contactId) {
      await updateContactStage(contactId, stageLabel);
    }
    setDraggingContactId(null);
  };

  // Recuento de contactos activos en embudo vs segmentos
  const activeFunnelCount = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.estadoContacto !== 'Ganado' &&
        c.estadoContacto !== 'Perdido' &&
        FUNNEL_STAGES.some((s) => c.etapa === s.label || c.etapa?.startsWith(s.code))
    ).length;
  }, [contacts]);

  const segmentedCount = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.segmento ||
        CLIENT_SEGMENTS.some((s) => c.etapa === s.label || c.etapa?.startsWith(s.code))
    ).length;
  }, [contacts]);

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] md:h-[calc(100vh-6.5rem)] overflow-hidden">
      {/* Top Header & Tab Switcher Bar */}
      <div className="bg-white border-b border-slate-200/90 px-4 py-2.5 shrink-0 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Main Tabs Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {/* Tab: Embudo */}
            <button
              id="tab-embudo-button"
              onClick={() => setActiveTab('embudo')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'embudo'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${activeTab === 'embudo' ? 'text-[#FF8407]' : 'text-slate-400'}`} />
              <span>Embudo de Venta</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'embudo'
                    ? 'bg-orange-100 text-[#EA580C]'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {activeFunnelCount}
              </span>
            </button>

            {/* Tab: Segmentos */}
            <button
              id="tab-segmentos-button"
              onClick={() => setActiveTab('segmentos')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'segmentos'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${activeTab === 'segmentos' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>Segmentos de Cliente</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'segmentos'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {segmentedCount}
              </span>
            </button>
          </div>

          {/* Quick Context Descriptor */}
          <div className="text-xs text-slate-500 hidden md:flex items-center gap-2">
            {activeTab === 'embudo' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <span>Proceso comercial secuencial: A1 → C3 → E5 → F6 (Arrastre manual)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Clasificación post-venta por comportamiento (Sin arrastre, reclasifica en ficha)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters and Control Bar */}
      <div className="bg-white px-4 py-2.5 border-b border-slate-200/80 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="kanban-search-input"
              type="text"
              placeholder={
                activeTab === 'embudo'
                  ? 'Buscar contacto en embudo...'
                  : 'Buscar cliente por nombre, teléfono, rol o segmento...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Admin filter by sales rep */}
            {isAdmin && (
              <select
                id="filter-responsable-select"
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
              >
                <option value="todos">👥 Todos los Vendedores</option>
                <option value="sin_asignar">⚠️ Sin asignar</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.nombre}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            )}

            {/* Filter by Client Type */}
            <select
              id="filter-tipo-cliente-select"
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
            >
              <option value="todos">⭐ Todos los tipos</option>
              <option value="VIP">VIP (Exclusivos)</option>
              <option value="Compró Antes">Compró Antes</option>
              <option value="Contactado sin Compra">Contactado sin Compra</option>
              <option value="Nunca Contactado">Nunca Contactado</option>
            </select>

            {/* Overdue filter toggle */}
            <button
              id="toggle-overdue-filter"
              onClick={() => setOnlyOverdue(!onlyOverdue)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                onlyOverdue
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Vencidos</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: EMBUDO DE VENTA (Kanban 4 columnas + 5ta Ganado/Perdido) */}
      {activeTab === 'embudo' && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-slate-100/60">
          <div className="flex gap-4 h-full min-w-max pb-2">
            {/* 4 Columnas Secuenciales del Embudo (A1, C3, E5, F6) */}
            {funnelColumns.map((stage) => {
              const isExtra = (stage as any).isExtra;
              const isF6 = stage.code === 'F6';

              // Contactos en esta etapa que NO hayan sido cerrados como Ganado o Perdido
              const stageContacts = filteredContacts.filter((c) => {
                const matchesStage = isExtra
                  ? c.etapa === stage.label
                  : c.etapa === stage.label || (stage.code && c.etapa.startsWith(stage.code));
                const notClosed = c.estadoContacto !== 'Ganado' && c.estadoContacto !== 'Perdido';
                return matchesStage && notClosed;
              });

              const overdueInStage = stageContacts.filter((c) =>
                isFollowUpOverdue(c.proximoSeguimiento)
              ).length;

              const isDropping = dragOverStageId === stage.id;

              return (
                <div
                  key={stage.id}
                  id={`column-${stage.id}`}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.label)}
                  className={`w-72 md:w-80 flex flex-col rounded-2xl bg-slate-50/90 border transition-all duration-150 ${
                    isDropping
                      ? 'border-[#FF8407] ring-2 ring-[#FF8407]/30 bg-orange-50/40'
                      : isF6
                      ? 'border-orange-300 ring-1 ring-orange-200/60 shadow-xs'
                      : isExtra
                      ? 'border-purple-300 shadow-xs ring-1 ring-purple-200/50'
                      : 'border-slate-200/80 shadow-xs'
                  }`}
                >
                  {/* Column Header */}
                  <div
                    className={`p-3 border-b bg-white rounded-t-2xl flex items-center justify-between shrink-0 ${
                      isF6
                        ? 'border-orange-200 bg-gradient-to-r from-orange-50/50 to-amber-50/30'
                        : isExtra
                        ? 'border-purple-100 bg-purple-50/20'
                        : 'border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      ></span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-xs md:text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                            <span
                              className={
                                isF6
                                  ? 'text-[#EA580C] font-black'
                                  : isExtra
                                  ? 'text-purple-600 font-black'
                                  : 'text-[#FF8407]'
                              }
                            >
                              {stage.code}
                            </span>
                            <span className="truncate max-w-[140px]">{stage.nombre}</span>
                          </h3>
                          {isF6 && (
                            <span
                              className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-[#EA580C] border border-orange-200"
                              title="Paso donde se dispara la cotización QuickQuote"
                            >
                              ⚡ QuickQuote
                            </span>
                          )}
                          {isExtra && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                              Etapa extra
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1">
                          {stage.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {overdueInStage > 0 && (
                        <span
                          className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full"
                          title={`${overdueInStage} seguimientos vencidos en esta etapa`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {overdueInStage}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold border ${
                          isF6
                            ? 'bg-orange-100 text-orange-800 border-orange-200'
                            : isExtra
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {stageContacts.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    {stageContacts.length === 0 ? (
                      <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center">
                        <p className="text-[11px]">Arrastra un contacto aquí</p>
                      </div>
                    ) : (
                      stageContacts.map((contact) => (
                        <ContactCard
                          key={contact.id}
                          contact={contact}
                          onOpen={onOpenContact}
                          onDragStart={handleDragStart}
                        />
                      ))
                    )}
                  </div>

                  {/* Column footer */}
                  <div className="p-2 border-t border-slate-200/60 bg-white/60 rounded-b-2xl text-center">
                    <button
                      onClick={onNewContact}
                      className="w-full py-1 text-[11px] font-medium text-slate-500 hover:text-[#FF8407] hover:bg-orange-50 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Agregar a esta etapa</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 5ta Columna Visual: Ganado / Perdido (Solo Lectura) */}
            <div
              id="column-closed"
              className="w-72 md:w-84 flex flex-col rounded-2xl bg-emerald-50/20 border-2 border-emerald-200/80 shadow-xs"
            >
              {/* Header Ganado / Perdido */}
              <div className="p-3 border-b border-emerald-200 bg-white rounded-t-2xl flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white"></span>
                    <span className="w-3 h-3 rounded-full bg-rose-500 border border-white"></span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-black text-xs md:text-sm text-slate-900 tracking-tight">
                        Ganado / Perdido
                      </h3>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        Solo Lectura
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Cierres comerciales registrados desde F6
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center justify-center min-w-5 h-5 px-2 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {wonOrLostContacts.length}
                </span>
              </div>

              {/* Banner Explicativo Solo Lectura */}
              <div className="bg-emerald-50/70 border-b border-emerald-100 px-3 py-1.5 text-[11px] text-emerald-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>Para marcar Ganado o Perdido, abre la ficha desde F6.</span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {wonOrLostContacts.length === 0 ? (
                  <div className="h-36 border-2 border-dashed border-emerald-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-1" />
                    <p className="font-semibold text-slate-600">Sin cierres registrados</p>
                    <p className="text-[11px] mt-0.5">
                      Al resolver cotizaciones en F6 como Ganado o Perdido, aparecerán aquí.
                    </p>
                  </div>
                ) : (
                  wonOrLostContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => onOpenContact(contact)}
                      className="group relative bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:shadow-md transition cursor-pointer hover:border-emerald-300"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        {contact.estadoContacto === 'Ganado' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> GANADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3" /> PERDIDO
                          </span>
                        )}

                        {contact.segmento && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 truncate max-w-[130px]">
                            🏷️ {contact.segmento.split(' — ')[0]}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                        {contact.nombre}
                      </h4>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{contact.rolCargo}</span>
                        {contact.telefono && (
                          <span className="font-semibold text-slate-700">
                            {formatPhoneNumber(contact.telefono)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Resp: {contact.responsable || 'Sin asignar'}</span>
                        <span className="text-emerald-700 font-semibold group-hover:underline">
                          Ver ficha →
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2 border-t border-emerald-200 bg-white/70 rounded-b-2xl text-center text-[11px] text-emerald-800 font-medium">
                Cierres agrupados por resolución
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SEGMENTOS DE CLIENTE (Clasificación por comportamiento, sin arrastrar) */}
      {activeTab === 'segmentos' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/80 space-y-5">
          {/* Header Concept Notice Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5" />
                <span>Clasificación de Cartera Post-Venta</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                Segmentación Comercial Quicksurfaces
              </h2>
              <p className="text-xs text-purple-200/90 max-w-2xl leading-relaxed">
                Los segmentos no son etapas de venta secuenciales. Representan el comportamiento,
                volumen y recurrencia de los clientes. Para asignar o reclasificar un segmento, haz
                clic sobre cualquier cliente para abrir su ficha.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold border border-white/15">
                Total Clasificados: {segmentedCount}
              </span>
            </div>
          </div>

          {/* Segment Filter Buttons Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSegmentFilter('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                selectedSegmentFilter === 'todos'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todos los Segmentos ({filteredContacts.length})
            </button>

            {CLIENT_SEGMENTS.map((seg) => {
              const countInSeg = filteredContacts.filter((c) =>
                contactMatchesSegment(c, seg)
              ).length;
              const isSelected = selectedSegmentFilter === seg.code;

              return (
                <button
                  key={seg.id}
                  onClick={() => setSelectedSegmentFilter(isSelected ? 'todos' : seg.code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  ></span>
                  <span>{seg.label}</span>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {countInSeg}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Segment Columns / Grouped Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {CLIENT_SEGMENTS.filter(
              (seg) => selectedSegmentFilter === 'todos' || selectedSegmentFilter === seg.code
            ).map((seg) => {
              const segContacts = filteredContacts.filter((c) => contactMatchesSegment(c, seg));

              return (
                <div
                  key={seg.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden"
                >
                  {/* Segment Card Header */}
                  <div
                    className="p-4 border-b border-slate-200 flex items-start justify-between gap-2"
                    style={{ borderTop: `4px solid ${seg.color}` }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        ></span>
                        <h3 className="font-extrabold text-slate-900 text-sm">{seg.label}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{seg.description}</p>
                    </div>

                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                      {segContacts.length} clientes
                    </span>
                  </div>

                  {/* List of Contacts in Segment */}
                  <div className="p-3 space-y-2.5 max-h-[500px] overflow-y-auto flex-1">
                    {segContacts.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 text-xs">
                        No hay contactos asignados a este segmento con los filtros actuales.
                      </div>
                    ) : (
                      segContacts.map((c) => {
                        const isOverdue = isFollowUpOverdue(c.proximoSeguimiento);

                        return (
                          <div
                            key={c.id}
                            onClick={() => onOpenContact(c)}
                            className="group p-3 rounded-xl border border-slate-200/90 hover:border-purple-300 hover:shadow-xs bg-slate-50/50 hover:bg-white transition cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition">
                                  {c.nombre}
                                </h4>
                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="font-medium text-slate-700">{c.rolCargo}</span>
                                  <span>•</span>
                                  <span>{c.vecesQueCompro || '1 Compra'}</span>
                                </div>
                              </div>

                              {c.estadoContacto === 'Ganado' && (
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  Ganado
                                </span>
                              )}
                            </div>

                            {/* Contact Info & Actions */}
                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                {c.telefono && (
                                  <>
                                    <span className="text-[11px] font-semibold text-slate-700">
                                      {formatPhoneNumber(c.telefono)}
                                    </span>
                                    <a
                                      href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Llamar"
                                      className="p-1 rounded bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200"
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                    <a
                                      href={createWhatsAppUrl(c.telefono, c.nombre)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      title="WhatsApp"
                                      className="p-1 rounded bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200"
                                    >
                                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                                    </a>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-purple-700 font-bold group-hover:underline">
                                  Reclasificar en ficha →
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
