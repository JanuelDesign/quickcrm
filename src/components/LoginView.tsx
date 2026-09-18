import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { loginWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/configuration-not-found') {
        setErrorMsg('Authentication no está activado aún en tu Firebase Console. Ve a console.firebase.google.com > quicksurfaces-crm > Compilación > Authentication, presiona el botón azul "Comenzar" (Get Started) y en la pestaña "Método de acceso" activa "Correo electrónico/contraseña".');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Debes habilitar "Correo/contraseña" en Firebase Console > Authentication > Sign-in method (Método de acceso).');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Credenciales inválidas. Comprueba tu correo y contraseña.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMsg('Demasiados intentos fallidos. Por favor espera unos momentos.');
      } else {
        setErrorMsg(err.message || 'Error al autenticar. Verifica tu conexión.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#0B0F19] via-[#0F172A] to-[#020617] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Subtle brand glow behind the card */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-[#FF8407]/10 blur-[130px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/3 top-1/4 w-[360px] h-[360px] rounded-full bg-blue-600/5 blur-[120px]"
        aria-hidden="true"
      />

      {/* Brand Header */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-baseline mb-2">
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Quick
          </span>
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-[#FF8407]">
            CRM
          </span>
        </div>
        <p className="text-sm text-slate-400 font-medium">
          Flooring, Tile & Wall Panels — Miami-Dade
        </p>
      </div>

      <div className="relative z-10 mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Main Auth Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl border border-slate-800/90 sm:px-10 space-y-6">
          <div className="border-b border-slate-800 pb-3 text-center">
            <h2 className="text-base font-extrabold text-white tracking-wide">
              Iniciar Sesión
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Acceso para equipo comercial y administración
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="vendedor@quicksurfaces.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF8407] focus:ring-1 focus:ring-[#FF8407] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF8407] focus:ring-1 focus:ring-[#FF8407] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#FF8407] hover:bg-[#E57300] disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-orange-950/30 transition active:scale-98 cursor-pointer"
            >
              <span>{loading ? 'Iniciando sesión...' : 'Entrar al CRM'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 text-center text-[11px] text-slate-500">
            ¿No tienes cuenta? Solicítala a la administración en Quicksurfaces.
          </div>
        </div>
      </div>
    </div>
  );
};
