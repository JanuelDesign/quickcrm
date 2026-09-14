import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Shield,
  Briefcase,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/crm';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, simulateRole } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<UserRole>('vendedor');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Ventana de autenticación cerrada.');
      } else {
        setErrorMsg(err.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!nombre.trim()) {
          setErrorMsg('Por favor introduce tu nombre completo.');
          setLoading(false);
          return;
        }
        await registerWithEmail(email.trim(), password, nombre.trim(), rol);
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Credenciales inválidas. Comprueba tu correo y contraseña o usa el acceso demo rápido.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Este correo ya está registrado. Prueba iniciando sesión.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setErrorMsg(err.message || 'Error al autenticar. Puedes usar el acceso rápido demo abajo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-baseline mb-2">
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Quick
          </span>
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-[#FF8407]">
            CRM
          </span>
          <span className="ml-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
            Quicksurfaces Miami
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Pisos Vinil SPC, Tile, Wall Panels & Steps en Miami-Dade
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Main Auth Card */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-slate-200/90 sm:px-10 space-y-6">
          <div className="flex border-b border-slate-100 pb-3 justify-around text-sm font-bold">
            <button
              onClick={() => {
                setIsRegister(false);
                setErrorMsg(null);
              }}
              className={`pb-2 border-b-2 transition ${
                !isRegister
                  ? 'border-[#FF8407] text-[#FF8407]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setIsRegister(true);
                setErrorMsg(null);
              }}
              className={`pb-2 border-b-2 transition ${
                isRegister
                  ? 'border-[#FF8407] text-[#FF8407]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Registrar Cuenta
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Direct Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition active:scale-98"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar con Google</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">O con correo</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Mendoza"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="vendedor@quicksurfaces.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#FF8407] focus:bg-white"
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rol Inicial</label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF8407]"
                >
                  <option value="vendedor">💼 Vendedor (Gestión personal de clientes)</option>
                  <option value="admin">👑 Administrador (Acceso total y CSV)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#FF8407] hover:bg-[#E57300] disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition active:scale-98"
            >
              <span>{loading ? 'Procesando...' : isRegister ? 'Crear Cuenta' : 'Entrar al CRM'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Instant Demo Access (Seamless test in AI Studio preview) */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Acceso Rápido de Demostración
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  simulateRole('admin', {
                    nombre: 'Esteban Gavotti (Admin)',
                    email: 'esteban.gavotti@quicksurfaces.com',
                  })
                }
                className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 text-left transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>Esteban Gavotti (Admin)</span>
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  esteban.gavotti@quicksurfaces.com • Acceso total
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  simulateRole('vendedor', {
                    nombre: 'Ruben Valverde (Vendedor)',
                    email: 'ruben.valverde@quicksurfaces.com',
                  })
                }
                className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/70 hover:bg-orange-100/80 text-left transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#FF8407]">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Ruben Valverde (Vendedor)</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  ruben.valverde@quicksurfaces.com • Cartera personal
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
