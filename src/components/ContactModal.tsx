import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Calendar,
  Clock,
  User,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Building,
  Plus,
  Send,
  History,
  XCircle,
  Tag,
  Check,
  Paperclip,
  Camera,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import {
  Contacto,
  PIPELINE_STAGES,
  FUNNEL_STAGES,
  CLIENT_SEGMENTS,
  TIPOS_CLIENTE,
  ROLES_CARGO,
  VECES_COMPRO,
  ESTADOS_CONTACTO,
  TipoCliente,
  RolCargo,
  VecesQueCompro,
  EstadoContacto,
  NotaHistorial,
  AdjuntoNota,
} from '../types/crm';
import {
  formatPhoneNumber,
  createWhatsAppUrl,
  isFollowUpOverdue,
  isFollowUpToday,
  formatDateTimeSpanish,
} from '../utils/formatters';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import { uploadNotaAttachment } from '../utils/storageService';

interface ContactModalProps {
  contact: Contacto | null;
  isOpen: boolean;
  onClose: () => void;
  isNew?: boolean;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  contact,
  isOpen,
  onClose,
  isNew = false,
}) => {
  const { updateContact, addContact, deleteContact, addNote, markContactedToday, users } = useCrm();
  const { isAdmin, userProfile } = useAuth();

  // Form State
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('Nunca Contactado');
  const [etapa, setEtapa] = useState<string>(FUNNEL_STAGES[0].label);
  const [segmento, setSegmento] = useState<string>('');
  const [rolCargo, setRolCargo] = useState<RolCargo>('Installer');
  const [vecesQueCompro, setVecesQueCompro] = useState<VecesQueCompro>('1 Compra');
  const [estadoContacto, setEstadoContacto] = useState<EstadoContacto>('Pendiente');
  const [ultimaCompra, setUltimaCompra] = useState('');
  const [proximoSeguimiento, setProximoSeguimiento] = useState('');
  const [responsable, setResponsable] = useState('sin asignar');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Attachment state for notes
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    blob: Blob;
    previewUrl: string;
    tipo: 'llamada' | 'mensaje';
    originalSize: number;
    compressedSize: number;
  } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<{
    url: string;
    tipo: 'llamada' | 'mensaje';
    autor: string;
    fecha: string;
  } | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearPendingAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      // Comprime a máx 1280px y 75% calidad JPEG en el navegador con canvas
      const res = await compressImage(file, 1280, 0.75);
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
      setPendingAttachment({
        file,
        blob: res.blob,
        previewUrl: res.previewUrl,
        tipo: 'mensaje', // Default: mensaje WhatsApp / SMS
        originalSize: res.originalSize,
        compressedSize: res.compressedSize,
      });
    } catch (err) {
      console.error('Error al procesar la imagen:', err);
      alert('No se pudo procesar la imagen seleccionada. Asegúrate de que sea un formato de imagen válido.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  // Sync form state when contact changes
  useEffect(() => {
    if (contact) {
      setNombre(contact.nombre || '');
      setTelefono(contact.telefono || '');
      setCorreo(contact.correo || '');
      setDireccion(contact.direccion || '');
      setTipoCliente(contact.tipoCliente || 'Nunca Contactado');
      setEtapa(contact.etapa || FUNNEL_STAGES[0].label);
      // If contact already has a segment or its stage was previously a segment code:
      const existingSeg =
        contact.segmento ||
        CLIENT_SEGMENTS.find(
          (s) => contact.etapa === s.label || contact.etapa?.startsWith(s.code)
        )?.label ||
        '';
      setSegmento(existingSeg);
      setRolCargo(contact.rolCargo || 'Installer');
      setVecesQueCompro(contact.vecesQueCompro || '1 Compra');
      setEstadoContacto(contact.estadoContacto || 'Pendiente');
      setUltimaCompra(contact.ultimaCompra ? contact.ultimaCompra.slice(0, 10) : '');
      setProximoSeguimiento(
        contact.proximoSeguimiento ? contact.proximoSeguimiento.slice(0, 16) : ''
      );
      setResponsable(contact.responsable || 'sin asignar');
    } else {
      // New Contact defaults
      setNombre('');
      setTelefono('');
      setCorreo('');
      setDireccion('Miami, FL');
      setTipoCliente('Nunca Contactado');
      setEtapa(FUNNEL_STAGES[0].label);
      setSegmento('');
      setRolCargo('General Contractor');
      setVecesQueCompro('1 Compra');
      setEstadoContacto('Pendiente');
      setUltimaCompra('');
      // Default next follow-up: tomorrow 10am
      const tomorrow = new Date(Date.now() + 86400000);
      tomorrow.setHours(10, 0, 0, 0);
      setProximoSeguimiento(tomorrow.toISOString().slice(0, 16));
      setResponsable(userProfile?.nombre || 'sin asignar');
    }
  }, [contact, isOpen, userProfile]);

  if (!isOpen) return null;

  const isOverdue = isFollowUpOverdue(proximoSeguimiento);
  const isToday = isFollowUpToday(proximoSeguimiento);
  const isF6 = etapa.includes('F6') || etapa.startsWith('F6');

  // Helper for applying Ganado resolution with smart pre-suggestion
  const handleMarkGanado = () => {
    setEstadoContacto('Ganado');
    // Pre-sugerencia simple según especificación:
    // Si rolCargo es "Home Owner" sugiere N14
    // Si vecesQueCompro es ">5 Compras" sugiere K11
    // Si no hay sugerencia clara, deja el selector vacío para que decidan
    if (!segmento) {
      if (rolCargo === 'Home Owner') {
        const segN14 = CLIENT_SEGMENTS.find((s) => s.code === 'N14');
        if (segN14) setSegmento(segN14.label);
      } else if (vecesQueCompro === '>5 Compras') {
        const segK11 = CLIENT_SEGMENTS.find((s) => s.code === 'K11');
        if (segK11) setSegmento(segK11.label);
      }
    }
  };

  const handleMarkPerdido = () => {
    setEstadoContacto('Perdido');
  };

  // Notes parsing
  const notesList: NotaHistorial[] = contact
    ? Array.isArray(contact.notas)
      ? contact.notas
      : typeof contact.notas === 'string' && contact.notas.trim()
      ? [
          {
            id: 'legacy',
            fecha: contact.creadoEn,
            autor: 'Nota inicial',
            texto: contact.notas,
          },
        ]
      : []
    : [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !telefono.trim()) {
      alert('Por favor introduce al menos el nombre y teléfono del cliente.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        correo: correo.trim() || undefined,
        direccion: direccion.trim() || undefined,
        tipoCliente,
        etapa,
        segmento: segmento.trim() || undefined,
        rolCargo,
        vecesQueCompro,
        estadoContacto,
        ultimaCompra: ultimaCompra ? new Date(ultimaCompra).toISOString() : undefined,
        proximoSeguimiento: proximoSeguimiento
          ? new Date(proximoSeguimiento).toISOString()
          : undefined,
        responsable: responsable.trim(),
      };

      if (isNew) {
        const createdId = await addContact({
          ...payload,
          notas: [],
        });

        if (newNoteText.trim() || pendingAttachment) {
          let adjuntos: AdjuntoNota[] | undefined = undefined;
          if (pendingAttachment) {
            const notaId = 'n_' + Date.now();
            const uploaded = await uploadNotaAttachment({
              contactoId: createdId,
              notaId,
              blob: pendingAttachment.blob,
              tipo: pendingAttachment.tipo,
            });
            adjuntos = [uploaded];
          }
          const defaultText =
            pendingAttachment?.tipo === 'llamada'
              ? 'Captura de pantalla de llamada'
              : 'Captura de pantalla de mensaje / conversación';
          await addNote(createdId, newNoteText.trim() || defaultText, adjuntos);
          clearPendingAttachment();
        }
      } else if (contact) {
        await updateContact(contact.id, payload);
        if (newNoteText.trim() || pendingAttachment) {
          let adjuntos: AdjuntoNota[] | undefined = undefined;
          if (pendingAttachment) {
            const notaId = 'n_' + Date.now();
            const uploaded = await uploadNotaAttachment({
              contactoId: contact.id,
              notaId,
              blob: pendingAttachment.blob,
              tipo: pendingAttachment.tipo,
            });
            adjuntos = [uploaded];
          }
          const defaultText =
            pendingAttachment?.tipo === 'llamada'
              ? 'Captura de pantalla de llamada'
              : 'Captura de pantalla de mensaje / conversación';
          await addNote(contact.id, newNoteText.trim() || defaultText, adjuntos);
          setNewNoteText('');
          clearPendingAttachment();
        }
      }
      onClose();
    } catch (err) {
      console.error('Error saving contact:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNoteQuick = async () => {
    if (!contact) return;
    const trimmed = newNoteText.trim();
    if (!trimmed && !pendingAttachment) return;

    setIsUploadingAttachment(true);
    try {
      let adjuntos: AdjuntoNota[] | undefined = undefined;
      if (pendingAttachment) {
        const notaId = 'n_' + Date.now();
        const uploaded = await uploadNotaAttachment({
          contactoId: contact.id,
          notaId,
          blob: pendingAttachment.blob,
          tipo: pendingAttachment.tipo,
        });
        adjuntos = [uploaded];
      }

      const defaultText =
        pendingAttachment?.tipo === 'llamada'
          ? 'Captura de pantalla de llamada'
          : 'Captura de pantalla de mensaje / conversación';
      const noteContent = trimmed || defaultText;

      await addNote(contact.id, noteContent, adjuntos);
      setNewNoteText('');
      clearPendingAttachment();
    } catch (err) {
      console.error('Error al agregar nota con adjunto:', err);
      alert('Error al subir la captura a Firebase Storage.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleMarkToday = async () => {
    if (!contact) return;
    await markContactedToday(contact.id);
  };

  const handleDelete = async () => {
    if (!contact) return;
    await deleteContact(contact.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div
        id="contact-detail-modal"
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF8407]">
                {isNew ? 'Nuevo Contacto' : 'Ficha de Contacto'}
              </span>
              {!isNew && contact && (
                <span className="text-xs text-slate-400">ID: {contact.id.slice(0, 8)}</span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isNew ? 'Registrar Cliente / Contratista' : nombre || 'Sin Nombre'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Communication Action Bar (Phone / WhatsApp / Mail) */}
        {!isNew && telefono && (
          <div className="bg-gradient-to-r from-orange-50/70 to-amber-50/70 border-b border-orange-100 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Acción Rápida Miami:</span>
              <a
                href={`tel:${telefono.replace(/\s+/g, '')}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-xs border border-slate-200 transition active:scale-95"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Llamar ({formatPhoneNumber(telefono)})</span>
              </a>

              <a
                href={createWhatsAppUrl(telefono, nombre)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Quicksurfaces</span>
              </a>

              {correo && (
                <a
                  href={`mailto:${correo}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-xs border border-slate-200 transition hidden sm:flex"
                >
                  <Mail className="w-3.5 h-3.5 text-sky-600" />
                  <span>Email</span>
                </a>
              )}
            </div>

            <button
              onClick={handleMarkToday}
              className="flex items-center gap-1 text-xs text-[#FF8407] hover:text-[#E57300] font-semibold bg-white/80 hover:bg-white px-2.5 py-1.5 rounded-lg border border-orange-200 transition"
              title="Registrar que se habló con el cliente hoy"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Contactado hoy</span>
            </button>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Banner Especial F6: Cotización Enviada (Resolución de Cierre) */}
          {isF6 && (
            <div className="p-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-white shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#EA580C] text-white text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    Etapa F6 — Cotización Enviada
                  </span>
                  <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                    (Paso previo a integración QuickQuote)
                  </span>
                </div>
                {estadoContacto === 'Ganado' && (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" /> Ganado
                  </span>
                )}
                {estadoContacto === 'Perdido' && (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-100 px-3 py-1 rounded-full border border-rose-200">
                    <XCircle className="w-4 h-4" /> Perdido
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Cuál fue el resultado de la cotización? Presiona para registrar el cierre comercial. Al marcar Ganado se habilitará la clasificación de segmento de cliente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Botón Grande: Marcar como Ganado */}
                <button
                  type="button"
                  onClick={handleMarkGanado}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-sm transition-all shadow-xs active:scale-98 border cursor-pointer ${
                    estadoContacto === 'Ganado'
                      ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/40 shadow-sm'
                      : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-emerald-400'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Marcar como Ganado</span>
                </button>

                {/* Botón Grande: Marcar como Perdido */}
                <button
                  type="button"
                  onClick={handleMarkPerdido}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-sm transition-all shadow-xs active:scale-98 border cursor-pointer ${
                    estadoContacto === 'Perdido'
                      ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-500/40 shadow-sm'
                      : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300 hover:border-rose-400'
                  }`}
                >
                  <XCircle className="w-5 h-5" />
                  <span>Marcar como Perdido</span>
                </button>
              </div>

              {/* Si se marca Ganado, mostrar selector automático de segmento con sugerencia */}
              {estadoContacto === 'Ganado' && (
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-2 mt-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Asignar Segmento de Cliente (Post-Venta):</span>
                    </label>
                    {(rolCargo === 'Home Owner' || vecesQueCompro === '>5 Compras') && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        💡 {rolCargo === 'Home Owner' ? 'Sugerido N14 (Rol Home Owner)' : 'Sugerido K11 (Frecuencia >5 Compras)'}
                      </span>
                    )}
                  </div>

                  <select
                    value={segmento}
                    onChange={(e) => setSegmento(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="">-- Seleccionar Segmento de Cartera --</option>
                    {CLIENT_SEGMENTS.map((s) => (
                      <option key={s.id} value={s.label}>
                        {s.code} — {s.nombre} ({s.description})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Clasifica el contacto según su recurrencia o tipo de negocio para seguimiento comercial en Quicksurfaces.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Datos Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre del Cliente o Empresa *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Marcos Delgado — MD Floors LLC"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono Directo *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. +1 (305) 555-0192"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Correo Electrónico (opcional)
              </label>
              <input
                type="email"
                placeholder="cliente@gmail.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dirección / Ubicación en Miami
              </label>
              <input
                type="text"
                placeholder="Ej. Doral, Wynwood, Coral Gables, Hialeah..."
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Section 2: Clasificación y Pipeline */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/90 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Clasificación Comercial Quicksurfaces
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Etapa del Pipeline */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Etapa del Pipeline
                </label>
                <select
                  value={etapa}
                  onChange={(e) => setEtapa(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#FF8407]"
                >
                  <optgroup label="Embudo Comercial (Secuencial)">
                    {FUNNEL_STAGES.map((s) => (
                      <option key={s.id} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Segmentos de Cartera">
                    {CLIENT_SEGMENTS.map((s) => (
                      <option key={s.id} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                  {etapa &&
                    !PIPELINE_STAGES.some((s) => s.label === etapa || etapa.startsWith(s.code)) && (
                      <option value={etapa}>
                        🏷️ {etapa} (Etapa adicional CSV)
                      </option>
                    )}
                </select>
              </div>

              {/* Segmento de Cliente (Post-Venta) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Segmento de Cliente
                </label>
                <select
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-purple-800 focus:outline-none focus:border-[#FF8407]"
                >
                  <option value="">Sin Segmento Asignado</option>
                  {CLIENT_SEGMENTS.map((s) => (
                    <option key={s.id} value={s.label}>
                      {s.code} — {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Cliente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Cliente
                </label>
                <select
                  value={tipoCliente}
                  onChange={(e) => setTipoCliente(e.target.value as TipoCliente)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
                >
                  {TIPOS_CLIENTE.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Rol / Cargo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rol o Cargo
                </label>
                <select
                  value={rolCargo}
                  onChange={(e) => setRolCargo(e.target.value as RolCargo)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
                >
                  {ROLES_CARGO.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estado de Contacto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estado de Relación
                </label>
                <select
                  value={estadoContacto}
                  onChange={(e) => setEstadoContacto(e.target.value as EstadoContacto)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
                >
                  {ESTADOS_CONTACTO.map((ec) => (
                    <option key={ec} value={ec}>
                      {ec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Veces que Compró */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Frecuencia de Compra
                </label>
                <select
                  value={vecesQueCompro}
                  onChange={(e) => setVecesQueCompro(e.target.value as VecesQueCompro)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
                >
                  {VECES_COMPRO.map((vc) => (
                    <option key={vc} value={vc}>
                      {vc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Responsable / Asignado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Responsable</span>
                  {!isAdmin && <span className="text-[10px] text-slate-400">Vendedor</span>}
                </label>
                {isAdmin ? (
                  <select
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
                  >
                    <option value="sin asignar">⚠️ Sin asignar</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.nombre}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={responsable}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold cursor-not-allowed"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Seguimiento y Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#FF8407]" />
                <span>Próximo Seguimiento</span>
                {isOverdue && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                    ¡Vencido!
                  </span>
                )}
                {isToday && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    Hoy
                  </span>
                )}
              </label>
              <input
                type="datetime-local"
                value={proximoSeguimiento}
                onChange={(e) => setProximoSeguimiento(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none transition ${
                  isOverdue
                    ? 'border-2 border-red-400 bg-red-50 text-red-900'
                    : 'bg-white border border-slate-200 text-slate-900 focus:border-[#FF8407]'
                }`}
              />
              <p className="text-[10px] text-slate-600 mt-1">
                Programa recordatorio para llamar o cotizar metraje.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Fecha de Última Compra (opcional)</span>
              </label>
              <input
                type="date"
                value={ultimaCompra}
                onChange={(e) => setUltimaCompra(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FF8407]"
              />
            </div>
          </div>

          {/* Section 4: Historial de Notas y Capturas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#FF8407]" />
                <span>Historial de Notas y Llamadas</span>
              </h3>
              <span className="text-xs text-slate-400">{notesList.length} notas</span>
            </div>

            {/* Hidden native file input for capturing/attaching screenshots */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Quick Add Note input + Clip / Attach buttons */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCompressing || isUploadingAttachment}
                  title="Adjuntar captura de llamada o mensaje desde archivos/galería"
                  className={`p-2 sm:px-2.5 sm:py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                    pendingAttachment
                      ? 'bg-amber-50 border-[#FF8407] text-[#FF8407]'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="hidden sm:inline">Adjuntar</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isCompressing || isUploadingAttachment}
                  title="Tomar foto directa con la cámara"
                  className="p-2 sm:px-2.5 sm:py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Cámara</span>
                </button>
              </div>

              <input
                type="text"
                placeholder={
                  pendingAttachment
                    ? `Agregar nota para esta captura de ${pendingAttachment.tipo}...`
                    : "Escribe una nueva nota (ej. 'Enviadas muestras de SPC Almond...')"
                }
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
              />

              {!isNew && (
                <button
                  type="button"
                  onClick={handleAddNoteQuick}
                  disabled={
                    (!newNoteText.trim() && !pendingAttachment) ||
                    isCompressing ||
                    isUploadingAttachment
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                >
                  {isUploadingAttachment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span className="hidden sm:inline">Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Compression progress banner */}
            {isCompressing && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Optimizando captura en navegador (máx 1280px, JPEG 75%)...</span>
              </div>
            )}

            {/* Pending Attachment Preview & Type Selector */}
            {pendingAttachment && (
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={pendingAttachment.previewUrl}
                      alt="Miniatura previa"
                      className="w-14 h-14 object-cover rounded-lg border border-amber-300 shadow-2xs"
                    />
                    <span className="absolute -top-1.5 -right-1.5 bg-[#FF8407] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                      ✓
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Captura lista para subir</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                        {formatFileSize(pendingAttachment.originalSize)} → {formatFileSize(pendingAttachment.compressedSize)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Selecciona el tipo de evidencia que representa:
                    </p>
                    {/* Type selection buttons: Llamada vs Mensaje */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAttachment((prev) => (prev ? { ...prev, tipo: 'llamada' } : null))
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                          pendingAttachment.tipo === 'llamada'
                            ? 'bg-[#FF8407] text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Phone className="w-3 h-3" />
                        <span>Llamada</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPendingAttachment((prev) => (prev ? { ...prev, tipo: 'mensaje' } : null))
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                          pendingAttachment.tipo === 'mensaje'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Mensaje / WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearPendingAttachment}
                  className="self-end sm:self-center px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Quitar</span>
                </button>
              </div>
            )}

            {/* Notes Timeline */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {notesList.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                  Sin notas previas. Agrega la primera nota o captura arriba.
                </div>
              ) : (
                notesList.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 text-xs transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{note.autor}</span>
                      <span className="text-[10px] text-slate-600">
                        {formatDateTimeSpanish(note.fecha)}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{note.texto}</p>

                    {/* Thumbnails of attached screenshots */}
                    {note.adjuntos && note.adjuntos.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-200/60">
                        {note.adjuntos.map((adj, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setSelectedImageModal({
                                url: adj.url,
                                tipo: adj.tipo,
                                autor: note.autor,
                                fecha: note.fecha,
                              })
                            }
                            className="group relative rounded-lg overflow-hidden border border-slate-200 hover:border-[#FF8407] transition shadow-2xs hover:shadow-xs text-left"
                            title="Haz clic para ver la captura ampliada"
                          >
                            <img
                              src={adj.url}
                              alt={`Captura de ${adj.tipo}`}
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover group-hover:scale-105 transition duration-200"
                              loading="lazy"
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-slate-900/75 backdrop-blur-xs py-0.5 px-1 text-[9px] text-white font-bold flex items-center justify-center gap-0.5">
                              {adj.tipo === 'llamada' ? (
                                <>
                                  <Phone className="w-2.5 h-2.5 text-amber-300" />
                                  <span>Llamada</span>
                                </>
                              ) : (
                                <>
                                  <MessageCircle className="w-2.5 h-2.5 text-emerald-300" />
                                  <span>Mensaje</span>
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <div>
              {isAdmin && !isNew && (
                <>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar contacto</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-bold">¿Confirmar eliminación?</span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-2.5 py-1 text-xs bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#FF8407] hover:bg-[#E57300] disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando...' : isNew ? 'Crear Contacto' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Lightbox Modal for Full View Screenshot */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
          onClick={() => setSelectedImageModal(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox header */}
            <div className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/95 border-b border-slate-700 text-white text-xs">
              <div className="flex items-center gap-2 truncate">
                {selectedImageModal.tipo === 'llamada' ? (
                  <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Llamada</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Mensaje / WhatsApp</span>
                  </span>
                )}
                <span className="text-slate-400 truncate">
                  • {selectedImageModal.autor} ({formatDateTimeSpanish(selectedImageModal.fecha)})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={selectedImageModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  Abrir en pestaña
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedImageModal(null)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lightbox image */}
            <div className="p-3 sm:p-5 overflow-auto flex items-center justify-center bg-black/40 max-h-[calc(92vh-50px)]">
              <img
                src={selectedImageModal.url}
                alt={`Captura ${selectedImageModal.tipo}`}
                className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
