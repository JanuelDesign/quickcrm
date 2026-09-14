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
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userDoc = await getDoc(userDocRef);

          const emailLower = (user.email || '').toLowerCase();
          const shouldBeAdmin = ADMIN_EMAILS.includes(emailLower);

          if (userDoc.exists()) {
            const data = userDoc.data() as Partial<UsuarioCRM>;
            setUserProfile({
              uid: user.uid,
              email: user.email || '',
              nombre: data.nombre || user.displayName || user.email?.split('@')[0] || 'Usuario',
              rol: shouldBeAdmin ? 'admin' : (data.rol || 'vendedor'),
              activo: data.activo !== false,
              creadoEn: data.creadoEn || new Date().toISOString(),
            });
          } else {
            // Create user document in Firestore
            const newProfile: UsuarioCRM = {
              uid: user.uid,
              email: user.email || '',
              nombre: user.displayName || user.email?.split('@')[0] || 'Vendedor Quicksurfaces',
              rol: shouldBeAdmin ? 'admin' : 'vendedor',
              activo: true,
              creadoEn: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.warn('Could not read/write user profile doc:', err);
          // Fallback in-memory profile
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

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setSimulatedProfile(null);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setSimulatedProfile(null);
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, nombre: string, rol: UserRole = 'vendedor') => {
    setSimulatedProfile(null);
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    const emailLower = email.toLowerCase();
    const resolvedRole: UserRole = ADMIN_EMAILS.includes(emailLower) ? 'admin' : rol;

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

  // Allows switching for demo / QA testing between Vendedor and Admin roles
  const simulateRole = (role: UserRole, demoUser?: { nombre: string; email: string }) => {
    const demo: UsuarioCRM = {
      uid: role === 'admin' ? 'admin_esteban_id' : 'vendedor_ruben_id',
      email:
        demoUser?.email ||
        (role === 'admin' ? 'esteban.gavotti@quicksurfaces.com' : 'ruben.valverde@quicksurfaces.com'),
      nombre:
        demoUser?.nombre ||
        (role === 'admin' ? 'Esteban Gavotti (Admin)' : 'Ruben Valverde (Vendedor)'),
      rol: role,
      activo: true,
      creadoEn: new Date().toISOString(),
    };
    setSimulatedProfile(demo);
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
