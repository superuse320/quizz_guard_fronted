import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const QUIZ_PLAY_CONTEXT_KEY = 'quiz_play_context';

const getQuestionAllocatedSeconds = (question) => {
  const text = `${question?.title || ''} ${question?.description || ''}`.trim();
  const length = text.length;

  if (length <= 80) return 10;
  if (length <= 180) return 20;
  return 30;
};

const getQuestionTypeLabel = (type) => {
  const map = {
    choice_unique: 'Opcion unica',
    multiple_choice: 'Opcion multiple',
    checkboxes: 'Casillas',
    short_answer: 'Respuesta corta',
    paragraph: 'Parrafo',
    dropdown: 'Desplegable',
    email: 'Email',
    number: 'Numero',
    phone: 'Telefono',
    url: 'URL',
    date: 'Fecha',
    time: 'Hora',
    linear_scale: 'Escala lineal',
    emoji_scale: 'Escala emoji',
    star_rating: 'Calificacion',
    ranking: 'Ranking',
  };

  return map[type] || type;
};

const hasAnswer = (question, answers) => {
  if (!question) return false;
  const value = answers[question.id];

  if (question.type === 'checkboxes' || question.type === 'multiple_choice') {
    return Array.isArray(value) && value.length > 0;
  }

  if (question.type === 'dropdown') {
    return !!value;
  }

  if (question.type === 'ranking') {
    return Array.isArray(value) && value.length > 0;
  }

  if (question.type === 'short_answer' || question.type === 'paragraph' || question.type === 'email' || question.type === 'number' || question.type === 'phone' || question.type === 'url' || question.type === 'date' || question.type === 'time') {
    return String(value || '').trim() !== '';
  }

  return value !== undefined && value !== null && value !== '';
};

const getRankingOrder = (question, answers) => {
  const base = (question.form_question_options || []).map((opt) => opt.id);
  const current = Array.isArray(answers[question.id]) ? answers[question.id] : [];
  const valid = current.filter((id) => base.includes(id));
  const missing = base.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
};

// Calcula puntos con descuento lineal por segundo
// Ejemplo: 100 puntos, 10s → descuenta 10 puntos por segundo
// 10s usado → 0 puntos base, pero mínimo 1 si es correcto
const calculatePointsWithTimeDecay = (basePoints, elapsedSeconds, allocatedSeconds) => {
  if (!allocatedSeconds || allocatedSeconds <= 0) return basePoints;
  
  const pointsPerSecond = basePoints / allocatedSeconds;
  const pointsLost = Math.floor(elapsedSeconds * pointsPerSecond);
  const finalPoints = basePoints - pointsLost;
  
  // Mínimo 1 punto si se responde correctamente, 0 si es incorrecto
  return Math.max(0, finalPoints);
};

