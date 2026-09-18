import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Contacto,
  UsuarioCRM,
  NotaHistorial,
  AdjuntoNota,
  HistorialAccion,
  RegistroEliminacion,
  TipoAccionAuditoria,
  UserRole,
} from '../types/crm';
import { REAL_CSV_CONTACTS, OLD_TEST_NAMES } from '../data/realContacts';
import { useAuth } from './AuthContext';

interface CrmContextType {
  contacts: Contacto[]; // filtered for current user role
  allContacts: Contacto[]; // full list (for admin dashboard / reassignments)
  users: UsuarioCRM[];
  loadingContacts: boolean;
  firestoreConnected: boolean;
  isSyncing: boolean;
  addContact: (contact: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>) => Promise<string>;
  updateContact: (id: string, updates: Partial<Contacto>) => Promise<void>;
  updateContactStage: (id: string, newStage: string) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  reassignContacts: (contactIds: string[], newResponsable: string) => Promise<void>;
  claimContact: (id: string) => Promise<void>;
  addNote: (id: string, text: string, adjuntos?: AdjuntoNota[]) => Promise<void>;
  markContactedToday: (id: string) => Promise<void>;
  batchImportContacts: (newContacts: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>[]) => Promise<number>;
  reassignAllVendorContacts: (fromResponsable: string, toResponsable: string) => Promise<number>;
  addUser: (newUser: Omit<UsuarioCRM, 'creadoEn'>) => Promise<void>;
  toggleUserActive: (uid: string, active: boolean) => Promise<void>;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<void>;
  getContactAuditHistory: (contactoId: string) => Promise<HistorialAccion[]>;
  resetToSampleData: () => Promise<void>;
  syncRealContactsToFirestore: () => Promise<number>;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

const INITIAL_USERS: UsuarioCRM[] = [
  {
    uid: 'januel_admin_uid',
    email: 'janueldesign@gmail.com',
    nombre: 'Januel (Admin Quicksurfaces)',
    rol: 'admin',
    activo: true,
    creadoEn: new Date().toISOString(),
    telefono: '+1 (305) 500-8800',
  },
  {
    uid: 'admin_esteban_id',
    email: 'esteban.gavotti@quicksurfaces.com',
    nombre: 'Esteban Gavotti (Admin)',
    rol: 'admin',
    activo: true,
    creadoEn: new Date().toISOString(),
    telefono: '+1 (305) 500-8800',
  },
  {
    uid: 'vendedor_ruben_id',
    email: 'ruben.valverde@quicksurfaces.com',
    nombre: 'Ruben Valverde (Vendedor)',
    rol: 'vendedor',
    activo: true,
    creadoEn: new Date().toISOString(),
    telefono: '+1 (786) 555-0188',
  },
  {
    uid: 'vendedor_carlos_id',
    email: 'carlos.mendoza@quicksurfaces.com',
    nombre: 'Carlos Mendoza (Vendedor)',
    rol: 'vendedor',
    activo: true,
    creadoEn: new Date().toISOString(),
    telefono: '+1 (305) 555-0144',
  },
];

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isAdmin } = useAuth();
  // Inicializa directamente con los 193 contactos reales procesados del archivo CSV
  const [allContacts, setAllContacts] = useState<Contacto[]>(() => REAL_CSV_CONTACTS);
  const [users, setUsers] = useState<UsuarioCRM[]>(INITIAL_USERS);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Firestore Real-time listener for Contacts
  useEffect(() => {
    setLoadingContacts(true);
    const contactsCol = collection(db, 'contactos');

    const unsubscribe = onSnapshot(
      contactsCol,
      async (snapshot) => {
        if (snapshot.empty) {
          // Auto-seed real contacts if database is empty
          console.log('Firestore "contactos" está vacío, iniciando auto-seed de 193 contactos reales...');
          await seedInitialData();
          return;
        }

        const loaded: Contacto[] = [];
        const toDeleteOldDocs: string[] = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const nombre = data.nombre || 'Sin Nombre';

          // Detectar y purgar cualquier dato de prueba anterior
          const isOldTest =
            OLD_TEST_NAMES.includes(nombre) ||
            nombre.includes('MD Floors') ||
            nombre.includes('Biscayne Remodeling') ||
            nombre.includes('Flip Solutions Miami') ||
            nombre.includes('Propietarios');

          if (isOldTest) {
            toDeleteOldDocs.push(docSnap.id);
            return;
          }

          loaded.push({
            id: docSnap.id,
            nombre,
            telefono: data.telefono || '',
            correo: data.correo || '',
            direccion: data.direccion || '',
            tipoCliente: data.tipoCliente || 'Nunca Contactado',
            etapa: data.etapa || 'A1 — Base de Datos',
            ultimaCompra: data.ultimaCompra || undefined,
            rolCargo: data.rolCargo || 'Installer',
            vecesQueCompro: data.vecesQueCompro || '1 Compra',
            estadoContacto: data.estadoContacto || 'Pendiente',
            fechaUltimoContacto: data.fechaUltimoContacto || undefined,
            proximoSeguimiento: data.proximoSeguimiento || undefined,
            notas: Array.isArray(data.notas) ? data.notas : (data.notas ? [data.notas] : []),
            responsable: data.responsable || 'sin asignar',
            creadoEn: data.creadoEn || new Date().toISOString(),
            actualizadoEn: data.actualizadoEn || new Date().toISOString(),
          });
        });

        // Si se detectaron datos viejos de prueba en Firestore, eliminarlos
        if (toDeleteOldDocs.length > 0) {
          try {
            const batch = writeBatch(db);
            toDeleteOldDocs.forEach((id) => {
              batch.delete(doc(db, 'contactos', id));
            });
            await batch.commit();
            console.log(`Eliminados ${toDeleteOldDocs.length} datos de prueba antiguos de Firestore.`);
          } catch (delErr) {
            console.warn('No se pudieron eliminar datos de prueba antiguos:', delErr);
          }
        }

        if (loaded.length > 0) {
          setAllContacts(loaded);
        } else {
          // Si quedaron vacíos por eliminar pruebas, sembrar los 193 reales
          await seedInitialData();
        }
        setLoadingContacts(false);
        setFirestoreConnected(true);
      },
      (error) => {
        console.warn('onSnapshot error on contactos, usando datos locales reales:', error);
        setLoadingContacts(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  // Firestore Real-time listener for Users
  useEffect(() => {
    const usersCol = collection(db, 'usuarios');
    const unsubscribe = onSnapshot(
      usersCol,
      async (snapshot) => {
        if (snapshot.empty) {
          // Auto-seed initial system users in Firestore so they exist in Firebase Console
          try {
            const batch = writeBatch(db);
            INITIAL_USERS.forEach((u) => {
              const ref = doc(db, 'usuarios', u.uid);
              batch.set(ref, u);
            });
            await batch.commit();
          } catch (err) {
            console.warn('Could not auto-seed users in Firestore:', err);
          }
          return;
        }

        const loadedUsers: UsuarioCRM[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<UsuarioCRM>;
          return {
            uid: docSnap.id,
            email: data.email || '',
            nombre: data.nombre || 'Usuario',
            rol: (data.rol as UserRole) || 'vendedor',
            activo: data.activo !== false,
            creadoEn: data.creadoEn || new Date().toISOString(),
            telefono: data.telefono,
          };
        });

        setUsers(loadedUsers);
        setFirestoreConnected(true);
      },
      (error) => {
        console.warn('onSnapshot users warning:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const seedInitialData = async () => {
    setIsSyncing(true);
    try {
      // 1. Seed users if empty
      const usersSnap = await getDocs(collection(db, 'usuarios'));
      if (usersSnap.empty) {
        console.log('Seeding usuarios iniciales a Firestore...');
        const batch = writeBatch(db);
        INITIAL_USERS.forEach((u) => {
          const ref = doc(db, 'usuarios', u.uid);
          batch.set(ref, u);
        });
        await batch.commit();
        console.log('Usuarios iniciales guardados en Firestore.');
      }

      // 2. Seed contacts if empty
      const contactsSnap = await getDocs(collection(db, 'contactos'));
      if (contactsSnap.empty) {
        console.log('Sembrando 193 contactos reales a Firestore...');
        const count = await batchImportContacts(REAL_CSV_CONTACTS);
        console.log(`Se sembraron exitosamente ${count} contactos en Firestore.`);
      }
      setFirestoreConnected(true);
    } catch (e) {
      console.error('Error durante auto-seed en Firestore:', e);
      setAllContacts(REAL_CSV_CONTACTS);
      setLoadingContacts(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const resetToSampleData = async () => {
    setIsSyncing(true);
    try {
      const snap = await getDocs(collection(db, 'contactos'));
      if (!snap.empty) {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 100) {
          const batch = writeBatch(db);
          docs.slice(i, i + 100).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      await batchImportContacts(REAL_CSV_CONTACTS);
      setFirestoreConnected(true);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'contactos');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncRealContactsToFirestore = async (): Promise<number> => {
    setIsSyncing(true);
    try {
      const count = await batchImportContacts(REAL_CSV_CONTACTS);
      setFirestoreConnected(true);
      return count;
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter contacts according to user role:
  // Vendedor only sees contacts assigned to them OR 'sin asignar' (or empty)
  // Admin sees all
  const visibleContacts = React.useMemo(() => {
    if (!userProfile) return [];
    if (isAdmin) {
      return allContacts;
    }

    const myUid = (userProfile.uid || '').toLowerCase();
    const myEmail = (userProfile.email || '').toLowerCase();
    const myName = (userProfile.nombre || '').toLowerCase();

    return allContacts.filter((c) => {
      const resp = (c.responsable || '').toLowerCase().trim();
      if (!resp || resp === 'sin asignar' || resp === 'unassigned') {
        return true;
      }
      return (
        resp === myUid ||
        resp === myEmail ||
        resp === myName ||
        myName.includes(resp) ||
        resp.includes(myName)
      );
    });
  }, [allContacts, userProfile, isAdmin]);

  // Helper to record automatic background audit logs in contactos/{contactoId}/historialAcciones
  const logAuditAction = async (
    contactoId: string,
    accion: TipoAccionAuditoria,
    valorAnterior: string | null,
    valorNuevo: string | null,
    detalle?: string
  ) => {
    const auditEntry: HistorialAccion = {
      accion,
      valorAnterior: valorAnterior || null,
      valorNuevo: valorNuevo || null,
      usuarioId: userProfile?.uid || 'anon',
      usuarioNombre: userProfile?.nombre || userProfile?.email || 'Usuario',
      fecha: new Date().toISOString(),
      ...(detalle ? { detalle } : {}),
    };

    try {
      await addDoc(collection(db, 'contactos', contactoId, 'historialAcciones'), auditEntry);
    } catch (err) {
      console.warn('No se pudo registrar historialAcciones en Firestore:', err);
    }
  };

  // Helper to record deleted contacts in /registroEliminaciones
  const logDeletionAction = async (target: Contacto) => {
    const record: RegistroEliminacion = {
      contactoId: target.id,
      contactoNombre: target.nombre,
      telefono: target.telefono,
      etapa: target.etapa,
      responsable: target.responsable,
      usuarioId: userProfile?.uid || 'anon',
      usuarioNombre: userProfile?.nombre || userProfile?.email || 'Admin',
      fecha: new Date().toISOString(),
      motivo: 'Eliminado por administrador',
    };

    try {
      await addDoc(collection(db, 'registroEliminaciones'), record);
    } catch (err) {
      console.warn('No se pudo registrar registroEliminaciones en Firestore:', err);
    }
  };

  const addContact = async (contact: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<string> => {
    const now = new Date().toISOString();
    const payload = {
      ...contact,
      creadoEn: now,
      actualizadoEn: now,
    };
    try {
      const docRef = await addDoc(collection(db, 'contactos'), payload);
      // Automatic background audit: record creation
      logAuditAction(docRef.id, 'creacion', null, payload.etapa || 'A1 — Base de Datos', 'Contacto registrado en CRM');
      // Optimistically update
      setAllContacts((prev) => [{ ...payload, id: docRef.id }, ...prev]);
      return docRef.id;
    } catch (e) {
      console.warn('Error guardando contacto en Firestore:', e);
      const newId = `c_local_${Date.now()}`;
      setAllContacts((prev) => [{ ...payload, id: newId }, ...prev]);
      return newId;
    }
  };

  const updateContact = async (id: string, updates: Partial<Contacto>) => {
    const now = new Date().toISOString();
    const target = allContacts.find((c) => c.id === id);

    // Automatic background auditing: detect what changed
    if (target) {
      // 1. Cambio de etapa (ej: "A1" pasa a "C3")
      if (updates.etapa && updates.etapa !== target.etapa) {
        const prevCode = target.etapa.split(' ')[0] || target.etapa;
        const newCode = updates.etapa.split(' ')[0] || updates.etapa;
        logAuditAction(id, 'cambio_etapa', prevCode, newCode, `${target.etapa} → ${updates.etapa}`);
      }

      // 2. Reasignación de vendedor
      if (updates.responsable !== undefined && updates.responsable !== target.responsable) {
        logAuditAction(
          id,
          'reasignacion',
          target.responsable || 'sin asignar',
          updates.responsable || 'sin asignar'
        );
      }

      // 3. Cambio de estado a Ganado o Perdido
      if (updates.estadoContacto && updates.estadoContacto !== target.estadoContacto) {
        if (updates.estadoContacto === 'Ganado') {
          logAuditAction(id, 'marcado_ganado', target.estadoContacto, 'Ganado');
        } else if (updates.estadoContacto === 'Perdido') {
          logAuditAction(id, 'marcado_perdido', target.estadoContacto, 'Perdido');
        }
      }

      // 4. Cambio de segmento post-venta
      if (updates.segmento !== undefined && updates.segmento !== target.segmento) {
        logAuditAction(
          id,
          'cambio_segmento',
          target.segmento || 'Sin segmento',
          updates.segmento || 'Sin segmento'
        );
      }
    }

    // Direct Firestore update
    try {
      const docRef = doc(db, 'contactos', id);
      await updateDoc(docRef, {
        ...updates,
        actualizadoEn: now,
      });
    } catch (e) {
      console.warn(`Error actualizando contacto ${id} en Firestore:`, e);
    }

    setAllContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates, actualizadoEn: now } : c))
    );
  };

  const updateContactStage = async (id: string, newStage: string) => {
    if (newStage.startsWith('M13')) {
      await updateContact(id, { etapa: newStage, estadoContacto: 'Perdido' });
    } else {
      await updateContact(id, { etapa: newStage });
    }
  };

  const deleteContact = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Solo los administradores pueden eliminar contactos.');
    }
    const target = allContacts.find((c) => c.id === id);
    if (target) {
      await logDeletionAction(target);
    }

    try {
      const docRef = doc(db, 'contactos', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn(`Error eliminando contacto ${id} de Firestore:`, e);
    }

    setAllContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const reassignContacts = async (contactIds: string[], newResponsable: string) => {
    const now = new Date().toISOString();
    try {
      const batch = writeBatch(db);
      contactIds.forEach((id) => {
        const ref = doc(db, 'contactos', id);
        batch.update(ref, {
          responsable: newResponsable,
          actualizadoEn: now,
        });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Error reasignando contactos en Firestore:', e);
    }

    setAllContacts((prev) =>
      prev.map((c) =>
        contactIds.includes(c.id) ? { ...c, responsable: newResponsable, actualizadoEn: now } : c
      )
    );
  };

  const claimContact = async (id: string) => {
    if (!userProfile) return;
    await updateContact(id, {
      responsable: userProfile.nombre || userProfile.email,
    });
  };

  const addNote = async (id: string, text: string, adjuntos?: AdjuntoNota[]) => {
    const target = allContacts.find((c) => c.id === id);
    if (!target) return;

    const newNote: NotaHistorial = {
      id: 'note_' + Date.now(),
      fecha: new Date().toISOString(),
      autor: userProfile?.nombre || userProfile?.email || 'Usuario',
      texto: text.trim(),
      ...(adjuntos && adjuntos.length > 0 ? { adjuntos } : {}),
    };

    let updatedNotas: NotaHistorial[] = [];
    if (Array.isArray(target.notas)) {
      updatedNotas = [newNote, ...target.notas];
    } else if (typeof target.notas === 'string' && target.notas.trim()) {
      updatedNotas = [
        newNote,
        {
          id: 'note_prev',
          fecha: target.creadoEn,
          autor: 'Nota anterior',
          texto: target.notas,
        },
      ];
    } else {
      updatedNotas = [newNote];
    }

    await updateContact(id, {
      notas: updatedNotas,
      fechaUltimoContacto: new Date().toISOString(),
    });
  };

  const markContactedToday = async (id: string) => {
    const now = new Date().toISOString();
    await updateContact(id, {
      fechaUltimoContacto: now,
    });
    // Automatic audit entry for "contactado hoy"
    await logAuditAction(
      id,
      'contacto_hoy',
      null,
      'Hoy',
      'Contacto marcado como contactado hoy'
    );
  };

  const batchImportContacts = async (
    newContacts: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>[]
  ): Promise<number> => {
    const now = new Date().toISOString();
    let count = 0;

    const chunkSize = 40;
    try {
      for (let i = 0; i < newContacts.length; i += chunkSize) {
        const chunk = newContacts.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const ref = doc(collection(db, 'contactos'));
          const cleanItem: Record<string, any> = {
            nombre: (item.nombre && String(item.nombre).trim()) || 'Sin Nombre',
            telefono: (item.telefono && String(item.telefono).trim()) || '',
            tipoCliente: (item.tipoCliente && String(item.tipoCliente).trim()) || 'Nunca Contactado',
            etapa: (item.etapa && String(item.etapa).trim()) || 'A1 — Base de Datos',
            rolCargo: (item.rolCargo && String(item.rolCargo).trim()) || 'Installer',
            vecesQueCompro: (item.vecesQueCompro && String(item.vecesQueCompro).trim()) || '1 Compra',
            estadoContacto: (item.estadoContacto && String(item.estadoContacto).trim()) || 'Pendiente',
            responsable: (item.responsable && String(item.responsable).trim()) || 'sin asignar',
            notas: Array.isArray(item.notas)
              ? item.notas.filter(Boolean).map(String)
              : (item.notas ? [String(item.notas)] : []),
            creadoEn: now,
            actualizadoEn: now,
          };

          if (item.correo && typeof item.correo === 'string' && item.correo.trim()) {
            cleanItem.correo = item.correo.trim();
          }
          if (item.direccion && typeof item.direccion === 'string' && item.direccion.trim()) {
            cleanItem.direccion = item.direccion.trim();
          }
          if (item.ultimaCompra && typeof item.ultimaCompra === 'string' && item.ultimaCompra.trim()) {
            cleanItem.ultimaCompra = item.ultimaCompra.trim();
          }
          if (item.fechaUltimoContacto && typeof item.fechaUltimoContacto === 'string' && item.fechaUltimoContacto.trim()) {
            cleanItem.fechaUltimoContacto = item.fechaUltimoContacto.trim();
          }
          if (item.proximoSeguimiento && typeof item.proximoSeguimiento === 'string' && item.proximoSeguimiento.trim()) {
            cleanItem.proximoSeguimiento = item.proximoSeguimiento.trim();
          }

          batch.set(ref, cleanItem);
          count++;
        });

        await batch.commit();
        console.log(`Lote de ${chunk.length} contactos guardado en Firestore (${count}/${newContacts.length}).`);
      }
      return count;
    } catch (e) {
      console.error('batchImportContacts falló en Firestore, manteniendo copia en memoria:', e);
      const mapped: Contacto[] = newContacts.map((item, idx) => ({
        ...item,
        id: `csv_imp_${Date.now()}_${idx}`,
        creadoEn: now,
        actualizadoEn: now,
      }));
      setAllContacts((prev) => [...mapped, ...prev]);
      throw e;
    }
  };

  const reassignAllVendorContacts = async (fromResponsable: string, toResponsable: string): Promise<number> => {
    if (!isAdmin) throw new Error('Acción exclusiva para administradores');

    const toReassign = allContacts.filter((c) => c.responsable === fromResponsable);
    if (toReassign.length === 0) return 0;
    const now = new Date().toISOString();

    try {
      const batch = writeBatch(db);
      toReassign.forEach((c) => {
        const ref = doc(db, 'contactos', c.id);
        batch.update(ref, {
          responsable: toResponsable,
          actualizadoEn: now,
        });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Error transfiriendo contactos en lote en Firestore:', e);
    }

    setAllContacts((prev) =>
      prev.map((c) =>
        c.responsable === fromResponsable ? { ...c, responsable: toResponsable, actualizadoEn: now } : c
      )
    );
    return toReassign.length;
  };

  const addUser = async (newUser: Omit<UsuarioCRM, 'creadoEn'>) => {
    const userWithDate: UsuarioCRM = {
      ...newUser,
      creadoEn: new Date().toISOString(),
    };
    try {
      const ref = doc(db, 'usuarios', newUser.uid);
      await setDoc(ref, userWithDate, { merge: true });
    } catch (e) {
      console.warn('Error guardando usuario en Firestore:', e);
    }
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.uid !== newUser.uid);
      return [...filtered, userWithDate];
    });
  };

  const toggleUserActive = async (uid: string, active: boolean) => {
    try {
      const ref = doc(db, 'usuarios', uid);
      await updateDoc(ref, {
        activo: active,
      });
    } catch (e) {
      console.warn('Error actualizando estado de usuario en Firestore:', e);
    }
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, activo: active } : u))
    );
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    if (!isAdmin) {
      throw new Error('Solo los administradores pueden cambiar roles de usuario.');
    }
    try {
      const ref = doc(db, 'usuarios', uid);
      await updateDoc(ref, {
        rol: newRole,
      });
    } catch (e) {
      console.warn('Error actualizando rol de usuario en Firestore:', e);
    }
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, rol: newRole } : u))
    );
  };

  // Get audit log history for a specific contact (admin only)
  const getContactAuditHistory = async (contactoId: string): Promise<HistorialAccion[]> => {
    if (!contactoId) return [];
    try {
      const q = query(
        collection(db, 'contactos', contactoId, 'historialAcciones'),
        orderBy('fecha', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as HistorialAccion) }));
    } catch (err) {
      console.warn('Error al obtener historialAcciones:', err);
      return [];
    }
  };

  return (
    <CrmContext.Provider
      value={{
        contacts: visibleContacts,
        allContacts,
        users,
        loadingContacts,
        firestoreConnected,
        isSyncing,
        addContact,
        updateContact,
        updateContactStage,
        deleteContact,
        reassignContacts,
        claimContact,
        addNote,
        markContactedToday,
        batchImportContacts,
        reassignAllVendorContacts,
        addUser,
        toggleUserActive,
        updateUserRole,
        getContactAuditHistory,
        resetToSampleData,
        syncRealContactsToFirestore,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
};
