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
  const [validatedSession, setValidatedSession] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInvalidCodeModal, setShowInvalidCodeModal] = useState(false);
  const [showRoomFullModal, setShowRoomFullModal] = useState(false);
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

  const validateCodeAndGetSession = async () => {
    const normalizedCode = joinCode.trim().toUpperCase();

    if (!normalizedCode) {
      setError('Por favor ingresa el código del quiz');
      return null;
    }

    // 1. Buscar el formulario por join_code
    const { data: formData, error: formError } = await supabase
      .from('forms')
      .select('id')
      .eq('join_code', normalizedCode)
      .single();

    if (formError || !formData) {
      setShowInvalidCodeModal(true);
      return null;
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
      return null;
    }

    if (sessionData.status !== 'waiting') {
      if (sessionData.status === 'in_progress') {
        setError('El quiz ya ha comenzado. No puedes unirte ahora.');
      } else if (sessionData.status === 'finished') {
        setError('El quiz ya ha finalizado');
      }
      return null;
    }

    const { count: participantsCount, error: countError } = await supabase
      .from('quiz_participants')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_session_id', sessionData.id)
      .neq('status', 'finished');

    if (countError) {
      setError('No se pudo validar el cupo de participantes. Intenta nuevamente.');
      return null;
    }

    if (Number(participantsCount || 0) >= 10) {
      setError('La sala alcanzo el limite de 10 participantes.');
      setShowRoomFullModal(true);
      return null;
    }

    return sessionData;
  };

  const handleValidateCode = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const sessionData = await validateCodeAndGetSession();
      if (!sessionData) return;
      setValidatedSession(sessionData);
    } catch (err) {
      setError('Error inesperado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinQuiz = async (e) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Debes iniciar sesión para unirte al quiz.');
      setIsLoginModalOpen(true);
      return;
    }

    if (!validatedSession) {
      setError('Primero valida el código del quiz.');
      return;
    }

    if (!participantName.trim()) {
      setError('Por favor ingresa tu nombre para unirte');
      return;
    }

    setLoading(true);

    try {
      // Revalidar cupo y estado justo antes de unirse
      const latestSession = await validateCodeAndGetSession();
      if (!latestSession || latestSession.id !== validatedSession.id) {
        setValidatedSession(null);
        return;
      }

      // 3. Unirse a la sesión
      const { data: participantData, error: joinError } = await supabase
        .rpc('join_quiz_session', {
          p_session_id: latestSession.id,
          p_email: null,
          p_name: participantName.trim(),
        });

      if (joinError) {
        const message = String(joinError.message || '');
        if (message.toLowerCase().includes('participant limit')) {
          setError('La sala alcanzo el limite de 10 participantes.');
          setShowRoomFullModal(true);
        } else {
          setError('Error al unirse al quiz: ' + joinError.message);
        }
        setLoading(false);
        return;
      }

      // 4. Navegar a la sala de espera con los datos de la sesión
      navigate('/quiz/waiting-room', {
        state: {
          sessionId: latestSession.id,
          participantId: participantData,
          formId: latestSession.form_id,
        },
      });
    } catch (err) {
      setError('Error inesperado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] relative flex flex-col items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(circle 500px at 50% 100px, rgba(139,92,246,0.4), transparent)',
        }}
      />

      <header className="absolute w-full top-0 left-0 right-0 z-20 border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className=" mx-auto px-4 md:px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-white font-bold tracking-wide text-lg">
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
              <div className="flex items-center gap-2">
                <span className="max-w-40 truncate text-sm font-medium text-white/85">{displayName || 'Usuario'}</span>
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
              </div>

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

      <div className="relative flex-1 flex flex-col items-center justify-center z-10 w-full max-w-xl rounded-2xl">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative z-10">
          {/* Encabezado */}
          <div className="text-center mb-8">
            <h1 className="text-6xl font-black text-white mb-2 tracking-wide">QUIZZIA</h1>
          </div>
          {/* Formulario */}
          <form onSubmit={validatedSession ? handleJoinQuiz : handleValidateCode} className=" w-full space-y-4">
            {/* Código del Quiz */}
            {!validatedSession ? (
              <div>
                <div className="flex w-full items-center gap-2 rounded-xl border-2 border-violet-300/30 bg-[#030712]/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_rgba(139,92,246,0.12)] focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-400/20">
                  <input
                    id="joinCode"
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      if (validatedSession) setValidatedSession(null);
                    }}
                    placeholder="Introducir un código de participación"
                    className="min-w-0 flex-1 bg-transparent px-3 w-72 py-3 text-violet-100 text-lg font-bold placeholder:text-slate-500 focus:outline-none"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className={`shrink-0 rounded-lg px-5 py-1 font-black text-white transition-all ${loading
                      ? 'bg-slate-600 cursor-not-allowed'
                      : 'bg-linear-to-r from-primary-500 to-primary-500 hover:from-primary-400 hover:to-primary-400 active:scale-95 cursor-pointer  shadow-lg shadow-primary-900/35'
                      }`}
                  >
                    {loading ? 'Validando...' : 'Unirme'}
                  </button>
                </div>
                <p className="text-xs text-center text-slate-400 mt-1">
                  Pide el código al instructor
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-300/25 rounded-xl p-3">
                  <p className="text-sm text-emerald-200">Código validado: <strong>{joinCode.trim().toUpperCase()}</strong></p>
                </div>
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
                <button
                  type="button"
                  onClick={() => setValidatedSession(null)}
                  className="w-full py-2 rounded-xl border border-white/20 text-slate-200 hover:text-white hover:border-white/40 transition cursor-pointer"
                  disabled={loading}
                >
                  Cambiar código
                </button>
              </div>
            )}
            
            {/* Mensaje de usuario autenticado */}
            {/* {user && (
              <div className="bg-violet-500/10 border border-violet-300/20 rounded-xl p-3">
                <p className="text-sm text-violet-100">
                  ✓ Conectado como <strong>{user.email}</strong>
                </p>
              </div>
            )} */}

            {/* Mensajes de error */}
            {error && (
              <div className="bg-red-500/10 border border-red-300/25 rounded-xl p-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Botón de envío */}
            {validatedSession ? (
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-black text-white transition-all ${loading
                    ? 'bg-slate-600 cursor-not-allowed'
                    : 'bg-linear-to-r from-primary-400 to-primary-600 hover:from-primary-500 cursor-pointer hover:to-primary-500 active:scale-95 shadow-lg shadow-violet-900/50 border border-violet-300/20'
                  }`}
              >
                {loading ? 'Uniéndote...' : (user ? 'Unirse al Quiz' : 'Inicia sesión para unirte')}
              </button>
            ) : null}
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

      {showRoomFullModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-amber-300/25 bg-[#070b14] shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_30px_rgba(245,158,11,0.15)] overflow-hidden">
            <div className="px-6 py-5 bg-linear-to-r from-amber-500/20 to-yellow-500/10 border-b border-white/10 text-center">
              <h3 className="text-xl font-black text-white tracking-wide">Sala llena</h3>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-sm text-slate-300">Ya no se puede unir más gente a este quiz. El límite es de 10 participantes.</p>
              <button
                onClick={() => setShowRoomFullModal(false)}
                className="mt-5 w-full py-3 rounded-xl cursor-pointer bg-linear-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold transition border border-amber-200/20"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
        <p className='text-white'>Crea tu propio quiz GRATIS en <span className='font-bold underline'>quizzia.com</span></p>

      <LoginForm open={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
