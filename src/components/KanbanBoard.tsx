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
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Contacto,
  FUNNEL_STAGES,
  CLIENT_SEGMENTS,
  EXIT_STAGES,
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
  normalizeSearchText,
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

  // Tab State: 'embudo' | 'segmentos' | 'lista_negra'
  const [activeTab, setActiveTab] = useState<'embudo' | 'segmentos' | 'lista_negra'>('embudo');

  // Mobile Active Stage tab ('funnel_a1' | 'funnel_c3' | 'funnel_e5' | 'funnel_f6' | 'column_closed' | extra stage id)
  const [mobileStageId, setMobileStageId] = useState<string>('funnel_a1');
  // Active Segment Code for Segmentos Tab ('H8' | 'I9' | 'J10' | 'K11' | 'N14')
  const [activeSegmentCode, setActiveSegmentCode] = useState<string>('H8');

  // Mobile Filters Drawer State
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRep, setSelectedRep] = useState<string>('todos');
  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyToday, setOnlyToday] = useState(false);

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

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedRep !== 'todos') count++;
    if (selectedTipo !== 'todos') count++;
    if (onlyOverdue) count++;
    if (onlyToday) count++;
    return count;
  }, [selectedRep, selectedTipo, onlyOverdue, onlyToday]);

  // Filter Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Search (accent and case insensitive)
      if (searchQuery.trim()) {
        const q = normalizeSearchText(searchQuery);
        const matchesName = normalizeSearchText(contact.nombre).includes(q);
        const matchesPhone = normalizeSearchText(contact.telefono).includes(q);
        const matchesCargo = normalizeSearchText(contact.rolCargo).includes(q);
        const matchesSeg = normalizeSearchText(contact.segmento).includes(q);
        const matchesEmail = normalizeSearchText(contact.correo).includes(q);
        const matchesDir = normalizeSearchText(contact.direccion).includes(q);
        const matchesNotes = Array.isArray(contact.notas)
          ? contact.notas.some((n) => normalizeSearchText(n.texto).includes(q))
          : typeof contact.notas === 'string' && normalizeSearchText(contact.notas).includes(q);

        if (!matchesName && !matchesPhone && !matchesCargo && !matchesSeg && !matchesEmail && !matchesDir && !matchesNotes) {
          return false;
        }
      }

      // Filter by sales rep (admin only)
      if (selectedRep !== 'todos') {
        if (selectedRep === 'sin_asignar') {
          if (contact.responsable && contact.responsable !== 'sin asignar') return false;
        } else {
          if (contact.responsable !== selectedRep) return false;
        }
      }

      // Filter by Client Type
      if (selectedTipo !== 'todos' && contact.tipoCliente !== selectedTipo) {
        return false;
      }

      // Filter by Overdue or Today Follow-up
      if (onlyOverdue && onlyToday) {
        if (!isFollowUpOverdue(contact.proximoSeguimiento) && !isFollowUpToday(contact.proximoSeguimiento)) {
          return false;
        }
      } else if (onlyOverdue) {
        if (!isFollowUpOverdue(contact.proximoSeguimiento) || isFollowUpToday(contact.proximoSeguimiento)) {
          return false;
        }
      } else if (onlyToday) {
        if (!isFollowUpToday(contact.proximoSeguimiento)) {
          return false;
        }
      }

      return true;
    });
  }, [
    contacts,
    searchQuery,
    selectedRep,
    selectedTipo,
    onlyOverdue,
    onlyToday,
  ]);

  // Drag & Drop handlers (Only for Embudo)
  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    if (activeTab !== 'embudo') return;
    setDraggingContactId(contactId);
    e.dataTransfer.setData('text/plain', contactId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    if (activeTab !== 'embudo') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStageLabel: string) => {
    if (activeTab !== 'embudo') return;
    e.preventDefault();
    setDragOverStageId(null);
    const contactId = e.dataTransfer.getData('text/plain') || draggingContactId;
    setDraggingContactId(null);

    if (!contactId) return;

    try {
      await updateContactStage(contactId, targetStageLabel);
    } catch (err) {
      console.error('Error updating stage via drag & drop:', err);
    }
  };

  // Contactos cerrados como Ganado o Perdido (exclusivo para la columna informativa de cierre)
  const wonOrLostContacts = useMemo(() => {
    return filteredContacts.filter(
      (c) => c.estadoContacto === 'Ganado' || c.estadoContacto === 'Perdido'
    );
  }, [filteredContacts]);

  // Totals for top badge counters
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

  const blacklistCount = useMemo(() => {
    return contacts.filter((c) => c.etapa?.startsWith('M13')).length;
  }, [contacts]);

  const blacklistContacts = useMemo(() => {
    return filteredContacts.filter((c) => c.etapa?.startsWith('M13'));
  }, [filteredContacts]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRep('todos');
    setSelectedTipo('todos');
    setOnlyOverdue(false);
    setOnlyToday(false);
  };

  // Helper to render an Embudo Stage Column (reused in desktop multi-col and mobile single-col)
  const renderFunnelColumn = (stage: any, isMobileFullWidth = false) => {
    const isExtra = stage.isExtra;
    const isF6 = stage.code === 'F6';
    const isD4 = stage.code === 'D4' || stage.isLateral;

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
        className={`${
          isMobileFullWidth
            ? 'w-full flex-1 flex flex-col h-full min-h-0'
            : 'w-72 md:w-80 flex flex-col shrink-0 h-full min-h-0'
        } rounded-2xl bg-slate-50/90 border transition-all duration-150 ${
          isDropping
            ? 'border-[#FF8407] ring-2 ring-[#FF8407]/30 bg-orange-50/40'
            : isF6
            ? 'border-orange-300 ring-1 ring-orange-200/60 shadow-xs'
            : isD4
            ? 'border-2 border-dashed border-purple-400 bg-purple-50/30 shadow-xs ring-1 ring-purple-200/50'
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
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <div className="min-w-0">
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
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{stage.nombre}</span>
                </h3>
                {isF6 && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-[#EA580C] border border-orange-200 hidden sm:inline">
                    Resolución
                  </span>
                )}
                {isD4 && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-300 border-dashed hidden sm:inline">
                    Salida Lateral
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                {stage.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {overdueInStage > 0 && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md"
                title={`${overdueInStage} seguimientos vencidos en esta etapa`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{overdueInStage}</span>
              </span>
            )}
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-black ${
                isF6
                  ? 'bg-orange-500 text-white'
                  : isD4
                  ? 'bg-purple-600 text-white'
                  : isExtra
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {stageContacts.length}
            </span>
          </div>
        </div>

        {/* Banner especial para F6 */}
        {isF6 && (
          <div className="bg-orange-50/90 border-b border-orange-200 px-3 py-1.5 text-[11px] text-orange-900 flex items-center justify-between shrink-0">
            <span className="font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Cotización activa QuickQuote</span>
            </span>
            <span className="text-[10px] text-orange-700 font-bold hidden sm:inline">
              Ficha para cerrar
            </span>
          </div>
        )}

        {/* Banner especial para D4 */}
        {isD4 && (
          <div className="bg-purple-50/90 border-b border-purple-200/80 px-3 py-1.5 text-[11px] text-purple-900 flex items-center justify-between shrink-0">
            <span className="font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Campaña re-marketing</span>
            </span>
            <span className="text-[10px] text-purple-700 font-bold hidden sm:inline">
              No es perdido
            </span>
          </div>
        )}

        {/* Cards Container */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-2.5 [webkit-overflow-scrolling:touch]">
          {stageContacts.length === 0 ? (
            isD4 ? (
              <div className="h-32 border-2 border-dashed border-purple-300 rounded-xl flex flex-col items-center justify-center text-purple-600 text-xs p-3 text-center bg-purple-50/30">
                <p className="font-semibold text-purple-800">Sin contactos en Re-marketing</p>
                <p className="text-[10px] mt-0.5 text-purple-600 hidden sm:block">
                  Arrastra aquí contactos que no contesten para retomarlos después sin marcarlos como perdidos.
                </p>
              </div>
            ) : (
              <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center">
                <p className="font-semibold text-slate-500">Sin contactos en esta etapa</p>
                <p className="text-[10px] mt-0.5 text-slate-400 hidden sm:block">
                  Arrastra una tarjeta o presiona + para agregar.
                </p>
              </div>
            )
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
        <div className="p-2 border-t border-slate-200/60 bg-white/60 rounded-b-2xl text-center shrink-0">
          <button
            onClick={onNewContact}
            className="w-full py-2 min-h-[44px] text-xs font-bold text-slate-600 hover:text-[#FF8407] hover:bg-orange-50 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FF8407]" />
            <span>Agregar nuevo contacto</span>
          </button>
        </div>
      </div>
    );
  };

  // Helper to render the Closed Deals (Ganado/Perdido) column
  const renderClosedColumn = (isMobileFullWidth = false) => {
    return (
      <div
        id="column-closed"
        className={`${
          isMobileFullWidth
            ? 'w-full flex-1 flex flex-col h-full min-h-0'
            : 'w-72 md:w-84 flex flex-col shrink-0 h-full min-h-0'
        } rounded-2xl bg-emerald-50/20 border-2 border-emerald-200/80 shadow-xs`}
      >
        {/* Header Ganado / Perdido */}
        <div className="p-3 border-b border-emerald-200 bg-white rounded-t-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
              <span className="w-3 h-3 rounded-full bg-rose-500 border border-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-xs md:text-sm text-slate-900 tracking-tight">
                  Ganado / Perdido
                </h3>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Cierres
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block">
                Cierres comerciales registrados desde F6
              </p>
            </div>
          </div>

          <span className="inline-flex items-center justify-center min-w-5 h-5 px-2 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            {wonOrLostContacts.length}
          </span>
        </div>

        {/* Banner Explicativo */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-3 py-1.5 text-[11px] text-emerald-800 flex items-center gap-1.5 shrink-0">
          <Info className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Para marcar Ganado o Perdido, abre la ficha desde F6.</span>
        </div>

        {/* Cards Container */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-2.5 [webkit-overflow-scrolling:touch]">
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
        <div className="p-2 border-t border-emerald-200 bg-white/70 rounded-b-2xl text-center text-[11px] text-emerald-800 font-medium shrink-0">
          Cierres agrupados por resolución
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] md:h-[calc(100vh-6.5rem)] overflow-hidden">
      {/* Top Header & Tab Switcher Bar */}
      <div className="bg-white border-b border-slate-200/90 px-3 sm:px-4 py-2 shrink-0 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-hidden">
          {/* Main Tabs Navigation */}
          {/* Mobile view (< sm): bottom-nav icon style (icon top, short text bottom, notification badge top-right), fits on 1 screen */}
          {/* Desktop view (>= sm): horizontal pills with icon and badge */}
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">
            {/* Tab: Embudo */}
            <button
              id="tab-embudo-button"
              onClick={() => setActiveTab('embudo')}
              className={`relative flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 min-h-[46px] sm:min-h-[40px] rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'embudo'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Layers className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${activeTab === 'embudo' ? 'text-[#FF8407]' : 'text-slate-400'}`} />
                {/* Mobile Notification Badge (top-right of icon) */}
                <span className="sm:hidden absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center bg-[#FF8407] text-white shadow-xs">
                  {activeFunnelCount}
                </span>
              </div>
              <span className="leading-tight">Embudo</span>
              {/* Desktop inline pill badge */}
              <span
                className={`hidden sm:inline-block text-[10px] font-black px-1.5 py-0.2 rounded-full ${
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
              className={`relative flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 min-h-[46px] sm:min-h-[40px] rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'segmentos'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Users className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${activeTab === 'segmentos' ? 'text-purple-600' : 'text-slate-400'}`} />
                {/* Mobile Notification Badge (top-right of icon) */}
                <span className="sm:hidden absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center bg-purple-600 text-white shadow-xs">
                  {segmentedCount}
                </span>
              </div>
              <span className="leading-tight">Segmentos</span>
              {/* Desktop inline pill badge */}
              <span
                className={`hidden sm:inline-block text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'segmentos'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {segmentedCount}
              </span>
            </button>

            {/* Tab: M13 Lista Negra (Salida Permanente) */}
            <button
              id="tab-lista-negra-button"
              onClick={() => setActiveTab('lista_negra')}
              className={`relative flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 min-h-[46px] sm:min-h-[40px] rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'lista_negra'
                  ? 'bg-stone-900 text-red-300 shadow-xs border border-red-800'
                  : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <ShieldAlert className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${activeTab === 'lista_negra' ? 'text-red-400' : 'text-slate-400'}`} />
                {/* Mobile Notification Badge (top-right of icon) */}
                <span className="sm:hidden absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center bg-red-600 text-white shadow-xs">
                  {blacklistCount}
                </span>
              </div>
              <span className="leading-tight">
                <span className="sm:hidden">M13 Negra</span>
                <span className="hidden sm:inline">M13 Lista Negra</span>
              </span>
              {/* Desktop inline pill badge */}
              <span
                className={`hidden sm:inline-block text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'lista_negra'
                    ? 'bg-red-900/60 text-red-200 border border-red-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {blacklistCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white px-3 sm:px-4 py-2 border-b border-slate-200/80 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[170px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="kanban-search-input"
              type="text"
              placeholder={
                activeTab === 'embudo'
                  ? 'Buscar nombre, tel, cargo...'
                  : activeTab === 'segmentos'
                  ? 'Buscar cliente o segmento...'
                  : 'Buscar en lista negra M13...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full pl-9 pr-8 py-2 min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
                title="Borrar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Results Count Badge */}
          {searchQuery.trim() && (
            <div className="text-[11px] font-bold text-[#FF8407] bg-orange-50 border border-orange-200 px-2.5 py-1.5 rounded-xl shrink-0 flex items-center gap-1 animate-in fade-in">
              <span>{filteredContacts.length} {filteredContacts.length === 1 ? 'resultado' : 'resultados'}</span>
            </div>
          )}

          {/* Mobile Single "Filtros" Button opening Bottom Sheet */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className={`md:hidden flex items-center gap-1.5 px-3 py-2 min-h-[42px] rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 ${
                activeFiltersCount > 0
                  ? 'bg-orange-50 text-[#FF8407] border-orange-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#FF8407] text-white text-[10px] flex items-center justify-center font-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Desktop Filter Controls (Hidden on mobile) */}
            <div className="hidden md:flex items-center gap-2 text-xs">
              {isAdmin && (
                <select
                  id="filter-responsable-select"
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="px-2.5 py-2 min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
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

              <select
                id="filter-tipo-cliente-select"
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-2.5 py-2 min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
              >
                <option value="todos">⭐ Todos los tipos</option>
                <option value="VIP">VIP (Exclusivos)</option>
                <option value="Compró Antes">Compró Antes</option>
                <option value="Contactado sin Compra">Contactado sin Compra</option>
                <option value="Nunca Contactado">Nunca Contactado</option>
              </select>

              <button
                id="toggle-overdue-filter"
                onClick={() => setOnlyOverdue(!onlyOverdue)}
                className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl font-bold transition cursor-pointer ${
                  onlyOverdue
                    ? 'bg-red-500 text-white shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Filtrar por contactos con seguimiento vencido de días anteriores"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Vencidos</span>
              </button>

              <button
                id="toggle-today-filter"
                onClick={() => setOnlyToday(!onlyToday)}
                className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl font-bold transition cursor-pointer ${
                  onlyToday
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Filtrar por contactos con seguimiento programado para hoy"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Hoy</span>
              </button>

              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-500 hover:text-slate-800 underline px-1 py-1"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW 1: EMBUDO DE VENTA */}
      {activeTab === 'embudo' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-100/60">
          {/* Mobile Top Tabs for Stages (A1, C3, E5, F6, Cierres) - smooth touch scroll without visual noise */}
          <div className="md:hidden bg-white border-b border-slate-200/90 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar [webkit-overflow-scrolling:touch]">
            {funnelColumns.map((stg) => {
              const isSelected = mobileStageId === stg.id;
              const count = filteredContacts.filter((c) => {
                const matchesStage = (stg as any).isExtra
                  ? c.etapa === stg.label
                  : c.etapa === stg.label || (stg.code && c.etapa.startsWith(stg.code));
                return matchesStage && c.estadoContacto !== 'Ganado' && c.estadoContacto !== 'Perdido';
              }).length;

              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => setMobileStageId(stg.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: stg.color }}
                  />
                  <span>{stg.code}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-800'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Tab Cierres for Mobile */}
            <button
              type="button"
              onClick={() => setMobileStageId('column_closed')}
              className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                mobileStageId === 'column_closed'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Cierres</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  mobileStageId === 'column_closed'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {wonOrLostContacts.length}
              </span>
            </button>
          </div>

          {/* Mobile Single Column Display (< md) */}
          <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden p-3">
            {mobileStageId === 'column_closed'
              ? renderClosedColumn(true)
              : renderFunnelColumn(
                  funnelColumns.find((s) => s.id === mobileStageId) || funnelColumns[0],
                  true
                )}
          </div>

          {/* Desktop Multi-column Kanban Display (>= md) */}
          <div className="hidden md:flex flex-1 overflow-x-auto min-h-0 p-4">
            <div className="flex gap-4 h-full min-w-max pb-2">
              {funnelColumns.map((stage) => renderFunnelColumn(stage, false))}
              {renderClosedColumn(false)}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SEGMENTOS DE CLIENTE (Tabs horizontales, un segmento a la vez a todo el ancho) */}
      {activeTab === 'segmentos' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-100/60">
          {/* Horizontal Tabs for Segments: H8 | I9 | J10 | K11 | N14 */}
          <div className="bg-white border-b border-slate-200/90 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar [webkit-overflow-scrolling:touch]">
            {CLIENT_SEGMENTS.map((seg) => {
              const isSelected = activeSegmentCode === seg.code;
              const count = filteredContacts.filter((c) => contactMatchesSegment(c, seg)).length;

              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setActiveSegmentCode(seg.code)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-900 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span>{seg.code}</span>
                  <span className="hidden sm:inline font-medium opacity-90">• {seg.nombre}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-purple-900'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Segment Full-width View */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 sm:p-4">
            {(() => {
              const currentSegment =
                CLIENT_SEGMENTS.find((s) => s.code === activeSegmentCode) || CLIENT_SEGMENTS[0];
              const segContacts = filteredContacts.filter((c) =>
                contactMatchesSegment(c, currentSegment)
              );

              return (
                <div className="w-full flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  {/* Segment Header */}
                  <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                        {currentSegment.code}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                            {currentSegment.nombre}
                          </h3>
                          <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
                            — {currentSegment.description}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 md:hidden">
                          {currentSegment.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
                        {segContacts.length} {segContacts.length === 1 ? 'cliente' : 'clientes'}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable contact cards container */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 space-y-2.5 [webkit-overflow-scrolling:touch]">
                    {segContacts.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                        <Users className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600 text-sm">
                          Sin clientes en {currentSegment.code} — {currentSegment.nombre}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                          Al clasificar contactos en este segmento comercial, aparecerán organizados aquí.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {segContacts.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => onOpenContact(c)}
                            className="p-3.5 rounded-xl border border-slate-200/90 hover:border-purple-300 hover:bg-purple-50/20 transition cursor-pointer group shadow-2xs bg-white flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition truncate">
                                    {c.nombre}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      {c.rolCargo}
                                    </span>
                                    {c.tipoCliente && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                        {c.tipoCliente}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div
                                  className="flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {c.telefono && (
                                    <>
                                      <a
                                        href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                                        className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center border border-emerald-200/60"
                                        title="Llamar"
                                      >
                                        <Phone className="w-3.5 h-3.5" />
                                      </a>
                                      <a
                                        href={createWhatsAppUrl(c.telefono, c.nombre)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center border border-emerald-200/60"
                                        title="WhatsApp"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                                {c.telefono && (
                                  <div className="font-semibold text-slate-700">
                                    📞 {formatPhoneNumber(c.telefono)}
                                  </div>
                                )}
                                {c.direccion && (
                                  <div className="truncate text-slate-400">
                                    📍 {c.direccion}
                                  </div>
                                )}
                                {c.empresa && (
                                  <div className="truncate text-slate-500">
                                    🏢 {c.empresa}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                              <span>Resp: <strong className="text-slate-600">{c.responsable || 'Sin asignar'}</strong></span>
                              <span className="text-purple-700 font-bold group-hover:underline">
                                Ver ficha →
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 3: M13 LISTA NEGRA (SALIDA PERMANENTE) */}
      {activeTab === 'lista_negra' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="bg-stone-900/90 border border-red-900/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-base">
                      M13 — Lista Negra
                    </h3>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800">
                      Salida Definitiva
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5 max-w-xl">
                    Contactos bloqueados por fraude, impagos, conflicto grave o baja comercial irrevocable.
                    No forman parte de las secuencias activas del embudo de ventas.
                  </p>
                </div>
              </div>
              <div className="text-right sm:border-l sm:border-stone-800 sm:pl-4 shrink-0">
                <div className="text-2xl font-black text-red-400">{blacklistContacts.length}</div>
                <div className="text-[11px] text-stone-400">Contactos en lista</div>
              </div>
            </div>

            {blacklistContacts.length === 0 ? (
              <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-12 text-center text-stone-400">
                <ShieldAlert className="w-10 h-10 text-stone-600 mx-auto mb-2 opacity-50" />
                <p className="font-bold text-stone-300 text-sm">No hay contactos en la Lista Negra</p>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Los contactos marcados con la etapa &quot;M13 — Lista Negra&quot; aparecerán protegidos en este módulo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {blacklistContacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => onOpenContact(contact)}
                    className="group bg-stone-900/80 hover:bg-stone-900 border border-red-950 hover:border-red-800/80 rounded-2xl p-4 transition cursor-pointer shadow-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-950/90 text-red-300 border border-red-800">
                            ⛔ M13
                          </span>
                          <span className="text-[10px] font-bold text-stone-400 bg-stone-800 px-2 py-0.5 rounded">
                            {contact.tipoCliente || 'Contacto'}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-white group-hover:text-red-300 transition">
                          {contact.nombre}
                        </h4>
                        {contact.empresa && (
                          <div className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3 text-stone-500" />
                            <span>{contact.empresa}</span>
                          </div>
                        )}
                      </div>

                      <span className="text-[11px] text-red-400 font-bold group-hover:underline shrink-0">
                        Ver ficha →
                      </span>
                    </div>

                    <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400">
                      <span>Resp: {contact.responsable || 'Sin asignar'}</span>
                      {contact.telefono && (
                        <span className="text-stone-300 font-medium">
                          {formatPhoneNumber(contact.telefono)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE FILTERS BOTTOM SHEET */}
      {showMobileFilters && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            className="relative w-full bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Bar */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-2" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#FF8407]" />
                <h3 className="font-extrabold text-slate-900 text-sm">Filtros de Contactos</h3>
              </div>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter 1: Responsable (Admin) */}
            {isAdmin && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Vendedor Asignado</label>
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="todos">👥 Todos los Vendedores</option>
                  <option value="sin_asignar">⚠️ Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.nombre}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filter 2: Tipo de Cliente */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tipo de Cliente</label>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                <option value="todos">⭐ Todos los tipos</option>
                <option value="VIP">VIP (Exclusivos)</option>
                <option value="Compró Antes">Compró Antes</option>
                <option value="Contactado sin Compra">Contactado sin Compra</option>
                <option value="Nunca Contactado">Nunca Contactado</option>
              </select>
            </div>

            {/* Filter 3: Solo Vencidos Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-slate-800">Solo Seguimientos Vencidos</span>
              </div>
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="w-5 h-5 accent-red-600 rounded cursor-pointer"
              />
            </div>

            {/* Filter 4: Solo Hoy Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800">Solo Seguimientos de Hoy</span>
              </div>
              <input
                type="checkbox"
                checked={onlyToday}
                onChange={(e) => setOnlyToday(e.target.checked)}
                className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
              />
            </div>

            {/* Sheet Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setShowMobileFilters(false);
                }}
                className="flex-1 py-3 min-h-[44px] rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition text-center cursor-pointer"
              >
                Limpiar Filtros
              </button>

              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 py-3 min-h-[44px] rounded-xl text-xs font-bold text-white bg-[#FF8407] hover:bg-[#E57300] transition text-center shadow-xs cursor-pointer"
              >
                Ver Resultados ({filteredContacts.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
