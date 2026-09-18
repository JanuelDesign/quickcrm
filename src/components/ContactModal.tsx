import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Download,
} from 'lucide-react';
import {
  Contacto,
  PIPELINE_STAGES,
  FUNNEL_STAGES,
  CLIENT_SEGMENTS,
  EXIT_STAGES,
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
  HistorialAccion,
} from '../types/crm';
import {
  formatPhoneNumber,
  createWhatsAppUrl,
  isFollowUpOverdue,
  isFollowUpToday,
  formatDateTimeSpanish,
  formatDateSpanish,
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
  const {
    updateContact,
    addContact,
    deleteContact,
    addNote,
    markContactedToday,
    updateContactStage,
    users,
    getContactAuditHistory,
  } = useCrm();
  const { isAdmin, userProfile } = useAuth();

  // Active Tab: 'datos' | 'notas' | 'acciones' | 'auditoria'
  const [activeTab, setActiveTab] = useState<'datos' | 'notas' | 'acciones' | 'auditoria'>('datos');

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
  const [fechaUltimoContacto, setFechaUltimoContacto] = useState('');
  const [responsable, setResponsable] = useState('sin asignar');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Audit Logs State (admin only)
  const [auditLogs, setAuditLogs] = useState<HistorialAccion[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Attachment state for notes
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    blob: Blob;
    previewUrl: string;
    tipo: 'llamada' | 'mensaje' | 'pdf';
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

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo PDF supera el límite de 5 MB.');
        return;
      }
      setPendingAttachment({
        file,
        blob: file,
        previewUrl: '',
        tipo: 'pdf',
        originalSize: file.size,
        compressedSize: file.size,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsCompressing(true);
    try {
      const res = await compressImage(file, 1280, 0.75);
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
      setPendingAttachment({
        file,
        blob: res.blob,
        previewUrl: res.previewUrl,
        tipo: 'mensaje',
        originalSize: res.originalSize,
        compressedSize: res.compressedSize,
      });
    } catch (err) {
      console.error('Error al procesar la imagen:', err);
      alert('No se pudo procesar la imagen seleccionada.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
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
      setFechaUltimoContacto(contact.fechaUltimoContacto || '');
      setResponsable(contact.responsable || 'sin asignar');
      setActiveTab('datos');
    } else {
      setNombre('');
      setTelefono('');
      setCorreo('');
      setDireccion('');
      setTipoCliente('Nunca Contactado');
      setEtapa(FUNNEL_STAGES[0].label);
      setSegmento('');
      setRolCargo('Installer');
      setVecesQueCompro('1 Compra');
      setEstadoContacto('Pendiente');
      setUltimaCompra('');
      const tomorrow = new Date(Date.now() + 86400000);
      tomorrow.setHours(10, 0, 0, 0);
      setProximoSeguimiento(tomorrow.toISOString().slice(0, 16));
      setFechaUltimoContacto('');
      setResponsable(userProfile?.nombre || 'sin asignar');
      setActiveTab('datos');
    }
    clearPendingAttachment();
    setNewNoteText('');
    setShowDeleteConfirm(false);
  }, [contact, isOpen, userProfile]);

  // Load audit history if admin and modal opens
  useEffect(() => {
    if (isOpen && contact && isAdmin) {
      setLoadingAudit(true);
      getContactAuditHistory(contact.id)
        .then((logs) => setAuditLogs(logs))
        .catch((err) => console.warn('Error al cargar auditoría:', err))
        .finally(() => setLoadingAudit(false));
    } else {
      setAuditLogs([]);
    }
  }, [isOpen, contact?.id, isAdmin]);

  if (!isOpen) return null;

  const isOverdue = isFollowUpOverdue(proximoSeguimiento);
  const isToday = isFollowUpToday(proximoSeguimiento);
  const isContactedToday = Boolean(fechaUltimoContacto && isFollowUpToday(fechaUltimoContacto));
  const isF6 = etapa.includes('F6') || etapa.startsWith('F6');

  // Helper for applying Ganado resolution with smart pre-suggestion
  const handleMarkGanado = () => {
    setEstadoContacto('Ganado');
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
        fechaUltimoContacto: fechaUltimoContacto
          ? new Date(fechaUltimoContacto).toISOString()
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
              fileName: pendingAttachment.file.name,
            });
            adjuntos = [uploaded];
          }
          const defaultText =
            pendingAttachment?.tipo === 'pdf'
              ? `Cotización PDF adjunta: ${pendingAttachment.file.name}`
              : pendingAttachment?.tipo === 'llamada'
              ? 'Captura de pantalla de llamada'
              : 'Captura de pantalla de conversación';
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
              fileName: pendingAttachment.file.name,
            });
            adjuntos = [uploaded];
          }
          const defaultText =
            pendingAttachment?.tipo === 'pdf'
              ? `Cotización PDF adjunta: ${pendingAttachment.file.name}`
              : pendingAttachment?.tipo === 'llamada'
              ? 'Captura de pantalla de llamada'
              : 'Captura de pantalla de conversación';
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
          fileName: pendingAttachment.file.name,
        });
        adjuntos = [uploaded];
      }

      const defaultText =
        pendingAttachment?.tipo === 'pdf'
          ? `Cotización PDF adjunta: ${pendingAttachment.file.name}`
          : pendingAttachment?.tipo === 'llamada'
          ? 'Captura de pantalla de llamada'
          : 'Captura de pantalla de conversación';
      const noteContent = trimmed || defaultText;

      await addNote(contact.id, noteContent, adjuntos);
      setNewNoteText('');
      clearPendingAttachment();
    } catch (err) {
      console.error('Error al agregar nota con adjunto:', err);
      alert('Error al subir el adjunto a Firebase Storage.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleMarkToday = async () => {
    const todayIso = new Date().toISOString();
    setFechaUltimoContacto(todayIso);
    if (contact) {
      await markContactedToday(contact.id);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    await deleteContact(contact.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  // Format audit action label
  const formatAuditAction = (accion: string) => {
    switch (accion) {
      case 'creacion':
        return { label: 'Creación de Contacto', color: 'bg-blue-100 text-blue-800' };
      case 'cambio_etapa':
        return { label: 'Cambio de Etapa', color: 'bg-orange-100 text-orange-800' };
      case 'reasignacion':
        return { label: 'Reasignación', color: 'bg-purple-100 text-purple-800' };
      case 'cambio_estado':
        return { label: 'Cierre Comercial', color: 'bg-emerald-100 text-emerald-800' };
      case 'cambio_segmento':
        return { label: 'Cambio de Segmento', color: 'bg-purple-100 text-purple-800' };
      case 'contacto_hoy':
        return { label: 'Contactado Hoy', color: 'bg-emerald-100 text-emerald-800' };
      case 'edicion_datos':
        return { label: 'Edición de Datos', color: 'bg-slate-100 text-slate-800' };
      case 'nueva_nota':
        return { label: 'Nota o Captura', color: 'bg-amber-100 text-amber-800' };
      default:
        return { label: accion, color: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 md:p-4 overflow-hidden">
      <div
        id="contact-detail-modal"
        className="relative w-full max-w-3xl bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[93vh] md:h-auto md:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-200 md:zoom-in-95"
      >
        {/* Mobile Top Grab Bar Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 md:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF8407]">
                {isNew ? 'Nuevo Contacto' : 'Ficha de Contacto'}
              </span>
              {!isNew && contact && (
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  ID: {contact.id.slice(0, 8)}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              {isNew ? 'Registrar Cliente / Contratista' : nombre || 'Sin Nombre'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Header (Organized for mobile & desktop) */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 sm:px-6 py-1 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('datos')}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap min-h-[44px] ${
              activeTab === 'datos'
                ? 'bg-orange-50 text-[#FF8407] border border-orange-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Datos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notas')}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap min-h-[44px] ${
              activeTab === 'notas'
                ? 'bg-orange-50 text-[#FF8407] border border-orange-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Notas</span>
            {notesList.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-black">
                {notesList.length}
              </span>
            )}
          </button>

          {!isNew && (
            <button
              type="button"
              onClick={() => setActiveTab('acciones')}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap min-h-[44px] ${
                activeTab === 'acciones'
                  ? 'bg-orange-50 text-[#FF8407] border border-orange-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Acciones Rápidas</span>
            </button>
          )}

          {isAdmin && !isNew && (
            <button
              type="button"
              onClick={() => setActiveTab('auditoria')}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap min-h-[44px] ${
                activeTab === 'auditoria'
                  ? 'bg-orange-50 text-[#FF8407] border border-orange-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Historial de Cambios</span>
              {auditLogs.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-black">
                  {auditLogs.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Modal Form Scrollable Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-4 sm:p-6 space-y-5 flex-1">
            {/* ================= TAB 1: DATOS DEL CONTACTO ================= */}
            {activeTab === 'datos' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Banner Especial F6: Cotización Enviada (Resolución de Cierre) */}
                {isF6 && (
                  <div className="p-4 rounded-2xl border-2 border-orange-200 bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-white shadow-xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[#EA580C] text-white text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5" />
                          Etapa F6 — Cotización Enviada
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
                      ¿Cuál fue el resultado de la cotización? Presiona para registrar el cierre comercial.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleMarkGanado}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all shadow-xs min-h-[48px] active:scale-98 border cursor-pointer ${
                          estadoContacto === 'Ganado'
                            ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/40'
                            : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Marcar como Ganado</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleMarkPerdido}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all shadow-xs min-h-[48px] active:scale-98 border cursor-pointer ${
                          estadoContacto === 'Perdido'
                            ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-500/40'
                            : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300'
                        }`}
                      >
                        <XCircle className="w-5 h-5" />
                        <span>Marcar como Perdido</span>
                      </button>
                    </div>

                    {estadoContacto === 'Ganado' && (
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-2 mt-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Asignar Segmento de Cliente (Post-Venta):</span>
                          </label>
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
                      </div>
                    )}
                  </div>
                )}

                {/* Section 1: Datos Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
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
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
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
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
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
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Section 2: Clasificación y Pipeline */}
                <div className="bg-slate-50/70 p-3.5 sm:p-4 rounded-xl border border-slate-200/90 space-y-3.5">
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
                        <optgroup label="Salida Permanente">
                          {EXIT_STAGES.map((s) => (
                            <option key={s.id} value={s.label}>
                              ⛔ {s.label}
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

                    {/* Segmento de Cliente */}
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

                    {/* Responsable */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Fecha Último Contacto</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleMarkToday}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold transition cursor-pointer ${
                          isContactedToday
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-orange-100 text-[#FF8407] hover:bg-orange-200'
                        }`}
                        title="Marcar como contactado hoy y registrar en auditoría"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isContactedToday ? 'Contactado hoy ✓' : 'Contactado hoy'}</span>
                      </button>
                    </div>
                    <input
                      type="datetime-local"
                      value={fechaUltimoContacto ? fechaUltimoContacto.slice(0, 16) : ''}
                      onChange={(e) => setFechaUltimoContacto(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FF8407]"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 sm:col-span-2">
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
              </div>
            )}

            {/* ================= TAB 2: NOTAS Y ADJUNTOS ================= */}
            {activeTab === 'notas' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Hidden native file inputs for capturing screenshots or attaching PDF */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
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

                {/* Note composer box */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-[#FF8407]" />
                      <span>Nueva Nota o Registro de Contacto</span>
                    </label>
                  </div>

                  <textarea
                    rows={2}
                    placeholder={
                      pendingAttachment
                        ? `Nota complementaria para este adjunto (${pendingAttachment.file.name})...`
                        : "Escribe una nota (ej. 'Cotizado 1,200 sqft SPC Sand Oak, espera respuesta el jueves...')"
                    }
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] transition"
                  />

                  {/* Pending attachment preview */}
                  {pendingAttachment && (
                    <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {pendingAttachment.tipo === 'pdf' ? (
                          <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        ) : (
                          <img
                            src={pendingAttachment.previewUrl}
                            alt="Preview"
                            className="w-10 h-10 rounded-lg object-cover border border-amber-300 shrink-0"
                          />
                        )}
                        <div className="truncate text-xs">
                          <div className="font-bold text-slate-900 truncate">
                            {pendingAttachment.file.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {pendingAttachment.tipo === 'pdf'
                              ? `Documento PDF • ${formatFileSize(pendingAttachment.originalSize)}`
                              : `Imagen optimizada • ${formatFileSize(pendingAttachment.compressedSize)}`}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={clearPendingAttachment}
                        className="p-1.5 hover:bg-amber-100 rounded-lg text-slate-500 hover:text-slate-800"
                        title="Quitar adjunto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Actions bar for composer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressing || isUploadingAttachment}
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition active:scale-95 cursor-pointer"
                        title="Adjuntar captura de llamada, WhatsApp o cotización PDF"
                      >
                        <Paperclip className="w-4 h-4 text-[#FF8407]" />
                        <span>Captura o PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isCompressing || isUploadingAttachment}
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition active:scale-95 cursor-pointer"
                        title="Tomar foto con la cámara"
                      >
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>Cámara</span>
                      </button>
                    </div>

                    {!isNew && (
                      <button
                        type="button"
                        onClick={handleAddNoteQuick}
                        disabled={
                          (!newNoteText.trim() && !pendingAttachment) ||
                          isCompressing ||
                          isUploadingAttachment
                        }
                        className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                      >
                        {isUploadingAttachment ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>Publicar Nota</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Chronological list of notes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Historial Registrado ({notesList.length})
                    </h3>
                  </div>

                  {notesList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                      No hay notas registradas para este contacto.
                    </div>
                  ) : (
                    notesList.map((note) => (
                      <div
                        key={note.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-900">{note.autor}</span>
                          <span className="text-slate-400">
                            {formatDateTimeSpanish(note.fecha)}
                          </span>
                        </div>

                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{note.texto}</p>

                        {/* Attachments: Images or PDFs */}
                        {note.adjuntos && note.adjuntos.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                            {note.adjuntos.map((adj, idx) => {
                              if (adj.tipo === 'pdf') {
                                return (
                                  <a
                                    key={idx}
                                    href={adj.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-xl bg-red-50/80 hover:bg-red-100/80 border border-red-200 text-red-900 text-xs font-medium transition"
                                  >
                                    <FileText className="w-4 h-4 text-red-600 shrink-0" />
                                    <span className="font-bold truncate max-w-[180px]">
                                      {adj.nombreArchivo || 'Cotización QuickQuote.pdf'}
                                    </span>
                                    <ExternalLink className="w-3.5 h-3.5 text-red-600 shrink-0 ml-1" />
                                  </a>
                                );
                              }

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedImageModal({
                                      url: adj.url,
                                      tipo: adj.tipo as 'llamada' | 'mensaje',
                                      autor: note.autor,
                                      fecha: note.fecha,
                                    })
                                  }
                                  className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-[#FF8407] transition shadow-2xs text-left cursor-pointer"
                                  title="Haz clic para ver captura"
                                >
                                  <img
                                    src={adj.url}
                                    alt="Captura"
                                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover group-hover:scale-105 transition duration-200"
                                    loading="lazy"
                                  />
                                  <div className="absolute bottom-0 inset-x-0 bg-slate-900/75 py-0.5 px-1 text-[9px] text-white font-bold flex items-center justify-center gap-0.5">
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
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ================= TAB 3: ACCIONES RÁPIDAS (MOBILE-FIRST) ================= */}
            {activeTab === 'acciones' && !isNew && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="text-xs text-slate-500">
                  Botones grandes de alta prioridad para llamadas, mensajes y resolución comercial:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Llamar Directo */}
                  <a
                    href={telefono ? `tel:${telefono.replace(/\s+/g, '')}` : '#'}
                    className={`flex items-center justify-center gap-2.5 px-4 py-3.5 min-h-[52px] rounded-2xl font-bold text-sm shadow-xs transition active:scale-98 ${
                      telefono
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-400 pointer-events-none'
                    }`}
                  >
                    <Phone className="w-5 h-5" />
                    <span>Llamar al Cliente ({formatPhoneNumber(telefono)})</span>
                  </a>

                  {/* WhatsApp Directo */}
                  <a
                    href={telefono ? createWhatsAppUrl(telefono, nombre) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2.5 px-4 py-3.5 min-h-[52px] rounded-2xl font-bold text-sm shadow-xs transition active:scale-98 ${
                      telefono
                        ? 'bg-[#25D366] hover:bg-[#20bd5a] text-white'
                        : 'bg-slate-100 text-slate-400 pointer-events-none'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>WhatsApp Quicksurfaces</span>
                  </a>

                  {/* Marcar contactado hoy */}
                  <button
                    type="button"
                    onClick={handleMarkToday}
                    className={`flex items-center justify-center gap-2.5 px-4 py-3.5 min-h-[52px] rounded-2xl font-bold text-sm transition active:scale-98 cursor-pointer ${
                      isContactedToday
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-700'
                        : 'bg-orange-50 hover:bg-orange-100 text-[#FF8407] border border-orange-200'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 ${isContactedToday ? 'text-white' : 'text-[#FF8407]'}`} />
                    <span>{isContactedToday ? '¡Contactado hoy! ✓' : 'Marcar Contactado Hoy'}</span>
                  </button>

                  {/* Avanzar al siguiente paso del embudo */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = FUNNEL_STAGES.findIndex(
                          (s) => etapa === s.label || etapa.startsWith(s.code)
                        );
                        if (idx >= 0 && idx < FUNNEL_STAGES.length - 1) {
                          setEtapa(FUNNEL_STAGES[idx + 1].label);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition active:scale-98 cursor-pointer"
                    >
                      <ArrowRight className="w-5 h-5 text-amber-400" />
                      <span>Avanzar Siguiente Etapa</span>
                    </button>
                  </div>
                </div>

                {/* Quick Stage buttons list */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700">Cambiar etapa a:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FUNNEL_STAGES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEtapa(s.label)}
                        className={`px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold border transition ${
                          etapa === s.label || etapa.startsWith(s.code)
                            ? 'bg-[#FF8407] text-white border-[#FF8407] shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {s.code}
                      </button>
                    ))}
                  </div>

                  {/* Salida Permanente a Lista Negra */}
                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(
                          '¿Estás seguro de enviar este contacto a M13 — Lista Negra? Esta acción lo marca como salida definitiva del embudo.'
                        );
                        if (confirmed) {
                          setEtapa(EXIT_STAGES[0].label);
                          setEstadoContacto('Perdido');
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                        etapa.startsWith('M13')
                          ? 'bg-red-950 text-red-200 border-red-700 ring-2 ring-red-500/50'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      }`}
                    >
                      <span>⛔ Enviar a M13 — Lista Negra (Salida Permanente)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: AUDITORÍA (ADMIN-ONLY) ================= */}
            {activeTab === 'auditoria' && isAdmin && !isNew && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Registro de Modificaciones (Auditoría Automática)</span>
                  </div>
                  <span className="text-xs text-slate-400">{auditLogs.length} eventos</span>
                </div>

                {loadingAudit ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#FF8407]" />
                    <span>Cargando historial de cambios...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    No se han registrado modificaciones para este contacto todavía.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {auditLogs.map((log, idx) => {
                      const badge = formatAuditAction(log.accion);
                      return (
                        <div
                          key={log.id || idx}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDateTimeSpanish(log.fecha)}
                            </span>
                          </div>

                          <div className="text-slate-800 font-semibold text-xs">
                            Por: <span className="text-slate-900">{log.usuarioNombre}</span>
                          </div>

                          {(log.valorAnterior || log.valorNuevo) && (
                            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                              <span className="line-through text-slate-400">
                                {log.valorAnterior || '(vacío)'}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="font-bold text-slate-900">
                                {log.valorNuevo || '(vacío)'}
                              </span>
                            </div>
                          )}

                          {log.detalle && (
                            <div className="text-[11px] text-slate-500 italic">
                              Detalle: {log.detalle}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Actions (Min 44px buttons) */}
          <div className="p-3 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
            <div>
              {isAdmin && !isNew && (
                <>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-600 font-bold hidden sm:inline">¿Eliminar?</span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-3 py-2 min-h-[44px] text-xs bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2 py-2 min-h-[44px] text-xs text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
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
                className="px-4 py-2 min-h-[44px] text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] bg-[#FF8407] hover:bg-[#E57300] disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
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
                  Abrir
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedImageModal(null)}
                  className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-5 overflow-auto flex items-center justify-center bg-black/40 max-h-[calc(92vh-50px)]">
              <img
                src={selectedImageModal.url}
                alt="Captura ampliada"
                className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
