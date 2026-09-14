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
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Contacto, UsuarioCRM, NotaHistorial, AdjuntoNota } from '../types/crm';
import { REAL_CSV_CONTACTS, OLD_TEST_NAMES } from '../data/realContacts';
import { useAuth } from './AuthContext';

interface CrmContextType {
  contacts: Contacto[]; // filtered for current user role
  allContacts: Contacto[]; // full list (for admin dashboard / reassignments)
  users: UsuarioCRM[];
  loadingContacts: boolean;
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
  resetToSampleData: () => Promise<void>;
  syncRealContactsToFirestore: () => Promise<number>;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

const INITIAL_USERS: UsuarioCRM[] = [
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
    uid: 'januel_admin_uid',
    email: 'janueldesign@gmail.com',
    nombre: 'Januel (Admin Quicksurfaces)',
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
  const { currentUser, userProfile, isAdmin } = useAuth();
  // Inicializa directamente con los 193 contactos reales procesados del archivo CSV
  const [allContacts, setAllContacts] = useState<Contacto[]>(() => REAL_CSV_CONTACTS);
  const [users, setUsers] = useState<UsuarioCRM[]>(INITIAL_USERS);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Firestore Real-time listener for Contacts
  useEffect(() => {
    setLoadingContacts(true);
    const contactsCol = collection(db, 'contactos');

    const unsubscribe = onSnapshot(
      contactsCol,
      async (snapshot) => {
        if (snapshot.empty) {
          // Auto-seed real contacts if database is empty
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
            notas: data.notas || [],
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
      },
      (error) => {
        console.warn('onSnapshot error on contactos, usando datos locales reales:', error);
        setLoadingContacts(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Firestore Real-time listener for Users
  useEffect(() => {
    const usersCol = collection(db, 'usuarios');
    const unsubscribe = onSnapshot(
      usersCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedUsers: UsuarioCRM[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Partial<UsuarioCRM>;
            return {
              uid: docSnap.id,
              email: data.email || '',
              nombre: data.nombre || 'Usuario',
              rol: data.rol || 'vendedor',
              activo: data.activo !== false,
              creadoEn: data.creadoEn || new Date().toISOString(),
              telefono: data.telefono,
            };
          });

          // Merge with initial system users to avoid duplicates
          const userMap = new Map<string, UsuarioCRM>();
          INITIAL_USERS.forEach((u) => userMap.set(u.uid, u));
          loadedUsers.forEach((u) => userMap.set(u.uid, u));
          setUsers(Array.from(userMap.values()));
        }
      },
      (error) => {
        console.warn('onSnapshot users warning:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const seedInitialData = async () => {
    try {
      const snap = await getDocs(collection(db, 'contactos'));
      if (snap.empty) {
        await batchImportContacts(REAL_CSV_CONTACTS);
      }
    } catch (e) {
      console.warn('Auto-seed fallback to memory:', e);
      setAllContacts(REAL_CSV_CONTACTS);
      setLoadingContacts(false);
    }
  };

  const resetToSampleData = async () => {
    try {
      const snap = await getDocs(collection(db, 'contactos'));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await batchImportContacts(REAL_CSV_CONTACTS);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'contactos');
    }
  };

  const syncRealContactsToFirestore = async (): Promise<number> => {
    return await batchImportContacts(REAL_CSV_CONTACTS);
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

  const addContact = async (contact: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<string> => {
    const now = new Date().toISOString();
    const payload = {
      ...contact,
      creadoEn: now,
      actualizadoEn: now,
    };
    if (currentUser) {
      try {
        const docRef = await addDoc(collection(db, 'contactos'), payload);
        return docRef.id;
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'contactos');
      }
    } else {
      const newId = `c_local_${Date.now()}`;
      setAllContacts((prev) => [{ ...payload, id: newId }, ...prev]);
      return newId;
    }
  };

  const updateContact = async (id: string, updates: Partial<Contacto>) => {
    const now = new Date().toISOString();
    if (currentUser) {
      try {
        const docRef = doc(db, 'contactos', id);
        await updateDoc(docRef, {
          ...updates,
          actualizadoEn: now,
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `contactos/${id}`);
      }
    } else {
      setAllContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates, actualizadoEn: now } : c))
      );
    }
  };

  const updateContactStage = async (id: string, newStage: string) => {
    await updateContact(id, { etapa: newStage });
  };

  const deleteContact = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Solo los administradores pueden eliminar contactos.');
    }
    if (currentUser) {
      try {
        const docRef = doc(db, 'contactos', id);
        await deleteDoc(docRef);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `contactos/${id}`);
      }
    } else {
      setAllContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const reassignContacts = async (contactIds: string[], newResponsable: string) => {
    const now = new Date().toISOString();
    if (currentUser) {
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
        handleFirestoreError(e, OperationType.UPDATE, 'contactos');
      }
    } else {
      setAllContacts((prev) =>
        prev.map((c) =>
          contactIds.includes(c.id) ? { ...c, responsable: newResponsable, actualizadoEn: now } : c
        )
      );
    }
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
    await updateContact(id, {
      fechaUltimoContacto: new Date().toISOString(),
    });
  };

  const batchImportContacts = async (
    newContacts: Omit<Contacto, 'id' | 'creadoEn' | 'actualizadoEn'>[]
  ): Promise<number> => {
    const now = new Date().toISOString();
    let count = 0;

    const chunkSize = 200;
    try {
      for (let i = 0; i < newContacts.length; i += chunkSize) {
        const chunk = newContacts.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const ref = doc(collection(db, 'contactos'));
          const cleanItem: Record<string, any> = {
            nombre: item.nombre || 'Sin Nombre',
            telefono: item.telefono || '',
            tipoCliente: item.tipoCliente || 'Nunca Contactado',
            etapa: item.etapa || 'A1 — Base de Datos',
            rolCargo: item.rolCargo || 'Installer',
            vecesQueCompro: item.vecesQueCompro || '1 Compra',
            estadoContacto: item.estadoContacto || 'Pendiente',
            responsable: item.responsable || 'sin asignar',
            notas: item.notas || [],
            creadoEn: now,
            actualizadoEn: now,
          };
          if (item.correo) cleanItem.correo = item.correo;
          if (item.direccion) cleanItem.direccion = item.direccion;
          if (item.ultimaCompra) cleanItem.ultimaCompra = item.ultimaCompra;
          if (item.fechaUltimoContacto) cleanItem.fechaUltimoContacto = item.fechaUltimoContacto;
          if (item.proximoSeguimiento) cleanItem.proximoSeguimiento = item.proximoSeguimiento;

          batch.set(ref, cleanItem);
          count++;
        });

        await batch.commit();
      }
      return count;
    } catch (e) {
      console.warn('batchImportContacts falló en Firestore, guardando en memoria:', e);
      const mapped: Contacto[] = newContacts.map((item, idx) => ({
        ...item,
        id: `csv_imp_${Date.now()}_${idx}`,
        creadoEn: now,
        actualizadoEn: now,
      }));
      setAllContacts((prev) => [...mapped, ...prev]);
      return mapped.length;
    }
  };

  const reassignAllVendorContacts = async (fromResponsable: string, toResponsable: string): Promise<number> => {
    if (!isAdmin) throw new Error('Acción exclusiva para administradores');

    const toReassign = allContacts.filter((c) => c.responsable === fromResponsable);
    if (toReassign.length === 0) return 0;
    const now = new Date().toISOString();

    if (currentUser) {
      const batch = writeBatch(db);
      toReassign.forEach((c) => {
        const ref = doc(db, 'contactos', c.id);
        batch.update(ref, {
          responsable: toResponsable,
          actualizadoEn: now,
        });
      });

      try {
        await batch.commit();
        return toReassign.length;
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, 'contactos');
      }
    } else {
      setAllContacts((prev) =>
        prev.map((c) =>
          c.responsable === fromResponsable ? { ...c, responsable: toResponsable, actualizadoEn: now } : c
        )
      );
      return toReassign.length;
    }
  };

  const addUser = async (newUser: Omit<UsuarioCRM, 'creadoEn'>) => {
    const userWithDate: UsuarioCRM = {
      ...newUser,
      creadoEn: new Date().toISOString(),
    };
    if (currentUser) {
      try {
        const ref = doc(db, 'usuarios', newUser.uid);
        await setDoc(ref, userWithDate, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `usuarios/${newUser.uid}`);
      }
    } else {
      setUsers((prev) => [...prev, userWithDate]);
    }
  };

  const toggleUserActive = async (uid: string, active: boolean) => {
    if (currentUser) {
      try {
        const ref = doc(db, 'usuarios', uid);
        await updateDoc(ref, {
          activo: active,
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `usuarios/${uid}`);
      }
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, activo: active } : u))
      );
    }
  };

  return (
    <CrmContext.Provider
      value={{
        contacts: visibleContacts,
        allContacts,
        users,
        loadingContacts,
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
