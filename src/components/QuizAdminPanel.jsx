import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function QuizAdminPanel({ formId, onClose, formTitle, formDescription, joinCode }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  
  const realtimeSubscriptionRef = useRef(null);
  const activeSessionIdRef = useRef(null);
  const knownParticipantsRef = useRef(new Set());
  const participantsInitializedRef = useRef(false);

  const pushActivity = (message, tone = 'neutral') => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      tone,
      meta: null,
      createdAt: new Date().toISOString(),
    };
    setActivityFeed((current) => [entry, ...current].slice(0, 30));
  };

  const pushJoinActivity = (displayName) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message: 'se unio a la sala',
      tone: 'join',
      meta: { displayName },
      createdAt: new Date().toISOString(),
    };
    setActivityFeed((current) => [entry, ...current].slice(0, 30));
  };

  useEffect(() => {
    loadActiveSessions();
    subscribeToChanges();

    return () => {
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
      }
    };
  }, [formId]);

  const loadActiveSessions = async () => {
    try {
      // Cargar sesiones activas (no finalizadas)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('quiz_sessions')
        .select('id, status, created_at, started_at, finished_at')
        .eq('form_id', formId)
        .in('status', ['waiting', 'in_progress'])
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);

      // Si hay sesiones, cargar datos de la primera (más reciente)
      if (sessionsData && sessionsData.length > 0) {
        setActiveSession(sessionsData[0]);
        activeSessionIdRef.current = sessionsData[0].id;
        loadParticipants(sessionsData[0].id);
        loadLeaderboard(sessionsData[0].id);
      } else {
        activeSessionIdRef.current = null;
        knownParticipantsRef.current = new Set();
        participantsInitializedRef.current = false;
        setLeaderboard([]);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadParticipants = async (sessionId) => {
    try {
      const { data: participantsData, error: participantsError } = await supabase
        .from('quiz_participants')
        .select('id, user_id, participant_email, participant_name, status, joined_at')
        .eq('quiz_session_id', sessionId)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;
      const nextParticipants = participantsData || [];
      setParticipants(nextParticipants);

      if (!participantsInitializedRef.current) {
        knownParticipantsRef.current = new Set(nextParticipants.map((participant) => participant.id));
        participantsInitializedRef.current = true;
        return;
      }

      const newParticipants = nextParticipants.filter(
        (participant) => !knownParticipantsRef.current.has(participant.id),
      );

      if (newParticipants.length > 0) {
        newParticipants.forEach((participant) => {
          knownParticipantsRef.current.add(participant.id);
          pushJoinActivity(getParticipantDisplayName(participant));
        });
      }
    } catch (err) {
      console.error('Error cargando participantes:', err);
    }
  };

  const loadLeaderboard = async (sessionId) => {
    if (!sessionId) {
      setLeaderboard([]);
      return;
    }

    try {
      setLoadingLeaderboard(true);
      const { data, error: leaderboardError } = await supabase
        .rpc('get_quiz_leaderboard', { p_session_id: sessionId });

      if (leaderboardError) throw leaderboardError;
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Error cargando leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const subscribeToChanges = () => {
    // Suscribirse a nuevas sesiones
    const sessionsChannel = supabase
      .channel(`quiz_sessions_admin_${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `form_id=eq.${formId}`,
        },
        (payload) => {
          loadActiveSessions();

          if (payload.eventType === 'INSERT') {
            pushActivity('Se creo una nueva sesion de quiz', 'system');
          }

          if (payload.eventType === 'UPDATE') {
            const nextStatus = payload.new?.status;
            if (nextStatus === 'in_progress') {
              pushActivity('El quiz cambio a estado en progreso', 'system');
            }
            if (nextStatus === 'finished') {
              pushActivity('La sesion fue finalizada', 'system');
            }
          }
        }
      )
      .subscribe();

    // Suscribirse a cambios en participantes
    const participantsChannel = supabase
      .channel(`quiz_participants_admin_${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_participants',
        },
        (payload) => {
          if (
            payload.eventType === 'INSERT' &&
            payload.new?.quiz_session_id === activeSessionIdRef.current &&
            payload.new?.id &&
            !knownParticipantsRef.current.has(payload.new.id)
          ) {
            knownParticipantsRef.current.add(payload.new.id);
            const inlineName = payload.new.participant_name || getDisplayNameFromEmail(payload.new.participant_email) || 'Sin nombre';
            pushJoinActivity(inlineName);
          }

          if (activeSessionIdRef.current) {
            loadParticipants(activeSessionIdRef.current);
            loadLeaderboard(activeSessionIdRef.current);
          }
        }
      )
      .subscribe();

    // Suscribirse a respuestas para puntajes/progreso en vivo
    const answersChannel = supabase
      .channel(`quiz_answers_admin_${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_participant_answers',
        },
        () => {
          if (activeSessionIdRef.current) {
            loadLeaderboard(activeSessionIdRef.current);
          }
        }
      )
      .subscribe();

    realtimeSubscriptionRef.current = {
      unsubscribe: () => {
        sessionsChannel.unsubscribe();
        participantsChannel.unsubscribe();
        answersChannel.unsubscribe();
      },
    };
  };

  const createNewSession = async () => {
    try {
      setIsCreatingSession(true);
      const { data: sessionId, error } = await supabase
        .rpc('create_quiz_session', { p_form_id: formId });

      if (error) throw error;

      setActiveSession({ id: sessionId, status: 'waiting', created_at: new Date().toISOString() });
      activeSessionIdRef.current = sessionId;
      knownParticipantsRef.current = new Set();
      participantsInitializedRef.current = false;
      setParticipants([]);
      setLeaderboard([]);
      pushActivity('Se creo una nueva sesion. Esperando participantes...', 'system');
      await loadActiveSessions();
    } catch (err) {
      setError('Error creando sesión: ' + err.message);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const startQuiz = async () => {
    if (!activeSession) return;

    try {
      setIsStarting(true);
      const { error } = await supabase
        .rpc('start_quiz_session', { p_session_id: activeSession.id });

      if (error) throw error;

      // Actualizar estado local
      setActiveSession({ ...activeSession, status: 'in_progress' });
      pushActivity('Quiz iniciado. Los participantes pueden responder.', 'system');
      await loadActiveSessions();
      await loadLeaderboard(activeSession.id);
    } catch (err) {
      setError('Error iniciando quiz: ' + err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const finishQuiz = async () => {
    if (!activeSession) return;

    try {
      const { error } = await supabase
        .rpc('finish_quiz_session', { p_session_id: activeSession.id });

      if (error) throw error;

      // Actualizar estado local
      setActiveSession(null);
      activeSessionIdRef.current = null;
      knownParticipantsRef.current = new Set();
      participantsInitializedRef.current = false;
      pushActivity('Sesion finalizada por el anfitrion.', 'system');
      setLeaderboard([]);
      await loadActiveSessions();
    } catch (err) {
      setError('Error finalizando quiz: ' + err.message);
    }
  };

  const getDisplayNameFromEmail = (email) => {
    if (!email) return '';
    return String(email).split('@')[0];
  };

  const formatHour = (value) => {
    if (!value) return '--:--';
    return new Date(value).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getParticipantIdentity = (participant) => {
    const displayName =
      participant?.participant_name?.trim() ||
      getDisplayNameFromEmail(participant?.participant_email) ||
      'Sin nombre';

    return {
      displayName,
      isAuthenticated: Boolean(participant?.user_id),
    };
  };

  const getLeaderboardIdentity = (entry) => {
    return (
      entry?.participant_name?.trim() ||
      getDisplayNameFromEmail(entry?.participant_email) ||
      'Sin nombre'
    );
  };

  const getParticipantDisplayName = (participant) => getParticipantIdentity(participant).displayName;

  if (loading) {
    return (
      <div className="text-slate-100">
        <div className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-4 py-8">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1220]/90 px-6 py-4">
            <div className="animate-spin">
              <svg className="h-7 w-7 text-primary-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-200">Cargando panel de quiz...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white bg-black">
      <div className=" px-4 py-6 md:px-8">
        <header className="sticky top-4 z-10 mb-6 border-b border-white/10 pb-4 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/85">Control en vivo</p>
              <h2 className="mt-1 text-xl text-white/90 font-bold">Panel de Control del Quiz</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Editar
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Formulario</p>
              <p className="mt-1 text-2xl font-bold leading-tight text-slate-100">{formTitle || 'Sin titulo'}</p>
            </div>
            <div className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Descripcion</p>
              <p className="mt-1 truncate text-sm text-slate-200">{formDescription || 'Sin descripcion'}</p>
            </div>
            <div className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-primary-200/85">Codigo de acceso</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-lg font-bold text-primary-100">{joinCode || '---'}</p>
                {joinCode ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(joinCode);
                        setCopyStatus('Copiado');
                        setTimeout(() => setCopyStatus(''), 1800);
                      } catch {
                        setCopyStatus('Error');
                        setTimeout(() => setCopyStatus(''), 1800);
                      }
                    }}
                    className="rounded-md border border-primary-300/35 px-2 py-1 text-xs font-semibold text-primary-200 transition hover:bg-primary-400/10"
                  >
                    Copiar
                  </button>
                ) : null}
                {copyStatus ? <span className="text-xs text-primary-300">{copyStatus}</span> : null}
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          {error && (
            <div className="lg:col-span-3 rounded-lg border border-red-400/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {!activeSession ? (
            <div className="lg:col-span-3 py-12 text-center">
              <p className="mb-6 text-slate-300">No hay sesiones de quiz activas</p>
              <button
                onClick={createNewSession}
                disabled={isCreatingSession}
                className="rounded-lg cursor-pointer bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {isCreatingSession ? 'Creando...' : 'Crear Nueva Sesion'}
              </button>
            </div>
          ) : (
            <>
              <aside className="rounded-xl bg-white/5 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-100">Actividad</h3>
                  <span className="text-xs text-slate-400">Recientes</span>
                </div>

                <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
                  {activityFeed.length === 0 ? (
                    <p className="py-3 text-sm text-slate-400">Sin actividad por ahora.</p>
                  ) : (
                    activityFeed.map((event) => (
                      <div key={event.id} className="border-b border-white/8 py-2">
                        {event.tone === 'join' && event.meta?.displayName ? (
                          <p className="text-sm text-slate-200">
                            <span className="font-bold text-white">{event.meta.displayName}</span>
                            <span className="text-slate-300"> {event.message}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">{event.message}</p>
                        )}
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                          {formatHour(event.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </aside>

              <main className="space-y-6 px-2">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Estado de sesion</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        activeSession.status === 'waiting' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <span className="text-sm font-semibold text-slate-100">
                        {activeSession.status === 'waiting' ? 'Esperando participantes' : 'En progreso'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Creada: {formatHour(activeSession.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                      onClick={finishQuiz}
                      className=" cursor-pointer px-5 py-1 font-semibold text-red-600  transition hover:scale-[1.01] hover:from-rose-500 hover:to-red-400"
                    >
                      Finalizar quiz
                    </button>
                    {activeSession.status === 'waiting' && (
                      <button
                        onClick={startQuiz}
                        disabled={isStarting || participants.length === 0}
                        className="rounded-lg bg-linear-to-r cursor-pointer from-green-600 to-green-500 px-5 py-1 font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:scale-[1.01] hover:from-emerald-500 hover:to-teal-400 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600"
                      >
                        {isStarting ? 'Iniciando...' : 'Iniciar quiz'}
                      </button>
                    )}

          
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-100">Participantes</h3>
                    <span className="text-sm text-slate-400">{participants.length} conectados</span>
                  </div>

                  <div className="max-h-[56vh] divide-y divide-white/8 overflow-y-auto">
                    {participants.length === 0 ? (
                      <p className="py-6 text-sm text-slate-400">Esperando participantes...</p>
                    ) : (
                      participants.map((participant, idx) => {
                        const identity = getParticipantIdentity(participant);
                        return (
                          <div key={participant.id} className="flex items-center justify-between py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                                {idx + 1}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-slate-100">{identity.displayName}</p>
                                  {identity.isAuthenticated ? (
                                    <span className="inline-flex items-center text-emerald-300" title="Usuario autenticado">
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <path d="M17 8h-1V6a4 4 0 10-8 0v2H7a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2v-9a2 2 0 00-2-2zm-6 0V6a2 2 0 114 0v2h-4z" />
                                      </svg>
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-slate-400">{formatHour(participant.joined_at)}</p>
                              </div>
                            </div>

                            <span className={`h-2.5 w-2.5 rounded-full ${
                              participant.status === 'waiting' ? 'bg-amber-400' :
                              participant.status === 'answering' ? 'bg-emerald-400' :
                              'bg-slate-500'
                            }`} />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </main>

              <aside className="border-l border-white/10 pl-4 bg-[#181818] p-5 rounded-lg   ">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-100">Ranking</h3>
                  <span className="text-xs text-slate-400">{loadingLeaderboard ? 'Actualizando...' : 'En vivo'}</span>
                </div>

                <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                  {leaderboard.length === 0 ? (
                    <p className="py-3 text-sm text-slate-400">Aun no hay respuestas para mostrar ranking.</p>
                  ) : (
                    leaderboard.map((entry, idx) => (
                      <div key={entry.participant_id} className="border-b border-white/8 pb-2">
                        {(() => {
                          const progressPercent = Math.min(100, Number(entry.progress_percent || 0));
                          const progressColorClass = progressPercent >= 100 ? 'bg-green-400' : 'bg-yellow-500';

                          return (
                            <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-100">
                              {idx + 1}. {getLeaderboardIdentity(entry)}
                            </p>
                            <p className="text-xs text-slate-400">{entry.answered_count}/{entry.total_questions} respondidas</p>
                          </div>

                          <p className="text-sm font-bold text-primary-300">{Number(entry.total_score || 0).toFixed(2)}</p>
                        </div>

                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
                          <div
                            className={`h-full rounded-full ${progressColorClass}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
