import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UsuarioCRM, UserRole } from '../types/crm';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UsuarioCRM | null;
  loading: boolean;
  isAdmin: boolean;
  isVendedor: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, nombre: string, rol?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  simulateRole: (role: UserRole, demoUser?: { nombre: string; email: string }) => void;
  isSimulated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hardcoded admin emails or runtime email
const ADMIN_EMAILS = [
  'janueldesign@gmail.com',
  'admin@quicksurfaces.com',
  'director@quicksurfaces.com',
  'esteban.gavotti@quicksurfaces.com',
  'esteban@quicksurfaces.com',
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UsuarioCRM | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulatedProfile, setSimulatedProfile] = useState<UsuarioCRM | null>(null);

  // Listen to Auth State
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        try {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const emailLower = (user.email || '').toLowerCase();
          const shouldBeAdmin = ADMIN_EMAILS.includes(emailLower);

          // Real-time listener for the logged-in user profile doc in Firestore
          unsubscribeProfile = onSnapshot(userDocRef, async (snap) => {
            if (snap.exists()) {
              const data = snap.data() as Partial<UsuarioCRM>;
              setUserProfile({
                uid: user.uid,
                email: user.email || '',
                nombre: data.nombre || user.displayName || user.email?.split('@')[0] || 'Usuario',
                rol: (data.rol as UserRole) || (shouldBeAdmin ? 'admin' : 'vendedor'),
                activo: data.activo !== false,
                creadoEn: data.creadoEn || new Date().toISOString(),
                telefono: data.telefono,
              });
            } else {
              // Create user document in Firestore so it exists in Firebase Console
              const newProfile: UsuarioCRM = {
                uid: user.uid,
                email: user.email || '',
                nombre: user.displayName || user.email?.split('@')[0] || 'Usuario Quicksurfaces',
                rol: shouldBeAdmin ? 'admin' : 'vendedor',
                activo: true,
                creadoEn: new Date().toISOString(),
              };
              await setDoc(userDocRef, newProfile);
              setUserProfile(newProfile);
            }
          });
        } catch (err) {
          console.warn('Could not subscribe to user profile in Firestore:', err);
          const emailLower = (user.email || '').toLowerCase();
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
            rol: ADMIN_EMAILS.includes(emailLower) ? 'admin' : 'vendedor',
            activo: true,
            creadoEn: new Date().toISOString(),
          });
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  // Real-time listener when a simulated/direct-access user profile is active
  useEffect(() => {
    if (!simulatedProfile?.uid) return;

    const userDocRef = doc(db, 'usuarios', simulatedProfile.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<UsuarioCRM>;
        setSimulatedProfile((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            rol: (data.rol as UserRole) || prev.rol,
            activo: data.activo !== undefined ? data.activo : prev.activo,
            nombre: data.nombre || prev.nombre,
          };
        });
      }
    });

    return () => unsubscribe();
  }, [simulatedProfile?.uid]);

  const loginWithGoogle = async () => {
    setSimulatedProfile(null);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setSimulatedProfile(null);
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, nombre: string, _rol: UserRole = 'vendedor') => {
    setSimulatedProfile(null);
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    const emailLower = email.toLowerCase();
    const resolvedRole: UserRole = ADMIN_EMAILS.includes(emailLower) ? 'admin' : 'vendedor';

    const newProfile: UsuarioCRM = {
      uid: user.uid,
      email: user.email || email,
      nombre,
      rol: resolvedRole,
      activo: true,
      creadoEn: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'usuarios', user.uid), newProfile);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `usuarios/${user.uid}`);
    }
    setUserProfile(newProfile);
  };

  const logout = async () => {
    setSimulatedProfile(null);
    await signOut(auth);
  };

  // Switch or direct access for testing
  const simulateRole = async (role: UserRole, demoUser?: { nombre: string; email: string }) => {
    const uid = role === 'admin' ? 'januel_admin_uid' : 'vendedor_ruben_id';
    const email =
      demoUser?.email ||
      (role === 'admin' ? 'janueldesign@gmail.com' : 'ruben.valverde@quicksurfaces.com');
    const nombre =
      demoUser?.nombre ||
      (role === 'admin' ? 'Januel (Admin)' : 'Ruben Valverde (Vendedor)');

    const demo: UsuarioCRM = {
      uid,
      email,
      nombre,
      rol: role,
      activo: true,
      creadoEn: new Date().toISOString(),
    };

    setSimulatedProfile(demo);

    // Ensure this profile exists in Firestore collection "usuarios"
    try {
      await setDoc(doc(db, 'usuarios', uid), demo, { merge: true });
    } catch (err) {
      console.warn('Simulated profile written locally; Firestore error:', err);
    }
  };

  const activeProfile = simulatedProfile || userProfile;
  const isAdmin = activeProfile?.rol === 'admin';
  const isVendedor = !isAdmin;

  return (
    <AuthContext.Provider
      value={{
        currentUser: simulatedProfile ? null : currentUser,
        userProfile: activeProfile,
        loading,
        isAdmin,
        isVendedor,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        simulateRole,
        isSimulated: !!simulatedProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