export default function QuizPlayPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [playContext, setPlayContext] = useState(null);
  const [formData, setFormData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sessionStatus, setSessionStatus] = useState('in_progress');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [finalResults, setFinalResults] = useState(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(null);
  const [timedOutQuestionIds, setTimedOutQuestionIds] = useState({});
  const [scoreToast, setScoreToast] = useState({ visible: false, message: '', isCorrect: false });

  const realtimeSubscriptionRef = useRef(null);
  const saveTimersRef = useRef({});
  const questionStartTimesRef = useRef({});
  const questionAllocatedSecondsRef = useRef({});
  const scoreToastTimerRef = useRef(null);
  const persistedAnswersRef = useRef({});

  const sessionId = playContext?.sessionId;
  const participantId = playContext?.participantId;
  const formId = playContext?.formId;

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');

    const fromState = location.state?.sessionId && location.state?.participantId && location.state?.formId
      ? {
          sessionId: location.state.sessionId,
          participantId: location.state.participantId,
          formId: location.state.formId,
        }
      : null;

    const fromQuery = params.get('sessionId') && params.get('participantId') && params.get('formId')
      ? {
          sessionId: params.get('sessionId'),
          participantId: params.get('participantId'),
          formId: params.get('formId'),
        }
      : null;

    let fromStorage = null;
    try {
      const raw = localStorage.getItem(QUIZ_PLAY_CONTEXT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.sessionId && parsed?.participantId && parsed?.formId) {
          fromStorage = parsed;
        }
      }
    } catch {
      fromStorage = null;
    }

    const resolved = fromState || fromQuery || fromStorage;

    if (!resolved) {
      navigate('/join-quiz', { replace: true });
      return;
    }

    setPlayContext(resolved);

    try {
      localStorage.setItem(QUIZ_PLAY_CONTEXT_KEY, JSON.stringify(resolved));
    } catch {
      // no-op
    }

    const expectedSearch = `?sessionId=${resolved.sessionId}&participantId=${resolved.participantId}&formId=${resolved.formId}`;
    if (location.search !== expectedSearch) {
      navigate(`/quiz/play${expectedSearch}`, {
        replace: true,
        state: resolved,
      });
    }
  }, [location.search, location.state, navigate]);

  useEffect(() => {
    if (!sessionId || !participantId || !formId) return;

    loadQuizData();
    subscribeToSessionChanges();

    return () => {
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
      }

      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
      if (scoreToastTimerRef.current) {
        clearTimeout(scoreToastTimerRef.current);
      }
    };
  }, [sessionId, participantId, formId]);

  useEffect(() => {
    if (!finished || !participantId || !sessionId) return;
    loadFinalResults();
  }, [finished, participantId, sessionId]);

  useEffect(() => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || finished) {
      setQuestionTimeLeft(null);
      return;
    }

    const questionId = currentQuestion.id;

    if (!questionAllocatedSecondsRef.current[questionId]) {
      questionAllocatedSecondsRef.current[questionId] = getQuestionAllocatedSeconds(currentQuestion);
    }

    if (!questionStartTimesRef.current[questionId]) {
      questionStartTimesRef.current[questionId] = Date.now();
    }

    const updateTimeLeft = () => {
      const allocated = questionAllocatedSecondsRef.current[questionId];
      const startedAt = questionStartTimesRef.current[questionId];
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const left = Math.max(0, allocated - elapsedSeconds);
      setQuestionTimeLeft(left);
    };

    updateTimeLeft();
    const timer = setInterval(updateTimeLeft, 250);

    return () => clearInterval(timer);
  }, [questions, currentQuestionIndex, finished]);

  useEffect(() => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || questionTimeLeft !== 0 || finished) return;

    if (timedOutQuestionIds[currentQuestion.id]) return;

    setTimedOutQuestionIds((prev) => ({ ...prev, [currentQuestion.id]: true }));

    if (hasAnswer(currentQuestion, answers)) return;

    setQuestionError('Tiempo agotado para esta pregunta.');

    const timeout = setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((idx) => Math.min(idx + 1, questions.length - 1));
        setQuestionError('');
      } else {
        handleSubmitQuiz(true);
      }
    }, 650);

    return () => clearTimeout(timeout);
  }, [questionTimeLeft, currentQuestionIndex, questions, timedOutQuestionIds, answers, finished]);

  const loadQuizData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: participantData, error: participantError } = await supabase
        .from('quiz_participants')
        .select('status')
        .eq('id', participantId)
        .single();

      if (participantError) throw participantError;

      if (participantData?.status === 'finished') {
        setFinished(true);
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSessionStatus(sessionData?.status || 'in_progress');

      if (sessionData?.status === 'finished') {
        setFinished(true);
      }

      const { data: formResponse, error: formError } = await supabase
        .from('forms')
        .select('id, title, description')
        .eq('id', formId)
        .single();

      if (formError) throw formError;
      setFormData(formResponse);

      const { data: directQuestions, error: directError } = await supabase
        .from('form_questions')
        .select(`
          id, title, description, type, required, position, points,
          settings,
          form_question_options (id, label, value, position)
        `)
        .eq('form_id', formId)
        .order('position', { ascending: true });

      if (directError) throw directError;
      setQuestions(directQuestions || []);

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadFinalResults = async () => {
    try {
      const { data, error: resultsError } = await supabase
        .rpc('get_quiz_participant_results', {
          p_participant_id: participantId,
          p_session_id: sessionId,
        });

      if (resultsError) {
        console.error('Error cargando resultados finales:', resultsError);
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        setFinalResults(data[0]);
      }
    } catch (err) {
      console.error('Error cargando resultados:', err);
    }
  };

  const subscribeToSessionChanges = () => {
    const channel = supabase
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

          if (newStatus === 'finished') {
            setFinished(true);
          }
        }
      )
      .subscribe();

    realtimeSubscriptionRef.current = { unsubscribe: () => channel.unsubscribe() };
  };

  const showScoreToast = (message, isCorrect) => {
    if (scoreToastTimerRef.current) {
      clearTimeout(scoreToastTimerRef.current);
    }

    setScoreToast({ visible: true, message, isCorrect });

    scoreToastTimerRef.current = setTimeout(() => {
      setScoreToast((prev) => ({ ...prev, visible: false }));
    }, 2600);
  };

  const persistAnswer = async (questionId, value, { silent = false } = {}) => {
    if (!participantId || value === undefined) return;

    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    const allocatedSeconds = questionAllocatedSecondsRef.current[questionId]
      || getQuestionAllocatedSeconds(question);
    const startedAt = questionStartTimesRef.current[questionId] || Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

    // Calcula puntos con descuento lineal por segundo
    const basePoints = Number(question.points ?? 0);
    const adjustedPoints = calculatePointsWithTimeDecay(basePoints, elapsedSeconds, allocatedSeconds);
    const pointsPerSecond = basePoints / allocatedSeconds;

    try {
      await supabase.rpc('submit_quiz_answer', {
        p_participant_id: participantId,
        p_question_id: questionId,
        p_answer_value: {
          value,
          elapsed_seconds: elapsedSeconds,
          allocated_seconds: allocatedSeconds,
          adjusted_points: adjustedPoints,
          points_per_second: pointsPerSecond,
        },
      });

      const { data: savedAnswer } = await supabase
        .from('quiz_participant_answers')
        .select('points_earned, is_correct')
        .eq('participant_id', participantId)
        .eq('question_id', questionId)
        .maybeSingle();

      const earnedPoints = Number(savedAnswer?.points_earned || 0);
      const isCorrect = !!savedAnswer?.is_correct;

      persistedAnswersRef.current[questionId] = true;

      if (!silent) {
        showScoreToast(
          isCorrect
            ? `Correcto. Ganaste ${earnedPoints.toFixed(2)} puntos en esta pregunta.`
            : 'Respuesta incorrecta. Ganaste 0 puntos en esta pregunta.',
          isCorrect
        );
      }

      console.log(`🎯 Respuesta guardada - Q:${questionId} | BasePts:${basePoints} | Descuento:${pointsPerSecond.toFixed(2)}/s | Tiempo:${elapsedSeconds}s | Final:${adjustedPoints}`);
    } catch (err) {
      console.error('Error guardando respuesta en vivo:', err);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    if (timedOutQuestionIds[questionId]) return;

    persistedAnswersRef.current[questionId] = false;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    setQuestionError('');
  };

  const handleNextQuestion = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!hasAnswer(currentQuestion, answers) && !timedOutQuestionIds[currentQuestion?.id]) {
      setQuestionError('Debes responder esta pregunta para continuar.');
      return;
    }

    // Guardar respuesta actual antes de avanzar
    await persistAnswer(currentQuestion.id, answers[currentQuestion.id]);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setQuestionError('');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setQuestionError('');
    }
  };

  const handleSubmitQuiz = async (forceSubmit = false) => {
    try {
      const firstUnansweredIdx = questions.findIndex(
        (question) => !hasAnswer(question, answers) && !timedOutQuestionIds[question.id]
      );
      if (!forceSubmit && firstUnansweredIdx !== -1) {
        setCurrentQuestionIndex(firstUnansweredIdx);
        setQuestionError('Debes responder esta pregunta para poder enviar el quiz.');
        return;
      }

      setSubmitting(true);

      for (const [questionId, answerValue] of Object.entries(answers)) {
        if (!persistedAnswersRef.current[questionId]) {
          await persistAnswer(questionId, answerValue, { silent: true });
        }
      }

      await supabase
        .from('quiz_participants')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('id', participantId);

      setFinished(true);
    } catch (err) {
      setError('Error enviando respuestas: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRankingMove = (question, index, direction) => {
    const order = getRankingOrder(question, answers);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;

    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    handleAnswerChange(question.id, next);
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
          <p className="text-gray-700 font-semibold">Cargando quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
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

  if (finished) {
    const topPlayers = Array.isArray(finalResults?.top_players) ? finalResults.top_players : [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
          <div className="text-center mb-6">
            <div className="mb-2 text-5xl">🏁</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz finalizado</h2>
            <p className="text-gray-600">Estos son tus resultados finales.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-xs uppercase text-blue-700 font-semibold">Tu puesto</p>
              <p className="text-3xl font-bold text-blue-800">
                {finalResults?.participant_rank || '-'}
              </p>
              <p className="text-xs text-blue-700">de {finalResults?.total_participants || '-'}</p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-xs uppercase text-emerald-700 font-semibold">Puntaje</p>
              <p className="text-3xl font-bold text-emerald-800">
                {Number(finalResults?.total_score || 0).toFixed(2)}
              </p>
              <p className="text-xs text-emerald-700">de {Number(finalResults?.max_score || 0).toFixed(2)}</p>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-center">
              <p className="text-xs uppercase text-purple-700 font-semibold">Progreso</p>
              <p className="text-3xl font-bold text-purple-800">
                {finalResults?.answered_count || 0}
              </p>
              <p className="text-xs text-purple-700">de {finalResults?.total_questions || 0} respondidas</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Top 3 final</h3>
            {topPlayers.length === 0 ? (
              <p className="text-sm text-gray-500">Aun no hay ranking disponible.</p>
            ) : (
              <div className="space-y-2">
                {topPlayers.map((player) => (
                  <div key={player.participant_id} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : ''} #{player.rank} {player.participant_name || player.participant_email || 'Participante'}
                    </p>
                    <p className="text-sm font-bold text-blue-700">{Number(player.total_score || 0).toFixed(2)} pts</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).filter((questionId) => {
    const question = questions.find((q) => q.id === questionId);
    return hasAnswer(question, answers);
  }).length;

  const currentAllocatedSeconds = currentQuestion
    ? questionAllocatedSecondsRef.current[currentQuestion.id] || getQuestionAllocatedSeconds(currentQuestion)
    : null;

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-blue-100 p-6">
      {scoreToast.visible && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
          <div className={`rounded-lg border px-5 py-3 shadow-lg backdrop-blur ${
            scoreToast.isCorrect
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-800'
          }`}>
            <p className="text-sm font-bold">{scoreToast.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">{formData?.title}</h1>
            <div className={`px-4 py-2 rounded-full font-bold ${
              sessionStatus === 'in_progress'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {sessionStatus === 'in_progress' ? 'En progreso' : 'Finalizado'}
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(answeredQuestions / Math.max(1, totalQuestions)) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 text-center">
            {answeredQuestions} de {totalQuestions} respondidas
          </p>
        </div>

        {currentQuestion && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                  Pregunta {currentQuestionIndex + 1} de {totalQuestions}
                </span>
                <span className="inline-block bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs font-semibold capitalize">
                  {getQuestionTypeLabel(currentQuestion.type)}
                </span>
              </div>
              <div className="text-right">
                {currentQuestion.required && <span className="text-red-600 text-lg font-bold mr-2">*</span>}
                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${
                  Number(questionTimeLeft) <= 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  Tiempo: {questionTimeLeft ?? currentAllocatedSeconds}s / {currentAllocatedSeconds}s
                </span>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentQuestion.title}</h2>
            {currentQuestion.description && (
              <p className="text-gray-600 mb-6">{currentQuestion.description}</p>
            )}

            <div className="mb-8">
              {currentQuestion.type === 'choice_unique' && (
                <div className="space-y-3">
                  {currentQuestion.form_question_options?.map((option) => (
                    <div
                      key={option.id}
                      onClick={() => handleAnswerChange(currentQuestion.id, option.id)}
                      className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        answers[currentQuestion.id] === option.id
                          ? 'bg-blue-50 border-blue-500 shadow-md'
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        answers[currentQuestion.id] === option.id
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {answers[currentQuestion.id] === option.id && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <span className={`ml-4 font-semibold transition-all ${
                        answers[currentQuestion.id] === option.id
                          ? 'text-blue-700'
                          : 'text-gray-800'
                      }`}>
                        {option.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-3">
                  {currentQuestion.form_question_options?.map((option) => {
                    const isChecked = Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].includes(option.id);
                    return (
                      <div
                        key={option.id}
                        onClick={() => {
                          const currentAnswers = Array.isArray(answers[currentQuestion.id]) ? answers[currentQuestion.id] : [];
                          if (isChecked) {
                            handleAnswerChange(currentQuestion.id, currentAnswers.filter((id) => id !== option.id));
                          } else {
                            handleAnswerChange(currentQuestion.id, [...currentAnswers, option.id]);
                          }
                        }}
                        className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          isChecked
                            ? 'bg-green-50 border-green-500 shadow-md'
                            : 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isChecked ? 'bg-green-600 border-green-600' : 'border-gray-300'
                        }`}>
                          {isChecked && (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`ml-4 font-semibold transition-all ${isChecked ? 'text-green-700' : 'text-gray-800'}`}>
                          {option.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'checkboxes' && (
                <div className="space-y-3">
                  {currentQuestion.form_question_options?.map((option) => {
                    const isChecked = Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].includes(option.id);
                    return (
                      <div
                        key={option.id}
                        onClick={() => {
                          const currentAnswers = Array.isArray(answers[currentQuestion.id]) ? answers[currentQuestion.id] : [];
                          if (isChecked) {
                            handleAnswerChange(currentQuestion.id, currentAnswers.filter((id) => id !== option.id));
                          } else {
                            handleAnswerChange(currentQuestion.id, [...currentAnswers, option.id]);
                          }
                        }}
                        className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          isChecked
                            ? 'bg-orange-50 border-orange-500 shadow-md'
                            : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isChecked ? 'bg-orange-600 border-orange-600' : 'border-gray-300'
                        }`}>
                          {isChecked && (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`ml-4 font-semibold transition-all ${isChecked ? 'text-orange-700' : 'text-gray-800'}`}>
                          {option.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'dropdown' && (
                <select
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 bg-white font-medium transition-all hover:border-purple-300"
                >
                  <option value="">Selecciona una opción...</option>
                  {currentQuestion.form_question_options?.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}

              {currentQuestion.type === 'short_answer' && (
                <input
                  type="text"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium placeholder-gray-400"
                />
              )}

              {currentQuestion.type === 'paragraph' && (
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  rows="6"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium placeholder-gray-400 resize-none"
                />
              )}

              {currentQuestion.type === 'email' && (
                <input
                  type="email"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium placeholder-gray-400"
                />
              )}

              {currentQuestion.type === 'number' && (
                <input
                  type="number"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Ingresa un número..."
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium placeholder-gray-400"
                />
              )}

              {currentQuestion.type === 'phone' && (
                <input
                  type="tel"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Tu número de teléfono"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium placeholder-gray-400"
                />
              )}

              {currentQuestion.type === 'url' && (
                <input
                  type="url"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="https://ejemplo.com"
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium placeholder-gray-400"
                />
              )}

              {currentQuestion.type === 'date' && (
                <input
                  type="date"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"
                />
              )}

              {currentQuestion.type === 'time' && (
                <input
                  type="time"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"
                />
              )}

              {currentQuestion.type === 'linear_scale' && (
                <div className="space-y-6">
                  <div className="flex justify-between mb-4 text-sm font-semibold text-gray-700">
                    <span className="flex-1 text-left">{currentQuestion.settings?.scale_min_label || 'Mínimo'}</span>
                    <span className="flex-1 text-right">{currentQuestion.settings?.scale_max_label || 'Máximo'}</span>
                  </div>
                  <input
                    type="range"
                    min={currentQuestion.settings?.scale_min || 1}
                    max={currentQuestion.settings?.scale_max || 10}
                    value={answers[currentQuestion.id] || currentQuestion.settings?.scale_min || 1}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="text-center p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <p className="text-lg font-bold text-blue-700">
                      Valor seleccionado: {answers[currentQuestion.id] || currentQuestion.settings?.scale_min || 1}
                    </p>
                  </div>
                </div>
              )}

              {currentQuestion.type === 'emoji_scale' && (
                <div className="flex justify-between gap-4 py-6">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = i + 1;
                    const emojis = ['😢', '😕', '😐', '🙂', '😄'];
                    const isSelected = Number(answers[currentQuestion.id]) === value;
                    return (
                      <button
                        key={value}
                        onClick={() => handleAnswerChange(currentQuestion.id, value)}
                        className={`text-6xl p-4 rounded-xl transition-all duration-200 transform ${
                          isSelected
                            ? 'bg-yellow-100 scale-125 shadow-lg ring-4 ring-yellow-400'
                            : 'bg-gray-100 hover:bg-gray-200 hover:scale-110'
                        }`}
                      >
                        {emojis[i]}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'star_rating' && (
                <div className="flex justify-center gap-3 py-6">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = i + 1;
                    const isSelected = Number(answers[currentQuestion.id] || 0) >= value;
                    return (
                      <button
                        key={value}
                        onClick={() => handleAnswerChange(currentQuestion.id, value)}
                        className={`text-5xl transition-all transform ${
                          isSelected
                            ? 'text-yellow-400 scale-110 drop-shadow-lg'
                            : 'text-gray-300 hover:text-yellow-300 hover:scale-105'
                        }`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'ranking' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-lg">
                    <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3z" />
                    </svg>
                    <p className="text-sm text-purple-700 font-medium">Ordena de mayor a menor prioridad (arrastra o usa los botones)</p>
                  </div>
                  {getRankingOrder(currentQuestion, answers).map((optionId, idx, arr) => {
                    const option = (currentQuestion.form_question_options || []).find((opt) => opt.id === optionId);
                    return (
                      <div
                        key={optionId}
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-white border-2 border-purple-200 rounded-xl shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold flex items-center justify-center rounded-full shadow-md">
                          {idx + 1}
                        </div>
                        <span className="flex-1 font-semibold text-gray-800 text-lg">{option?.label || 'Opción'}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleRankingMove(currentQuestion, idx, -1)}
                            className="rounded-lg border-2 border-purple-300 bg-white hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium text-purple-700 transition-all hover:border-purple-500"
                          >
                            ↑ Subir
                          </button>
                          <button
                            type="button"
                            disabled={idx === arr.length - 1}
                            onClick={() => handleRankingMove(currentQuestion, idx, 1)}
                            className="rounded-lg border-2 border-purple-300 bg-white hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium text-purple-700 transition-all hover:border-purple-500"
                          >
                            ↓ Bajar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {questionError && (
                <p className="mt-3 text-sm font-semibold text-red-600">{questionError}</p>
              )}
            </div>

            <div className="flex gap-4 pt-6 border-t">
              <button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="flex-1 px-4 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 disabled:bg-gray-200 disabled:text-gray-400 font-semibold transition-all"
              >
                Anterior
              </button>

              {currentQuestionIndex === totalQuestions - 1 ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold transition-all"
                >
                  {submitting ? 'Enviando...' : 'Enviar Quiz'}
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-all"
                >
                  Siguiente
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
