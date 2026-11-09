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
  VecesQueCompro,
} from '../types/crm';
import { REAL_CSV_CONTACTS, OLD_TEST_NAMES } from '../data/realContacts';
import { useAuth } from './AuthContext';
import { isContactAssignedToUser, isContactUnassigned } from '../utils/formatters';

interface CrmContextType {
  contacts: Contacto[]; // filtered for current user role (assigned + unassigned)
  myAssignedContacts: Contacto[]; // contacts strictly assigned to current user
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
  bulkUpdateFollowUpDate: (contactIds: string[], dateString: string) => Promise<void>;
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

        const toDeleteOldDocs: string[] = [];
        const seenMap = new Map<string, Contacto>();

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

          const currentContact: Contacto = {
            id: docSnap.id,
            nombre,
            personaEncargada: data.personaEncargada || undefined,
            telefono: data.telefono || '',
            correo: data.correo || '',
            direccion: data.direccion || '',
            tipoCliente: data.tipoCliente || 'Nunca Contactado',
            etapa: data.etapa || 'A1 — Base de Datos',
            segmento: data.segmento || undefined,
            ultimaCompra: data.ultimaCompra || undefined,
            rolCargo: data.rolCargo || 'Installer',
            vecesQueCompro: (data.vecesQueCompro as VecesQueCompro) || (data.tipoCliente === 'Nunca Contactado' ? 'Nunca ha comprado' : '1 Compra'),
            estadoContacto: data.estadoContacto || 'Pendiente',
            fechaUltimoContacto: data.fechaUltimoContacto || undefined,
            proximoSeguimiento: data.proximoSeguimiento || undefined,
            notas: Array.isArray(data.notas) ? data.notas : (data.notas ? [data.notas] : []),
            responsable: data.responsable || 'sin asignar',
            responsableId: data.responsableId || undefined,
            fechaAsignacion: data.fechaAsignacion || undefined,
            asignadoPor: data.asignadoPor || undefined,
            creadoEn: data.creadoEn || new Date().toISOString(),
            actualizadoEn: data.actualizadoEn || new Date().toISOString(),
          };

          // Clave única para evitar duplicados por teléfono o nombre
          const cleanPhone = (currentContact.telefono || '').replace(/\D/g, '');
          const cleanName = (currentContact.nombre || '').trim().toLowerCase();
          const uniqueKey = cleanPhone.length >= 7 ? `tel:${cleanPhone}` : `name:${cleanName}`;

