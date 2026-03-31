import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function QuizWaitingRoomPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const sessionId = location.state?.sessionId;
  const participantId = location.state?.participantId;
  const formId = location.state?.formId;
  
  const [formData, setFormData] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('waiting');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [countdownText, setCountdownText] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);
  
  const realtimeSubscriptionRef = useRef(null);
  const countdownStartedRef = useRef(false);
  const preloadedQuizDataRef = useRef(null);
  const preloadingQuizRef = useRef(false);

  const goToPlay = () => {
    navigate(`/quiz/play?sessionId=${sessionId}&participantId=${participantId}&formId=${formId}`, {
      replace: true,
      state: {
        sessionId,
        participantId,
        formId,
        preloadedQuizData: preloadedQuizDataRef.current,
      },
    });
  };

  useEffect(() => {
    // Validar que los datos necesarios estén presentes
    if (!sessionId || !participantId || !formId) {
      navigate('/join-quiz');
      return;
    }

    // Cargar datos iniciales
    loadInitialData();

    // Suscribirse a cambios en tiempo real
    subscribeToRealtimeUpdates();

    return () => {
      // Limpiar suscripción al desmontar
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
      }
    };
  }, [sessionId, participantId, formId, navigate]);

  const loadInitialData = async () => {
    try {
      // 1. Cargar datos del formulario
      const { data: formResponse, error: formError } = await supabase
        .from('forms')
        .select('id, title, description')
        .eq('id', formId)
        .single();

      if (formError) throw formError;
      setFormData(formResponse);

      // 2. Cargar estado de sesión
      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSessionStatus(sessionData.status);

      preloadQuizPayload();

      if (sessionData.status === 'in_progress') {
        startCountdownToQuiz();
      }

      const { data: meParticipant, error: meParticipantError } = await supabase
        .from('quiz_participants')
        .select('status')
        .eq('id', participantId)
        .maybeSingle();

      if (meParticipantError) throw meParticipantError;

      if (meParticipant?.status === 'finished') {
        goToPlay();
        return;
      }

      // 3. Cargar participantes
      const { data: participantsData, error: participantsError } = await supabase
        .from('quiz_participants')
        .select('id, user_id, participant_email, participant_name, status, joined_at')
        .eq('quiz_session_id', sessionId)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;
      setParticipants(participantsData || []);

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const subscribeToRealtimeUpdates = () => {
    // Suscribirse a cambios en quiz_sessions
    const sessionChannel = supabase
      .channel(`quiz_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          setSessionStatus(newStatus);

          // Si el quiz comenzó, iniciar cuenta regresiva y luego navegar
          if (newStatus === 'in_progress') {
            startCountdownToQuiz();
          }
        }
      )
      .subscribe();

    // Suscribirse a cambios en quiz_participants
    const participantsChannel = supabase
      .channel(`quiz_participants_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_participants',
          filter: `quiz_session_id=eq.${sessionId}`,
        },
        () => {
          // Recargar participantes cuando hay cambios
          loadParticipantsList();
        }
      )
      .subscribe();

    realtimeSubscriptionRef.current = {
      unsubscribe: () => {
        sessionChannel.unsubscribe();
        participantsChannel.unsubscribe();
      },
    };
  };

  const loadParticipantsList = async () => {
    try {
      const { data: participantsData, error: participantsError } = await supabase
        .from('quiz_participants')
        .select('id, user_id, participant_email, participant_name, status, joined_at')
        .eq('quiz_session_id', sessionId)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;
      setParticipants(participantsData || []);

      const me = (participantsData || []).find((participant) => participant.id === participantId);
      if (me?.status === 'finished') {
        goToPlay();
      }
    } catch (err) {
      console.error('Error cargando participantes:', err);
    }
  };

  const getParticipantDisplayName = (participant) => {
    if (participant?.participant_name?.trim()) return participant.participant_name.trim();
    if (participant?.participant_email) return String(participant.participant_email).split('@')[0];
    return 'Sin nombre';
  };

  const startCountdownToQuiz = () => {
    if (countdownStartedRef.current) return;
    countdownStartedRef.current = true;
    setShowCountdown(true);
    preloadQuizPayload();

    const steps = ['3', '2', '1', 'Empieza'];
    steps.forEach((label, index) => {
      setTimeout(() => {
        setCountdownText(label);
      }, index * 900);
    });

    setTimeout(() => {
      goToPlay();
    }, steps.length * 900 + 150);
  };

  const preloadQuizPayload = async () => {
    if (preloadingQuizRef.current || preloadedQuizDataRef.current || !formId) return;
    preloadingQuizRef.current = true;

    try {
      const [{ data: formResponse, error: formError }, { data: questionsResponse, error: questionsError }] = await Promise.all([
        supabase
          .from('forms')
          .select('id, title, description')
          .eq('id', formId)
          .single(),
        supabase
          .from('form_questions')
          .select(`
            id, title, description, type, required, position, points,
            settings,
            form_question_options (id, label, value, position)
          `)
          .eq('form_id', formId)
          .order('position', { ascending: true }),
      ]);

      if (formError || questionsError) return;

      preloadedQuizDataRef.current = {
        form: formResponse,
        questions: questionsResponse || [],
      };
    } catch (err) {
      console.error('Error precargando quiz:', err);
    } finally {
      preloadingQuizRef.current = false;
    }
  };

  const handleConfirmLeave = async () => {
    try {
      setIsLeaving(true);
      if (participantId) {
        await supabase.from('quiz_participants').delete().eq('id', participantId);
      }
    } catch (err) {
      console.error('Error al abandonar sala:', err);
    } finally {
      setIsLeaving(false);
      navigate('/join-quiz');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center text-slate-200">
          <div className="animate-spin mb-4 inline-block">
            <svg className="w-12 h-12 text-primary-300" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="font-semibold">Cargando sala de espera...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-8 max-w-md text-center">
          <p className="text-red-200 font-semibold mb-4">Error: {error}</p>
          <button
            onClick={() => navigate('/join-quiz')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] px-4 py-8 text-slate-100 md:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/4 h-72 w-72 rounded-full bg-primary-500/12 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-primary-500/12 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <div className="mb-6 border-b border-white/10 pb-5">
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">{formData?.title}</h1>
          <p className="mt-3 max-w-2xl text-slate-300">{formData?.description || 'Sin descripcion'}</p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Estado de la sala</p>
              <p className="mt-1 text-xl font-semibold">
                {sessionStatus === 'waiting' ? (
                  <span className="text-amber-300">Esperando inicio</span>
                ) : sessionStatus === 'in_progress' ? (
                  <span className="text-emerald-300">Quiz en progreso</span>
                ) : (
                  <span className="text-rose-300">Quiz finalizado</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Participantes</p>
              <p className="mt-1 text-3xl font-bold text-primary-300">{participants.length}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {participants.length === 0 ? (
            <p className="py-8 text-center text-slate-400">Esperando a que se unan más participantes...</p>
          ) : (
            participants.map((participant, idx) => (
              <div
                key={participant.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">{getParticipantDisplayName(participant)}</p>
                    <p className="text-xs text-slate-400">Unido recientemente</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {participant.id === participantId ? (
                    <span className="rounded-full border border-primary-300/40 bg-primary-500/20 px-2.5 py-1 text-[11px] font-bold text-primary-100">
                      Tu lugar
                    </span>
                  ) : null}
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                    participant.status === 'waiting' ? 'bg-amber-400 animate-pulse' :
                    participant.status === 'answering' ? 'bg-emerald-400' :
                    'bg-slate-500'
                  }`} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="rounded-lg border cursor-pointer border-rose-300/35 bg-rose-500/15 px-6 py-2.5 font-semibold text-rose-100 transition hover:bg-rose-500/25"
          >
            Abandonar sala
          </button>
        </div>
      </div>

      {showLeaveModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black p-6 text-slate-100 shadow-[0_22px_48px_rgba(2,6,23,0.7)]">
            <h3 className="text-xl font-bold">¿Seguro que quieres abandonar la sala?</h3>
            <p className="mt-2 text-sm text-slate-300">Perderás tu lugar y tendrás que volver a unirte con el código.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                disabled={isLeaving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {isLeaving ? 'Saliendo...' : 'Sí, abandonar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCountdown ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.18em] text-primary-200/80">El quiz inicia en</p>
            <p className="mt-3 text-8xl font-extrabold text-white drop-shadow-[0_0_24px_rgba(56,189,248,0.45)] animate-pulse">
              {countdownText}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
