import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';
import { useProfile } from '../hooks/useProfile';
import LoginForm from '../components/auth/LoginForm';

export default function JoinQuizPage() {
  const [joinCode, setJoinCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInvalidCodeModal, setShowInvalidCodeModal] = useState(false);
  const { session } = useSession();
  const user = session?.user || null;
  const { profile } = useProfile(user?.id || null);
  const navigate = useNavigate();

  const displayName = profile?.name?.trim() || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : '';

  useEffect(() => {
    if (!user) return;
    const resolvedName =
      profile?.name?.trim() ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      '';
    setParticipantName(resolvedName);
  }, [user, profile]);

  const handleJoinQuiz = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validar que el usuario ingresó un código
      if (!joinCode.trim()) {
        setError('Por favor ingresa el código del quiz');
        setLoading(false);
        return;
      }

      if (!participantName.trim()) {
        setError('Por favor ingresa tu nombre para unirte');
        setLoading(false);
        return;
      }

      // 1. Buscar el formulario por join_code
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('id')
        .eq('join_code', joinCode)
        .single();

      if (formError || !formData) {
        setShowInvalidCodeModal(true);
        setLoading(false);
        return;
      }

      // 2. Buscar la sesión más reciente en estado 'waiting'
      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('form_id', formData.id)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError || !sessionData) {
        setError('No hay una sesión de quiz activa con ese código. Pídele al instructor que inicie una.');
        setLoading(false);
        return;
      }

      // Verificar que la sesión esté en estado 'waiting'
      if (sessionData.status !== 'waiting') {
        if (sessionData.status === 'in_progress') {
          setError('El quiz ya ha comenzado. No puedes unirte ahora.');
        } else if (sessionData.status === 'finished') {
          setError('El quiz ya ha finalizado');
        }
        setLoading(false);
        return;
      }

      // 2. Unirse a la sesión
      const { data: participantData, error: joinError } = await supabase
        .rpc('join_quiz_session', {
          p_session_id: sessionData.id,
          p_email: null,
          p_name: participantName.trim(),
        });

      if (joinError) {
        setError('Error al unirse al quiz: ' + joinError.message);
        setLoading(false);
        return;
      }

      // 3. Navegar a la sala de espera con los datos de la sesión
      navigate('/quiz/waiting-room', {
        state: {
          sessionId: sessionData.id,
          participantId: participantData,
          formId: sessionData.form_id,
        },
      });
    } catch (err) {
      setError('Error inesperado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] relative flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(circle 500px at 50% 100px, rgba(139,92,246,0.4), transparent)',
        }}
      />

      <header className="absolute w-full top-0 left-0 right-0 z-20 border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className=" mx-auto px-4 md:px-6 py-5 flex items-center justify-between">
          <Link to={user ? '/main' : '/'} className="text-white font-bold tracking-wide text-lg">
            QUIZZIA
          </Link>

          {!user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 text-sm text-white/90 hover:text-white border border-white/20 hover:border-white/40 rounded-full transition cursor-pointer"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLoginModalOpen(true);
                  setTimeout(() => {
                    const evt = new CustomEvent('open-register');
                    window.dispatchEvent(evt);
                  }, 0);
                }}
                className="px-4 py-2 text-sm bg-white text-black rounded-full font-semibold hover:bg-gray-200 transition cursor-pointer"
              >
                Crear cuenta
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shadow-md transition ${avatarInitial
                    ? 'bg-primary-600 hover:ring-2 hover:ring-violet-300/70'
                    : 'bg-linear-to-r from-gray-400 to-gray-500 animate-pulse'
                  }`}
                aria-label="Menú de usuario"
              >
                {avatarInitial}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-72 bg-linear-to-b from-black to-black border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 bg-white/5">
                    <p className="text-white font-semibold truncate">{displayName || 'Usuario'}</p>
                    <p className="text-gray-400 text-xs truncate mt-1">{user.email}</p>
                  </div>
                  <button
                    onClick={async () => {
                      setShowUserMenu(false);
                      const { error: signOutError } = await supabase.auth.signOut();
                      if (signOutError) {
                        setError(signOutError.message || 'No se pudo cerrar sesión');
                        return;
                      }
                      navigate('/home', { replace: true });
                    }}
                    className="w-full text-left px-5 py-3 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-violet-300/20 bg-[#080d1a]/85 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.6),0_0_30px_rgba(124,58,237,0.2)] p-8 mt-20 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative z-10">
          {/* Encabezado */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white mb-2 tracking-wide">Únete al Quiz</h1>
            <p className="text-slate-300">Ingresa el código para empezar a jugar</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleJoinQuiz} className="space-y-4">
            {/* Código del Quiz */}
            <div>
              <label htmlFor="joinCode" className="block text-sm font-semibold text-slate-200 mb-2">
                Código del Quiz
              </label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Ej: ABC123DEF456"
                className="w-full px-4 py-3 border-2 border-violet-300/30 bg-[#030712]/80 text-violet-100 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/20 text-center text-lg font-black tracking-[0.25em] placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_rgba(139,92,246,0.12)]"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 mt-1">
                Pide el código al instructor
              </p>
            </div>

            {/* Nombre del participante */}
            <div>
              <label htmlFor="participantName" className="block text-sm font-semibold text-slate-200 mb-2">
                Tu nombre
              </label>
              <input
                id="participantName"
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full px-4 py-3 border-2 border-cyan-300/25 bg-[#030712]/80 text-cyan-100 rounded-xl focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(34,211,238,0.1)]"
                disabled={loading}
              />
            </div>

            {/* Mensaje de usuario autenticado */}
            {user && (
              <div className="bg-violet-500/10 border border-violet-300/20 rounded-xl p-3">
                <p className="text-sm text-violet-100">
                  ✓ Conectado como <strong>{user.email}</strong>
                </p>
              </div>
            )}

            {/* Mensajes de error */}
            {error && (
              <div className="bg-red-500/10 border border-red-300/25 rounded-xl p-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-black text-white transition-all ${loading
                  ? 'bg-slate-600 cursor-not-allowed'
                  : 'bg-linear-to-r from-primary-400 to-primary-600 hover:from-primary-500 cursor-pointer hover:to-primary-500 active:scale-95 shadow-lg shadow-violet-900/50 border border-violet-300/20'
                }`}
            >
              {loading ? 'Uniéndote...' : 'Unirse al Quiz'}
            </button>
          </form>

          {/* Footer con enlace a home */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate(user ? '/main' : '/')}
              className="text-sm text-slate-300 hover:text-white underline underline-offset-2"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>

      {showInvalidCodeModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-300/25 bg-[#070b14] shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_30px_rgba(239,68,68,0.15)] overflow-hidden">
            <div className="px-6 py-5 bg-linear-to-r from-red-500/20 to-pink-500/10 border-b border-white/10 text-center">
              <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-red-500/15 border border-red-300/30 flex items-center justify-center animate-pulse">
                <span className="text-3xl rotate-90 text-white">:(</span>
              </div>
              <h3 className="text-xl font-black text-white tracking-wide">Código inválido</h3>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-sm text-slate-300">Intenta otra vez.</p>
              <button
                onClick={() => setShowInvalidCodeModal(false)}
                className="mt-5 w-full py-3 rounded-xl cursor-pointer
                 bg-linear-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white font-bold transition border border-red-200/20"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <LoginForm open={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
