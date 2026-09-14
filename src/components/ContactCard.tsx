import React from 'react';
import {
  Phone,
  MessageCircle,
  Calendar,
  AlertCircle,
  UserCheck,
  Building2,
  Clock,
  Sparkles,
  MapPin,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Contacto, PIPELINE_STAGES, FUNNEL_STAGES, CLIENT_SEGMENTS } from '../types/crm';
import {
  formatPhoneNumber,
  createWhatsAppUrl,
  isFollowUpOverdue,
  isFollowUpToday,
  formatDateSpanish,
} from '../utils/formatters';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../context/AuthContext';

interface ContactCardProps {
  contact: Contacto;
  onOpen: (contact: Contacto) => void;
  onDragStart?: (e: React.DragEvent, contactId: string) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onOpen,
  onDragStart,
}) => {
  const { claimContact, updateContactStage } = useCrm();
  const { isVendedor } = useAuth();

  const isOverdue = isFollowUpOverdue(contact.proximoSeguimiento);
  const isToday = isFollowUpToday(contact.proximoSeguimiento);
  const isUnassigned =
    !contact.responsable ||
    contact.responsable.toLowerCase().trim() === 'sin asignar' ||
    contact.responsable.toLowerCase().trim() === 'unassigned';

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.telefono) {
      window.location.href = `tel:${contact.telefono.replace(/\s+/g, '')}`;
    }
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.telefono) {
      const url = createWhatsAppUrl(contact.telefono, contact.nombre);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleClaim = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await claimContact(contact.id);
  };

  const handleStageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    await updateContactStage(contact.id, e.target.value);
  };

  return (
    <div
      id={`card-${contact.id}`}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, contact.id)}
      onClick={() => onOpen(contact)}
      className="group relative bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing hover:border-[#FF8407]/60"
    >
      {/* Top badges: Tipo Cliente + Quick Stage Selector */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        {/* Tipo Cliente Badge */}
        {contact.tipoCliente === 'VIP' ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/15 to-orange-500/20 text-[#D97706] border border-amber-300">
            <Sparkles className="w-3 h-3 text-[#FF8407]" />
            VIP
          </span>
        ) : contact.tipoCliente === 'Compró Antes' ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            Compró Antes
          </span>
        ) : contact.tipoCliente === 'Contactado sin Compra' ? (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            Contactado
          </span>
        ) : (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200">
            Nuevo Lead
          </span>
        )}

        {/* Rol / Cargo Tag */}
        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[130px]">
          {contact.rolCargo}
        </span>
      </div>

      {/* Client / Business Name */}
      <h4 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-[#FF8407] transition line-clamp-2">
        {contact.nombre}
      </h4>

      {/* Location if Miami Dade */}
      {contact.direccion && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-600 truncate">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{contact.direccion}</span>
        </div>
      )}

      {/* Ganado / Perdido or Segment pill if defined */}
      {(contact.estadoContacto === 'Ganado' ||
        contact.estadoContacto === 'Perdido' ||
        contact.segmento) && (
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {contact.estadoContacto === 'Ganado' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> Ganado
            </span>
          )}
          {contact.estadoContacto === 'Perdido' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
              <XCircle className="w-3 h-3" /> Perdido
            </span>
          )}
          {contact.segmento && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 truncate max-w-[180px]"
              title={`Segmento: ${contact.segmento}`}
            >
              🏷️ {contact.segmento.split(' — ')[0] || contact.segmento}
            </span>
          )}
        </div>
      )}

      {/* Follow-up Pill (Highlighted in RED if overdue) */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        {contact.proximoSeguimiento ? (
          <div
            className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
              isOverdue
                ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                : isToday
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-50 text-slate-600'
            }`}
            title={`Próximo seguimiento: ${formatDateSpanish(contact.proximoSeguimiento)}`}
          >
            {isOverdue ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="text-[11px]">
              {isOverdue ? '¡Vencido!' : isToday ? 'Hoy' : formatDateSpanish(contact.proximoSeguimiento)}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 italic">Sin seguimiento</span>
        )}

        {/* Rep badge or claim button */}
        {isUnassigned ? (
          isVendedor ? (
            <button
              onClick={handleClaim}
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
              title="Asignarme este contacto"
            >
              + Tomar
            </button>
          ) : (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              Sin asignar
            </span>
          )
        ) : (
          <span className="text-[10px] text-slate-600 truncate max-w-[90px]" title={`Responsable: ${contact.responsable}`}>
            {contact.responsable.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Quick Action Dial Buttons (Phone / WhatsApp) */}
      <div className="mt-2.5 flex items-center justify-between gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
        <div className="flex items-center gap-1">
          {/* Direct Call Button */}
          {contact.telefono && (
            <button
              onClick={handleCall}
              title={`Llamar a ${formatPhoneNumber(contact.telefono)}`}
              className="p-1.5 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 shadow-2xs transition active:scale-90"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Direct WhatsApp Button */}
          {contact.telefono && (
            <button
              onClick={handleWhatsApp}
              title="Abrir WhatsApp directo con mensaje"
              className="p-1.5 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 shadow-2xs transition active:scale-90"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          )}
        </div>

        {/* Quick mobile stage selector if needed */}
        <select
          value={contact.etapa}
          onClick={(e) => e.stopPropagation()}
          onChange={handleStageChange}
          className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none focus:border-[#FF8407] max-w-[130px] truncate"
          title="Mover de etapa"
        >
          <optgroup label="Embudo de Venta">
            {FUNNEL_STAGES.map((s) => (
              <option key={s.id} value={s.label}>
                {s.code} — {s.nombre}
              </option>
            ))}
          </optgroup>
          <optgroup label="Segmentos de Cliente">
            {CLIENT_SEGMENTS.map((s) => (
              <option key={s.id} value={s.label}>
                {s.code} — {s.nombre}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
};
