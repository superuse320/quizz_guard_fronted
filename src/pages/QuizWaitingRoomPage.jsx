import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function QuizWaitingRoomPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const sessionId = location.state?.sessionId;
  const participantId = location.state?.participantId;
  const formId = location.state?.formId;
  
  const [formData, setFormData] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('waiting');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const realtimeSubscriptionRef = useRef(null);

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

          // Si el quiz comenzó, navegar a la página de juego
          if (newStatus === 'in_progress') {
            setTimeout(() => {
              navigate(`/quiz/play?sessionId=${sessionId}&participantId=${participantId}&formId=${formId}`, {
                state: {
                  sessionId,
                  participantId,
                  formId,
                },
              });
            }, 1000);
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
    } catch (err) {
      console.error('Error cargando participantes:', err);
    }
  };

  const getParticipantDisplayName = (participant) => {
    if (participant.user_id) {
      return participant.participant_email || 'Usuario autenticado';
    }
    return participant.participant_name || 'Participante anónimo';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold">Cargando sala de espera...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-4">Error: {error}</p>
          <button
            onClick={() => navigate('/join-quiz')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-blue-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Encabezado */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{formData?.title}</h1>
          <p className="text-gray-600 mb-6">{formData?.description}</p>
          
          {/* Estado de la sala */}
          <div className="flex items-center justify-between bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Estado de la sala</p>
              <p className="text-2xl font-bold">
                {sessionStatus === 'waiting' ? (
                  <span className="text-yellow-600 animate-pulse">⏳ Esperando a que empiece</span>
                ) : sessionStatus === 'in_progress' ? (
                  <span className="text-green-600">▶️ Quiz en progreso</span>
                ) : (
                  <span className="text-red-600">⏹️ Quiz finalizado</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Participantes</p>
              <p className="text-4xl font-bold text-blue-600">{participants.length}</p>
            </div>
          </div>
        </div>

        {/* Lista de participantes */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Participantes en línea</h2>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {participants.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Esperando a que se unan más participantes...</p>
            ) : (
              participants.map((participant, idx) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-bold">
                        {idx + 1}
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-800 font-semibold">
                        {getParticipantDisplayName(participant)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Se unió hace {Math.round((Date.now() - new Date(participant.joined_at).getTime()) / 1000)}s
                      </p>
                    </div>
                  </div>
                  <div>
                    {participant.id === participantId && (
                      <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Tú
                      </span>
                    )}
                    <span className={`ml-2 inline-block w-3 h-3 rounded-full ${
                      participant.status === 'waiting' ? 'bg-yellow-400 animate-pulse' :
                      participant.status === 'answering' ? 'bg-green-400' :
                      'bg-gray-400'
                    }`} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mensaje de espera */}
          <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-300 rounded-lg text-center">
            <p className="text-gray-700 mb-2">
              {sessionStatus === 'waiting' ? (
                <>
                  <span className="font-bold text-lg">Preparados para jugar! 🎮</span>
                  <br />
                  <span className="text-sm">El instructor iniciará el quiz próximamente</span>
                </>
              ) : (
                <>
                  <span className="font-bold text-lg text-green-600">¡El quiz ha comenzado! 🚀</span>
                  <br />
                  <span className="text-sm">Serás redirigido en un momento...</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Botón para abandonar */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/join-quiz')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
          >
            Abandonar sala
          </button>
        </div>
      </div>
    </div>
  );
}
