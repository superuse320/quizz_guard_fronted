import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function QuizAdminPanel({ formId, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  const realtimeSubscriptionRef = useRef(null);
  const activeSessionIdRef = useRef(null);

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
      setParticipants(participantsData || []);
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
        () => {
          loadActiveSessions();
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
        () => {
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
      setParticipants([]);
      setLeaderboard([]);
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
      setLeaderboard([]);
      await loadActiveSessions();
    } catch (err) {
      setError('Error finalizando quiz: ' + err.message);
    }
  };

  const getParticipantDisplayName = (participant) => {
    if (participant.user_id) {
      return participant.participant_email || 'Usuario autenticado';
    }
    return participant.participant_name || 'Participante anónimo';
  };

  const getLeaderboardDisplayName = (entry) => {
    return entry.participant_name || entry.participant_email || 'Participante anónimo';
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Encabezado */}
        <div className="bg-linear-to-r from-purple-600 to-blue-600 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">🎮 Panel de Control del Quiz</h2>
          <button
            onClick={onClose}
            className="text-2xl font-bold hover:text-gray-200 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {!activeSession ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-6">No hay sesiones de quiz activas</p>
              <button
                onClick={createNewSession}
                disabled={isCreatingSession}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-all"
              >
                {isCreatingSession ? 'Creando...' : 'Crear Nueva Sesión'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Estado de la sesión */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-800">Estado de Sesión</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    activeSession.status === 'waiting'
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'bg-green-200 text-green-800'
                  }`}>
                    {activeSession.status === 'waiting' ? '⏳ Esperando' : '▶️ En progreso'}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Iniciado: {new Date(activeSession.created_at).toLocaleTimeString('es-ES')}
                </p>
              </div>

              {/* Participantes */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800">
                    Participantes ({participants.length})
                  </h3>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {participants.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Esperando participantes...
                    </p>
                  ) : (
                    participants.map((participant, idx) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {getParticipantDisplayName(participant)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(participant.joined_at).toLocaleTimeString('es-ES')}
                            </p>
                          </div>
                        </div>
                        <span className={`w-3 h-3 rounded-full ${
                          participant.status === 'waiting' ? 'bg-yellow-400' :
                          participant.status === 'answering' ? 'bg-green-400' :
                          'bg-gray-400'
                        }`} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ranking en vivo */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-800">Ranking en vivo</h3>
                  {loadingLeaderboard ? (
                    <span className="text-xs text-gray-500">Actualizando...</span>
                  ) : (
                    <span className="text-xs text-gray-500">Tiempo real</span>
                  )}
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {leaderboard.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Aun no hay respuestas para mostrar ranking.
                    </p>
                  ) : (
                    leaderboard.map((entry, idx) => (
                      <div
                        key={entry.participant_id}
                        className={`rounded-lg border p-3 ${
                          idx === 0
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-600 text-white'
                            }`}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {idx === 0 ? '🏆 ' : ''}{getLeaderboardDisplayName(entry)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {entry.answered_count} / {entry.total_questions} respondidas
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-700">
                              {Number(entry.total_score || 0).toFixed(2)} pts
                            </p>
                            <p className="text-xs text-gray-500">
                              de {Number(entry.max_score || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                idx === 0 ? 'bg-yellow-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(100, Number(entry.progress_percent || 0))}%` }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
                            <span>{Number(entry.progress_percent || 0).toFixed(0)}% progreso</span>
                            <span>
                              {entry.participant_status === 'finished'
                                ? 'Finalizado'
                                : entry.participant_status === 'answering'
                                  ? 'Respondiendo'
                                  : 'Esperando'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Controles */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  {activeSession.status === 'waiting'
                    ? 'Cuando todos los participantes se hayan unido, inicia el quiz'
                    : 'El quiz está en progreso. Los participantes están respondiendo preguntas'}
                </p>
                <div className="flex gap-3">
                  {activeSession.status === 'waiting' && (
                    <button
                      onClick={startQuiz}
                      disabled={isStarting || participants.length === 0}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold transition-all"
                    >
                      {isStarting ? '🚀 Iniciando...' : '🚀 Iniciar Quiz'}
                    </button>
                  )}
                  
                  <button
                    onClick={finishQuiz}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-all"
                  >
                    ⏹️ Finalizar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-semibold"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
}
