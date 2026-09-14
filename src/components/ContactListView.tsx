import React, { useState } from 'react';
import {
  Search,
  Filter,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  ArrowUpDown,
  CheckSquare,
  Square,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Download,
  Plus,
} from 'lucide-react';
import { Contacto, PIPELINE_STAGES, FUNNEL_STAGES, CLIENT_SEGMENTS, TIPOS_CLIENTE, ROLES_CARGO } from '../types/crm';
import {
  formatPhoneNumber,
  createWhatsAppUrl,
  isFollowUpOverdue,
  isFollowUpToday,
  formatDateSpanish,
} from '../utils/formatters';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../context/AuthContext';

interface ContactListViewProps {
  onOpenContact: (contact: Contacto) => void;
  onNewContact: () => void;
}

type SortField = 'nombre' | 'proximoSeguimiento' | 'fechaUltimoContacto' | 'etapa' | 'tipoCliente';

export const ContactListView: React.FC<ContactListViewProps> = ({
  onOpenContact,
  onNewContact,
}) => {
  const { contacts, users, reassignContacts } = useCrm();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterCargo, setFilterCargo] = useState('todos');
  const [filterRep, setFilterRep] = useState('todos');
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortAsc, setSortAsc] = useState(true);

  // Bulk Selection (Admin)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkReassignTarget, setBulkReassignTarget] = useState('');

  // Filtered List
  const filtered = contacts.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (c.nombre || '').toLowerCase().includes(q);
      const matchPhone = (c.telefono || '').toLowerCase().includes(q);
      const matchEmail = (c.correo || '').toLowerCase().includes(q);
      const matchAddress = (c.direccion || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchEmail && !matchAddress) return false;
    }

    if (filterStage !== 'todos') {
      const stageCode = filterStage.split(' ')[0];
      const matchEtapa = c.etapa === filterStage || (c.etapa && c.etapa.startsWith(stageCode));
      const matchSegmento = c.segmento === filterStage || (c.segmento && c.segmento.startsWith(stageCode));
      if (!matchEtapa && !matchSegmento) return false;
    }

    if (filterTipo !== 'todos' && c.tipoCliente !== filterTipo) return false;
    if (filterCargo !== 'todos' && c.rolCargo !== filterCargo) return false;

    if (isAdmin && filterRep !== 'todos') {
      if (filterRep === 'sin_asignar') {
        const resp = (c.responsable || '').toLowerCase();
        if (resp && resp !== 'sin asignar' && resp !== 'unassigned') return false;
      } else {
        if (c.responsable !== filterRep) return false;
      }
    }

    if (filterOverdue) {
      if (!isFollowUpOverdue(c.proximoSeguimiento)) return false;
    }

    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === sorted.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sorted.map((c) => c.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkReassign = async () => {
    if (!bulkReassignTarget || selectedIds.length === 0) return;
    await reassignContacts(selectedIds, bulkReassignTarget);
    setSelectedIds([]);
    alert(`Se han reasignado ${selectedIds.length} contactos a ${bulkReassignTarget}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Top Header & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="list-search-input"
              type="text"
              placeholder="Buscar por nombre, teléfono, email, dirección en Miami..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
            />
          </div>

          {/* New Contact CTA */}
          <button
            onClick={onNewContact}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#FF8407] hover:bg-[#E57300] text-white font-bold text-sm rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Contacto</span>
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Filter Etapa */}
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
          >
            <option value="todos">Todas las etapas / segmentos</option>
            <optgroup label="Embudo de Venta (Secuencial)">
              {FUNNEL_STAGES.map((s) => (
                <option key={s.id} value={s.label}>
                  {s.code} — {s.nombre}
                </option>
              ))}
            </optgroup>
            <optgroup label="Segmentos de Cliente (Comportamiento)">
              {CLIENT_SEGMENTS.map((s) => (
                <option key={s.id} value={s.label}>
                  {s.code} — {s.nombre}
                </option>
              ))}
            </optgroup>
            {contacts.some(
              (c) =>
                c.etapa &&
                !PIPELINE_STAGES.some((s) => s.label === c.etapa || c.etapa.startsWith(s.code))
            ) && (
              <optgroup label="Etapas adicionales (CSV)">
                {Array.from(
                  new Set(
                    contacts
                      .map((c) => c.etapa)
                      .filter(
                        (e) =>
                          e && !PIPELINE_STAGES.some((s) => s.label === e || e.startsWith(s.code))
                      )
                  )
                ).map((extraStage) => (
                  <option key={extraStage} value={extraStage}>
                    🏷️ {extraStage}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Filter Tipo Cliente */}
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
          >
            <option value="todos">Todos los tipos</option>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Filter Rol Cargo */}
          <select
            value={filterCargo}
            onChange={(e) => setFilterCargo(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
          >
            <option value="todos">Todos los cargos</option>
            {ROLES_CARGO.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Filter Responsable (Admin) */}
          {isAdmin && (
            <select
              value={filterRep}
              onChange={(e) => setFilterRep(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-[#FF8407]"
            >
              <option value="todos">Todos los vendedores</option>
              <option value="sin_asignar">⚠️ Sin asignar</option>
              {users.map((u) => (
                <option key={u.uid} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          )}

          {/* Overdue filter */}
          <button
            onClick={() => setFilterOverdue(!filterOverdue)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              filterOverdue
                ? 'bg-red-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Vencidos</span>
          </button>
        </div>
      </div>

      {/* Admin Bulk Actions Bar */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="bg-orange-50 border border-[#FF8407]/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-[#FF8407] bg-white px-2 py-0.5 rounded-md border border-orange-200">
              {selectedIds.length} seleccionados
            </span>
            <span className="text-xs text-slate-700 font-medium">Acción en bloque:</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkReassignTarget}
              onChange={(e) => setBulkReassignTarget(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="">Seleccionar nuevo responsable...</option>
              <option value="sin asignar">⚠️ Dejar sin asignar</option>
              {users.map((u) => (
                <option key={u.uid} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>

            <button
              onClick={handleBulkReassign}
              disabled={!bulkReassignTarget}
              className="px-3.5 py-1.5 bg-[#FF8407] hover:bg-[#E57300] disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-2xs transition"
            >
              Reasignar
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-500 hover:text-slate-700 underline px-1"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Contact List Table (Desktop) / Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table View (Hidden on Small Mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {isAdmin && (
                  <th className="p-3.5 w-10 text-center">
                    <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-600">
                      {selectedIds.length === sorted.length && sorted.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#FF8407]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th
                  onClick={() => toggleSort('nombre')}
                  className="p-3.5 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Contacto / Cliente</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">Teléfono / WhatsApp</th>
                <th
                  onClick={() => toggleSort('etapa')}
                  className="p-3.5 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Etapa Pipeline</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('tipoCliente')}
                  className="p-3.5 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Tipo Cliente</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">Rol / Cargo</th>
                <th
                  onClick={() => toggleSort('proximoSeguimiento')}
                  className="p-3.5 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Próximo Seguimiento</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">Responsable</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="p-8 text-center text-slate-400">
                    No se encontraron contactos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                sorted.map((c) => {
                  const isOverdue = isFollowUpOverdue(c.proximoSeguimiento);
                  const isToday = isFollowUpToday(c.proximoSeguimiento);
                  const isSelected = selectedIds.includes(c.id);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onOpenContact(c)}
                      className={`hover:bg-orange-50/30 cursor-pointer transition ${
                        isSelected ? 'bg-orange-50/50' : ''
                      }`}
                    >
                      {isAdmin && (
                        <td
                          className="p-3.5 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(c.id);
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#FF8407]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </td>
                      )}

                      {/* Nombre */}
                      <td className="p-3.5 font-bold text-slate-900 group">
                        <div className="flex items-center gap-1.5">
                          <span className="hover:text-[#FF8407] transition">{c.nombre}</span>
                          {c.tipoCliente === 'VIP' && (
                            <Sparkles className="w-3.5 h-3.5 text-[#FF8407]" />
                          )}
                        </div>
                        {c.direccion && (
                          <div className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">
                            {c.direccion}
                          </div>
                        )}
                      </td>

                      {/* Teléfono & Direct Actions */}
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700">
                            {formatPhoneNumber(c.telefono)}
                          </span>
                          <a
                            href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                            title="Llamar"
                            className="p-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <a
                            href={createWhatsAppUrl(c.telefono, c.nombre)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="p-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" />
                          </a>
                        </div>
                      </td>

                      {/* Etapa & Segmento */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              c.etapa?.startsWith('F6')
                                ? 'bg-orange-100 text-[#EA580C] border border-orange-300 font-black'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {c.etapa}
                          </span>
                          {c.estadoContacto === 'Ganado' && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Ganado
                            </span>
                          )}
                          {c.estadoContacto === 'Perdido' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                              Perdido
                            </span>
                          )}
                          {c.segmento && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {c.segmento}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tipo Cliente */}
                      <td className="p-3.5">
                        {c.tipoCliente === 'VIP' ? (
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            VIP
                          </span>
                        ) : c.tipoCliente === 'Compró Antes' ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                            Compró Antes
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-600">{c.tipoCliente}</span>
                        )}
                      </td>

                      {/* Rol / Cargo */}
                      <td className="p-3.5 text-slate-700 font-medium">{c.rolCargo}</td>

                      {/* Próximo Seguimiento */}
                      <td className="p-3.5">
                        {c.proximoSeguimiento ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                              isOverdue
                                ? 'bg-red-100 text-red-700 animate-pulse'
                                : isToday
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-600'
                            }`}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3 text-red-600" />}
                            {formatDateSpanish(c.proximoSeguimiento)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No programado</span>
                        )}
                      </td>

                      {/* Responsable */}
                      <td className="p-3.5">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                            c.responsable === 'sin asignar'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'text-slate-700 bg-slate-50'
                          }`}
                        >
                          {c.responsable}
                        </span>
                      </td>

                      {/* Open Button */}
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => onOpenContact(c)}
                          className="p-1 rounded-lg text-slate-400 hover:text-[#FF8407] hover:bg-orange-50 transition"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Visible on Mobile Screens) */}
        <div className="md:hidden divide-y divide-slate-100">
          {sorted.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              No hay contactos que coincidan con la búsqueda.
            </div>
          ) : (
            sorted.map((c) => {
              const isOverdue = isFollowUpOverdue(c.proximoSeguimiento);
              return (
                <div
                  key={c.id}
                  onClick={() => onOpenContact(c)}
                  className="p-4 hover:bg-slate-50 active:bg-orange-50/50 transition cursor-pointer space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{c.nombre}</h4>
                      <p className="text-xs text-slate-500">{c.rolCargo} • {c.direccion || 'Miami'}</p>
                    </div>
                    {c.tipoCliente === 'VIP' ? (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        VIP
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {c.tipoCliente}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs pt-1">
                    <div className="flex items-center gap-1">
                      <span
                        className={`font-bold ${
                          c.etapa?.startsWith('F6')
                            ? 'text-[#EA580C] bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200'
                            : 'text-[#FF8407]'
                        }`}
                      >
                        {c.etapa}
                      </span>
                      {c.estadoContacto === 'Ganado' && (
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Ganado
                        </span>
                      )}
                      {c.estadoContacto === 'Perdido' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                          Perdido
                        </span>
                      )}
                      {c.segmento && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                          {c.segmento}
                        </span>
                      )}
                    </div>

                    {c.proximoSeguimiento && (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          isOverdue
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {formatDateSpanish(c.proximoSeguimiento)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center justify-between pt-2 border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-slate-500 font-medium">
                      Resp: <strong className="text-slate-700">{c.responsable}</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-700"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={createWhatsAppUrl(c.telefono, c.nombre)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
