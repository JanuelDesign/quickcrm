import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  ArrowRightLeft,
  Shield,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Phone,
  Mail,
  RefreshCw,
  HardDrive,
  Trash2,
  Image as ImageIcon,
  Info,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../context/AuthContext';
import { UsuarioCRM, UserRole } from '../types/crm';
import { formatDateTimeSpanish } from '../utils/formatters';

export const UserManagement: React.FC = () => {
  const {
    users,
    allContacts,
    toggleUserActive,
    updateUserRole,
    addUser,
    reassignAllVendorContacts,
    syncRealContactsToFirestore,
    firestoreConnected,
    isSyncing,
  } = useCrm();
  const { isAdmin, userProfile } = useAuth();
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSync = async () => {
    try {
      const count = await syncRealContactsToFirestore();
      setSyncFeedback(`✅ Sincronizados ${count} contactos y equipo con Firestore con éxito.`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (e) {
      setSyncFeedback('⚠️ Error al sincronizar con Firestore');
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // Storage audit state for cleaning attachments of closed contacts
  const [showStorageAudit, setShowStorageAudit] = useState(false);

  // Calculation of closed contacts (> 180 days) with attachments in Firebase Storage
  const auditResults = React.useMemo(() => {
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const closedCandidates = allContacts.filter((c) => {
      const isClosed = c.estadoContacto === 'Ganado' || c.estadoContacto === 'Perdido';
      if (!isClosed) return false;
      const dateVal = c.actualizadoEn || c.creadoEn;
      if (!dateVal) return false;
      const time = new Date(dateVal).getTime();
      return nowMs - time >= SIX_MONTHS_MS;
    });

    let totalImages = 0;
    const contactsWithImages: {
      id: string;
      nombre: string;
      estado: string;
      fecha: string;
      imageCount: number;
    }[] = [];

    closedCandidates.forEach((c) => {
      let count = 0;
      if (Array.isArray(c.notas)) {
        c.notas.forEach((n) => {
          if (n.adjuntos && n.adjuntos.length > 0) {
            count += n.adjuntos.length;
          }
        });
      }
      if (count > 0) {
        totalImages += count;
        contactsWithImages.push({
          id: c.id,
          nombre: c.nombre,
          estado: c.estadoContacto,
          fecha: c.actualizadoEn || c.creadoEn,
          imageCount: count,
        });
      }
    });

    // Approximate size: ~220 KB per compressed JPEG image
    const estimatedKb = Math.round(totalImages * 220);
    const estimatedMb = (estimatedKb / 1024).toFixed(2);

    return {
      totalCandidates: closedCandidates.length,
      totalContactsWithImages: contactsWithImages.length,
      totalImages,
      estimatedKb,
      estimatedMb,
      contactsWithImages,
    };
  }, [allContacts]);

  // New user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTelefono, setNewTelefono] = useState('');
  const [newRol, setNewRol] = useState<UserRole>('vendedor');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Bulk Reassign state
  const [sourceVendor, setSourceVendor] = useState('');
  const [targetVendor, setTargetVendor] = useState('');
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim() || !newEmail.trim()) return;

    setIsSavingUser(true);
    try {
      const generatedUid = 'usr_' + Date.now();
      await addUser({
        uid: generatedUid,
        nombre: newNombre.trim(),
        email: newEmail.trim().toLowerCase(),
        telefono: newTelefono.trim() || undefined,
        rol: newRol,
        activo: true,
      });

      setNewNombre('');
      setNewEmail('');
      setNewTelefono('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleBulkTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceVendor || !targetVendor || sourceVendor === targetVendor) {
      alert('Selecciona un vendedor de origen y un vendedor de destino diferente.');
      return;
    }

    try {
      const count = await reassignAllVendorContacts(sourceVendor, targetVendor);
      setReassignSuccessMsg(`Se han transferido ${count} contactos de "${sourceVendor}" a "${targetVendor}".`);
      setSourceVendor('');
      setTargetVendor('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF8407]">
            Administración del Equipo Quicksurfaces
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Gestión de Vendedores y Roles
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Activa o desactiva vendedores, registra nuevos integrantes y reasigna carteras completas de clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition disabled:opacity-50"
            title="Sincronizar contactos y usuarios en Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#FF8407]' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Firestore'}</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FF8407] hover:bg-[#E57300] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{showAddForm ? 'Cerrar Formulario' : 'Nuevo Vendedor'}</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{syncFeedback}</span>
          <button onClick={() => setSyncFeedback(null)} className="text-emerald-600 hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Firebase Firestore Connection & Permission Status Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
              <span>🔥 Firebase Firestore Conectado</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-700 text-amber-300">
                quicksurfaces-crm
              </span>
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Los contactos y usuarios están sincronizados en tiempo real en las colecciones <code className="text-amber-300 font-mono">contactos</code> y <code className="text-amber-300 font-mono">usuarios</code>. Puedes cambiar los roles (Admin / Vendedor) directamente desde aquí o en tu Consola de Firebase, y los permisos se actualizan en vivo al instante.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700/80">
          <div className="text-center">
            <div className="text-lg font-black text-amber-400">{allContacts.length}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Contactos</div>
          </div>
          <div className="w-px h-8 bg-slate-700"></div>
          <div className="text-center">
            <div className="text-lg font-black text-emerald-400">{users.length}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Usuarios / Roles</div>
          </div>
        </div>
      </div>

      {/* Add User Form Drawer / Card */}
      {showAddForm && (
        <form
          onSubmit={handleCreateUser}
          className="bg-white p-6 rounded-2xl border-2 border-[#FF8407]/30 shadow-md space-y-4 animate-in fade-in"
        >
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#FF8407]" />
            <span>Registrar Nuevo Vendedor o Administrador</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
              <input
                type="text"
                required
                placeholder="Ej. Andrés Morales"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FF8407]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico *</label>
              <input
                type="email"
                required
                placeholder="andres@quicksurfaces.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FF8407]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono Directo</label>
              <input
                type="text"
                placeholder="+1 (305) ..."
                value={newTelefono}
                onChange={(e) => setNewTelefono(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FF8407]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rol en QuickCRM</label>
              <select
                value={newRol}
                onChange={(e) => setNewRol(e.target.value as UserRole)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#FF8407]"
              >
                <option value="vendedor">💼 Vendedor (Ve solo sus contactos)</option>
                <option value="admin">👑 Admin (Acceso total y reasignación)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingUser}
              className="px-5 py-2 bg-[#FF8407] hover:bg-[#E57300] text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              {isSavingUser ? 'Guardando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      )}

      {/* Users Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#FF8407]" />
            <span>Vendedores y Administradores Registrados ({users.length})</span>
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {users.map((u) => {
            const assignedCount = allContacts.filter(
              (c) => c.responsable === u.nombre || c.responsable === u.email || c.responsable === u.uid
            ).length;

            return (
              <div
                key={u.uid}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
                      u.rol === 'admin'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-orange-100 text-[#FF8407] border border-orange-200'
                    }`}
                  >
                    {u.rol === 'admin' ? '👑' : '💼'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm">{u.nombre}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.rol === 'admin'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {u.rol}
                      </span>
                      {!u.activo && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {u.email}
                      </span>
                      {u.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {u.telefono}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">{assignedCount}</div>
                    <div className="text-[10px] text-slate-400">Contactos</div>
                  </div>

                  {/* Role Selector (Admins can change user roles) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={u.rol}
                        disabled={u.uid === userProfile?.uid}
                        onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          u.rol === 'admin'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-orange-50 text-[#FF8407] border-orange-200'
                        }`}
                        title={u.uid === userProfile?.uid ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                      >
                        <option value="vendedor">💼 Vendedor</option>
                        <option value="admin">👑 Administrador</option>
                      </select>
                    </div>
                  )}

                  {/* Active Toggle Button */}
                  <button
                    onClick={() => toggleUserActive(u.uid, !u.activo)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      u.activo
                        ? 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {u.activo ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Activo</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>Desactivado</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk Transfer Tool */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-[#FF8407]" />
          <span>Transferencia Masiva de Cartera entre Vendedores</span>
        </h2>
        <p className="text-xs text-slate-500">
          Útil cuando un vendedor sale de vacaciones o cambia de territorio en Miami-Dade. Reasigna todos sus contactos en un solo clic.
        </p>

        {reassignSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{reassignSuccessMsg}</span>
          </div>
        )}

        <form onSubmit={handleBulkTransfer} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-2">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transferir desde (Vendedor Origen):
            </label>
            <select
              value={sourceVendor}
              onChange={(e) => setSourceVendor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
            >
              <option value="">Seleccionar vendedor origen...</option>
              <option value="sin asignar">⚠️ Contactos Sin Asignar</option>
              {users.map((u) => (
                <option key={u.uid} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transferir hacia (Nuevo Vendedor):
            </label>
            <select
              value={targetVendor}
              onChange={(e) => setTargetVendor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
            >
              <option value="">Seleccionar nuevo vendedor...</option>
              <option value="sin asignar">⚠️ Dejar Sin Asignar</option>
              {users.map((u) => (
                <option key={u.uid} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
          >
            Ejecutar Transferencia
          </button>
        </form>
      </div>

      {/* Mantenimiento de Firebase Storage: Limpieza de adjuntos de contactos cerrados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
              <HardDrive className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>Almacenamiento Firebase Storage & Capturas</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase">
                  Mantenimiento Admin
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Audita y visualiza el espacio que ocupan las capturas de llamadas y mensajes de prospectos cerrados
                (Ganados o Perdidos) hace más de 6 meses (180 días).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowStorageAudit(!showStorageAudit)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition active:scale-95 shrink-0"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span>
              {showStorageAudit ? 'Ocultar auditoría' : 'Borrar adjuntos de contactos cerrados hace más de 6 meses'}
            </span>
          </button>
        </div>

        {/* Panel de resultados de la auditoría */}
        {showStorageAudit && (
          <div className="mt-5 pt-5 border-t border-slate-100 animate-in fade-in space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Contactos cerrados &gt;180d</span>
                <div className="text-xl font-black text-slate-900 mt-1">{auditResults.totalCandidates}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Con estado Ganado o Perdido</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <span className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>Capturas adjuntas encontradas</span>
                </span>
                <div className="text-xl font-black text-amber-700 mt-1">{auditResults.totalImages} imágenes</div>
                <p className="text-[11px] text-amber-600/90 mt-0.5">En {auditResults.totalContactsWithImages} contactos</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <span className="text-[11px] font-bold text-blue-800 uppercase flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  <span>Espacio estimado a liberar</span>
                </span>
                <div className="text-xl font-black text-blue-700 mt-1">~{auditResults.estimatedMb} MB</div>
                <p className="text-[11px] text-blue-600/90 mt-0.5">({auditResults.estimatedKb} KB en Firebase Storage)</p>
              </div>
            </div>

            {/* Banner informativo de seguridad: preparado, no activo */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
              <Info className="w-4 h-4 text-[#FF8407] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-800">
                  Modo de auditoría preventiva activo (borrado automático deshabilitado)
                </p>
                <p>
                  Esta herramienta lista los recursos identificados para que el administrador pueda evaluar y decidir si depurar.
                  Ningún archivo ha sido eliminado todavía. Para ejecutar la purga manual en el futuro, se activará la confirmación destructiva.
                </p>
              </div>
            </div>

            {/* Listado de contactos con capturas */}
            {auditResults.contactsWithImages.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Detalle de contactos cerrados con capturas ({auditResults.contactsWithImages.length}):
                </h4>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {auditResults.contactsWithImages.map((item) => (
                    <div key={item.id} className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                            item.estado === 'Ganado' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.estado}
                        </span>
                        <span className="font-bold text-slate-800">{item.nombre}</span>
                        <span className="text-[11px] text-slate-400">
                          (Cerrado: {formatDateTimeSpanish(item.fecha)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          <span>{item.imageCount} captura{item.imageCount > 1 ? 's' : ''}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 italic">
                No se encontraron contactos cerrados hace más de 6 meses con capturas adjuntas pendientes de depurar.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