          if (seenMap.has(uniqueKey)) {
            const existing = seenMap.get(uniqueKey)!;
            const currentHasResp = currentContact.responsable && currentContact.responsable !== 'sin asignar';
            const existingHasResp = existing.responsable && existing.responsable !== 'sin asignar';
            if (currentHasResp && !existingHasResp) {
              toDeleteOldDocs.push(existing.id);
              seenMap.set(uniqueKey, currentContact);
            } else {
              toDeleteOldDocs.push(currentContact.id);
            }
          } else {
            seenMap.set(uniqueKey, currentContact);
          }
        });

        const deduplicatedList = Array.from(seenMap.values());

        // Si se detectaron datos viejos de prueba o duplicados en Firestore, eliminarlos
        if (toDeleteOldDocs.length > 0) {
          try {
            const batch = writeBatch(db);
            toDeleteOldDocs.forEach((id) => {
              batch.delete(doc(db, 'contactos', id));
            });
            await batch.commit();
            console.log(`Eliminados ${toDeleteOldDocs.length} datos de prueba o duplicados de Firestore.`);
          } catch (delErr) {
            console.warn('No se pudieron eliminar datos antiguos o duplicados:', delErr);
          }
        }

        if (deduplicatedList.length > 0) {
          setAllContacts(deduplicatedList);
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
    // Si Firestore ya contiene la base de contactos (>= 190), no reimportar para prevenir duplicaciones
    if (allContacts.length >= 190) {
      console.log(`Firestore ya contiene ${allContacts.length} contactos. Omitiendo importación redundante.`);
      return allContacts.length;
    }
    setIsSyncing(true);
    try {
      const count = await batchImportContacts(REAL_CSV_CONTACTS);
      setFirestoreConnected(true);
      return count;
    } finally {
      setIsSyncing(false);
    }
  };

  // Mis contactos estrictamente asignados a mí (excluye sin asignar)
  const myAssignedContacts = React.useMemo(() => {
    if (!userProfile) return [];
    return allContacts.filter((c) => isContactAssignedToUser(c, userProfile, users));
  }, [allContacts, userProfile, users]);

  // Contactos visibles en Kanban y Listado:
  // Vendedor ve sus contactos asignados + los que están 'sin asignar' para poder tomarlos
  // Admin ve todos
  const visibleContacts = React.useMemo(() => {
    if (!userProfile) return [];
    if (isAdmin) {
      return allContacts;
    }

    return allContacts.filter((c) => {
      if (isContactUnassigned(c)) {
        return true;
      }
      return isContactAssignedToUser(c, userProfile, users);
    });
  }, [allContacts, userProfile, isAdmin, users]);

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

    const cleanStr = (s: string) =>
      s
        .replace(/\(vendedor\)/gi, '')
        .replace(/\(admin\)/gi, '')
        .replace(/\(administrador\)/gi, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    let finalUpdates: Partial<Contacto> = { ...updates };

    // Automatic assignment enrichment: when responsable changes, populate responsableId & fechaAsignacion
    if (updates.responsable !== undefined && updates.responsable !== target?.responsable) {
      const isUnassigned = isContactUnassigned({ responsable: updates.responsable });

      if (!isUnassigned) {
        const targetClean = cleanStr(updates.responsable);
        const matchedUser = users.find(
          (u) =>
            u.uid === updates.responsable ||
            (u.email && u.email.toLowerCase() === updates.responsable?.toLowerCase()) ||
            cleanStr(u.nombre) === targetClean
        );

        finalUpdates.responsableId = matchedUser?.uid || updates.responsableId;
        finalUpdates.fechaAsignacion = updates.fechaAsignacion || now;
        finalUpdates.asignadoPor =
          updates.asignadoPor || (userProfile?.nombre || userProfile?.email || 'Admin');
      } else {
        finalUpdates.responsableId = undefined;
        finalUpdates.fechaAsignacion = undefined;
        finalUpdates.asignadoPor = undefined;
      }
    }

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
      const firestorePayload: Record<string, any> = {
        ...finalUpdates,
        actualizadoEn: now,
      };
      // Clean undefined keys before saving to Firestore
      Object.keys(firestorePayload).forEach((key) => {
        if (firestorePayload[key] === undefined) {
          delete firestorePayload[key];
        }
      });
      await updateDoc(docRef, firestorePayload);
    } catch (e) {
      console.warn(`Error actualizando contacto ${id} en Firestore:`, e);
    }

    setAllContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...finalUpdates, actualizadoEn: now } : c))
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
    const cleanStr = (s: string) =>
      s
        .replace(/\(vendedor\)/gi, '')
        .replace(/\(admin\)/gi, '')
        .replace(/\(administrador\)/gi, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const isUnassigned = isContactUnassigned({ responsable: newResponsable });
    const targetClean = cleanStr(newResponsable);
    const matchedUser = users.find(
      (u) =>
        u.uid === newResponsable ||
        (u.email && u.email.toLowerCase() === newResponsable.toLowerCase()) ||
        cleanStr(u.nombre) === targetClean
    );

    const extraFields: Partial<Contacto> = isUnassigned
      ? {
          responsableId: undefined,
          fechaAsignacion: undefined,
          asignadoPor: undefined,
        }
      : {
          responsableId: matchedUser?.uid || undefined,
          fechaAsignacion: now,
          asignadoPor: userProfile?.nombre || userProfile?.email || 'Admin',
        };

    try {
      const batch = writeBatch(db);
      contactIds.forEach((id) => {
        const ref = doc(db, 'contactos', id);
        const updatePayload: Record<string, any> = {
          responsable: newResponsable,
          actualizadoEn: now,
        };
        if (extraFields.responsableId) updatePayload.responsableId = extraFields.responsableId;
        if (extraFields.fechaAsignacion) updatePayload.fechaAsignacion = extraFields.fechaAsignacion;
        if (extraFields.asignadoPor) updatePayload.asignadoPor = extraFields.asignadoPor;
        batch.update(ref, updatePayload);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Error reasignando contactos en Firestore:', e);
    }

    setAllContacts((prev) =>
      prev.map((c) =>
        contactIds.includes(c.id)
          ? {
              ...c,
              responsable: newResponsable,
              ...extraFields,
              actualizadoEn: now,
            }
          : c
      )
    );
  };

  const bulkUpdateFollowUpDate = async (contactIds: string[], dateString: string) => {
    if (!contactIds || contactIds.length === 0) return;
    const now = new Date().toISOString();

    try {
      // Guardar en Firestore en lotes de hasta 80 para máxima seguridad
      for (let i = 0; i < contactIds.length; i += 80) {
        const chunk = contactIds.slice(i, i + 80);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          const ref = doc(db, 'contactos', id);
          batch.update(ref, {
            proximoSeguimiento: dateString,
            actualizadoEn: now,
          });
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Error actualizando fecha de llamada masiva en Firestore:', e);
    }

    setAllContacts((prev) =>
      prev.map((c) =>
        contactIds.includes(c.id)
          ? {
              ...c,
              proximoSeguimiento: dateString,
              actualizadoEn: now,
            }
          : c
      )
    );
  };

  const claimContact = async (id: string) => {
    if (!userProfile) return;
    const now = new Date().toISOString();
    await updateContact(id, {
      responsable: userProfile.nombre || userProfile.email,
      responsableId: userProfile.uid,
      fechaAsignacion: now,
      asignadoPor: `Auto-asignado por ${userProfile.nombre || userProfile.email}`,
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

    // Mapa de contactos existentes por teléfono y nombre para prevenir duplicaciones
    const phoneMap = new Map<string, Contacto>();
    const nameMap = new Map<string, Contacto>();
    allContacts.forEach((c) => {
      const p = String(c.telefono || '').replace(/\D/g, '');
      if (p.length >= 7) phoneMap.set(p, c);
      const n = String(c.nombre || '').trim().toLowerCase();
      if (n) nameMap.set(n, c);
    });

    const chunkSize = 40;
    try {
      for (let i = 0; i < newContacts.length; i += chunkSize) {
        const chunk = newContacts.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const itemPhone = String(item.telefono || '').replace(/\D/g, '');
          const itemName = String(item.nombre || '').trim().toLowerCase();
          const existing = (itemPhone.length >= 7 ? phoneMap.get(itemPhone) : null) || (itemName ? nameMap.get(itemName) : null);

          // Si el contacto ya existe, reutilizamos su doc ref y preservamos asignación y notas
          const ref = existing?.id ? doc(db, 'contactos', existing.id) : doc(collection(db, 'contactos'));

          const cleanItem: Record<string, any> = {
            nombre: (item.nombre && String(item.nombre).trim()) || existing?.nombre || 'Sin Nombre',
            telefono: (item.telefono && String(item.telefono).trim()) || existing?.telefono || '',
            tipoCliente: (item.tipoCliente && String(item.tipoCliente).trim()) || existing?.tipoCliente || 'Nunca Contactado',
            etapa: existing?.etapa || (item.etapa && String(item.etapa).trim()) || 'A1 — Base de Datos',
            rolCargo: (item.rolCargo && String(item.rolCargo).trim()) || existing?.rolCargo || 'Installer',
            vecesQueCompro: (item.vecesQueCompro && String(item.vecesQueCompro).trim()) || existing?.vecesQueCompro || ((item.tipoCliente || existing?.tipoCliente) === 'Nunca Contactado' ? 'Nunca ha comprado' : '1 Compra'),
            estadoContacto: existing?.estadoContacto || (item.estadoContacto && String(item.estadoContacto).trim()) || 'Pendiente',
            // Preservar vendedor asignado existente si ya tenía uno
            responsable: (existing?.responsable && existing.responsable !== 'sin asignar')
              ? existing.responsable
              : ((item.responsable && String(item.responsable).trim()) || 'sin asignar'),
            notas: existing?.notas && existing.notas.length > 0
              ? existing.notas
              : (Array.isArray(item.notas)
                ? item.notas.filter(Boolean).map(String)
                : (item.notas ? [String(item.notas)] : [])),
            creadoEn: existing?.creadoEn || now,
            actualizadoEn: now,
          };

          if (item.personaEncargada && typeof item.personaEncargada === 'string' && item.personaEncargada.trim()) {
            cleanItem.personaEncargada = item.personaEncargada.trim();
          } else if (existing?.personaEncargada) {
            cleanItem.personaEncargada = existing.personaEncargada;
          }

          if (item.correo && typeof item.correo === 'string' && item.correo.trim()) {
            cleanItem.correo = item.correo.trim();
          } else if (existing?.correo) {
            cleanItem.correo = existing.correo;
          }
          if (item.direccion && typeof item.direccion === 'string' && item.direccion.trim()) {
            cleanItem.direccion = item.direccion.trim();
          } else if (existing?.direccion) {
            cleanItem.direccion = existing.direccion;
          }
          if (item.ultimaCompra && typeof item.ultimaCompra === 'string' && item.ultimaCompra.trim()) {
            cleanItem.ultimaCompra = item.ultimaCompra.trim();
          } else if (existing?.ultimaCompra) {
            cleanItem.ultimaCompra = existing.ultimaCompra;
          }
          if (item.fechaUltimoContacto && typeof item.fechaUltimoContacto === 'string' && item.fechaUltimoContacto.trim()) {
            cleanItem.fechaUltimoContacto = item.fechaUltimoContacto.trim();
          } else if (existing?.fechaUltimoContacto) {
            cleanItem.fechaUltimoContacto = existing.fechaUltimoContacto;
          }
          if (item.proximoSeguimiento && typeof item.proximoSeguimiento === 'string' && item.proximoSeguimiento.trim()) {
            cleanItem.proximoSeguimiento = item.proximoSeguimiento.trim();
          } else if (existing?.proximoSeguimiento) {
            cleanItem.proximoSeguimiento = existing.proximoSeguimiento;
          }

          batch.set(ref, cleanItem, { merge: true });
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
        myAssignedContacts,
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
        bulkUpdateFollowUpDate,
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
