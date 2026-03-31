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

const getChoicePalette = (index) => {
  const palette = [
    {
      bg: 'from-red-500/25 to-red-400/25',
      border: 'border-red-400/60',
      ring: 'ring-red-300/40',
      badge: 'bg-red-400 text-slate-950',
      selected: 'from-red-400/35 to-red-300/35 border-red-300',
    },
    {
      bg: 'from-blue-500/25 to-blue-400/25',
      border: 'border-blue-400/60',
      ring: 'ring-blue-300/40',
      badge: 'bg-blue-400 text-slate-950',
      selected: 'from-blue-400/35 to-blue-300/35 border-blue-300',
    },
    {
      bg: 'from-yellow-500/25 to-amber-400/25',
      border: 'border-amber-400/60',
      ring: 'ring-amber-300/40',
      badge: 'bg-amber-400 text-slate-950',
      selected: 'from-yellow-400/35 to-amber-300/35 border-amber-300',
    },
    {
      bg: 'from-green-500/25 to-emerald-400/25',
      border: 'border-green-400/60',
      ring: 'ring-green-300/40',
      badge: 'bg-green-400 text-slate-950',
      selected: 'from-green-400/35 to-emerald-300/35 border-green-300',
    },
  ];

  return palette[index % palette.length];
};

const FaceScaleIcon = ({ level, active }) => {
  const mouth = {
    1: 'M 9 15 Q 12 13 15 15',
    2: 'M 9 14.5 Q 12 13.8 15 14.5',
    3: 'M 9 14.5 L 15 14.5',
    4: 'M 9 14 Q 12 15.2 15 14',
    5: 'M 9 13.6 Q 12 16 15 13.6',
  };

  return (
    <svg viewBox="0 0 24 24" className={`h-8 w-8 ${active ? 'text-blue-100' : 'text-slate-300'}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="9.5" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <path d={mouth[level] || mouth[3]} />
    </svg>
  );
};

const StatusIcon = ({ correct }) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {correct ? (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7v6" />
        <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
      </>
    )}
  </svg>
);

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
  const initialPreloadedDataRef = useRef(location.state?.preloadedQuizData || null);

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
          preloadedQuizData: location.state.preloadedQuizData || null,
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
      localStorage.setItem(
        QUIZ_PLAY_CONTEXT_KEY,
        JSON.stringify({
          sessionId: resolved.sessionId,
          participantId: resolved.participantId,
          formId: resolved.formId,
        }),
      );
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
    const lockBrowserBack = () => {
      window.history.pushState(null, '', window.location.href);
    };

    lockBrowserBack();

    const onPopState = () => {
      lockBrowserBack();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
    setQuestionError('Tiempo agotado. Puedes responder igual y continuar con Siguiente.');
  }, [questionTimeLeft, currentQuestionIndex, questions, timedOutQuestionIds, answers, finished]);

  const loadQuizData = async () => {
    try {
      const preloaded = playContext?.preloadedQuizData || initialPreloadedDataRef.current;
      const hasPreloaded = Boolean(preloaded?.form?.id === formId && Array.isArray(preloaded?.questions));

      if (hasPreloaded) {
        setFormData(preloaded.form);
        setQuestions(preloaded.questions);
        setLoading(false);
      } else {
        setLoading(true);
      }

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

      if (!hasPreloaded) {
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
      }

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

      console.log(`Respuesta guardada - Q:${questionId} | BasePts:${basePoints} | Descuento:${pointsPerSecond.toFixed(2)}/s | Tiempo:${elapsedSeconds}s | Final:${adjustedPoints}`);
    } catch (err) {
      console.error('Error guardando respuesta en vivo:', err);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    persistedAnswersRef.current[questionId] = false;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    setQuestionError('');
  };

  const handleNextQuestion = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const mustAnswer = currentQuestion.required !== false;
    if (mustAnswer && !hasAnswer(currentQuestion, answers)) {
      setQuestionError('Debes responder esta pregunta para continuar.');
      return;
    }

    if (hasAnswer(currentQuestion, answers)) {
      await persistAnswer(currentQuestion.id, answers[currentQuestion.id]);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setQuestionError('');
    }
  };

  const handlePreviousQuestion = () => {
    setQuestionError('No puedes volver a preguntas anteriores en este modo de juego.');
  };

  const handleSubmitQuiz = async (forceSubmit = false) => {
    try {
      const firstUnansweredIdx = questions.findIndex(
        (question) => question.required !== false && !hasAnswer(question, answers)
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
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin mb-5">
            <svg className="w-14 h-14 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-100 text-xl font-black tracking-wide">Preparando partida...</p>
          <p className="text-slate-400 text-sm mt-1">Sincronizando preguntas y puntaje en vivo</p>
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
      <div className="min-h-screen bg-black text-white px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="text-center border-b border-white/10 pb-8">
            <p className="text-sm uppercase tracking-[0.25em] text-blue-300">Partida finalizada</p>
            <h2 className="mt-2 text-5xl font-black tracking-tight">Resultados finales</h2>
            <p className="mt-3 text-slate-300">Buen juego. Aqui tienes tu rendimiento.</p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="py-4 text-center border-b border-blue-400/30">
              <p className="text-xs uppercase text-blue-200">Puesto</p>
              <p className="mt-1 text-4xl font-black">{finalResults?.participant_rank || '-'}</p>
              <p className="text-xs text-slate-400">de {finalResults?.total_participants || '-'}</p>
            </div>
            <div className="py-4 text-center border-b border-green-400/30">
              <p className="text-xs uppercase text-green-200">Puntaje</p>
              <p className="mt-1 text-4xl font-black">{Number(finalResults?.total_score || 0).toFixed(2)}</p>
              <p className="text-xs text-slate-400">de {Number(finalResults?.max_score || 0).toFixed(2)}</p>
            </div>
            <div className="py-4 text-center border-b border-amber-400/30">
              <p className="text-xs uppercase text-amber-200">Respondidas</p>
              <p className="mt-1 text-4xl font-black">{finalResults?.answered_count || 0}</p>
              <p className="text-xs text-slate-400">de {finalResults?.total_questions || 0}</p>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold mb-3">Top 3 final</h3>
            {topPlayers.length === 0 ? (
              <p className="text-sm text-slate-400">Aun no hay ranking disponible.</p>
            ) : (
              <div className="space-y-2">
                {topPlayers.map((player) => (
                  <div key={player.participant_id} className="flex items-center justify-between border-b border-white/10 py-3">
                    <p className="text-sm font-semibold text-slate-100">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/25 text-[11px] font-black text-blue-100">{player.rank}</span>
                      {player.participant_name || player.participant_email || 'Participante'}
                    </p>
                    <p className="text-sm font-bold text-blue-200">{Number(player.total_score || 0).toFixed(2)} pts</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-linear-to-r cursor-pointer from-blue-500 to-blue-600 text-white rounded-full hover:brightness-110 font-bold"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  const currentAllocatedSeconds = currentQuestion
    ? questionAllocatedSecondsRef.current[currentQuestion.id] || getQuestionAllocatedSeconds(currentQuestion)
    : null;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
      {scoreToast.visible && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[min(960px,calc(100%-24px))] -translate-x-1/2">
          <div className={`rounded-2xl border px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl ${
            scoreToast.isCorrect
              ? 'border-emerald-300/70 bg-linear-to-r from-emerald-500/30 to-green-500/20 text-emerald-50'
              : 'border-rose-300/70 bg-linear-to-r from-rose-500/30 to-red-500/20 text-rose-50'
          }`}>
            <div className="flex items-center gap-3">
              <StatusIcon correct={scoreToast.isCorrect} />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] opacity-90">Resultado</p>
                <p className="text-lg sm:text-xl font-black tracking-tight">{scoreToast.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-black text-white tracking-tight">{formData?.title}</h1>
            <div className={`px-4 py-2 rounded-full font-bold ${
              sessionStatus === 'in_progress'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                : 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
            }`}>
              {sessionStatus === 'in_progress' ? 'En progreso' : 'Finalizado'}
            </div>
          </div>
        </div>

        {currentQuestion && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-8 shadow-2xl mb-6 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-100 px-4 py-2 rounded-full text-sm font-bold border border-blue-400/40">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-black">
                    {currentQuestionIndex + 1}
                  </span>
                  Pregunta {currentQuestionIndex + 1} de {totalQuestions}
                </span>
                <span className="inline-block bg-white/10 text-slate-200 px-3 py-1 rounded-lg text-xs font-semibold capitalize border border-white/15">
                  {getQuestionTypeLabel(currentQuestion.type)}
                </span>
              </div>
              <div className="text-right flex items-center gap-2">
                {currentQuestion.required && <span className="text-rose-400 text-lg font-bold">*</span>}
                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border ${
                  Number(questionTimeLeft) <= 3
                    ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
                    : 'bg-blue-500/20 text-blue-100 border-blue-400/40'
                }`}>
                  Tiempo: {questionTimeLeft ?? currentAllocatedSeconds}s
                </span>
              </div>
            </div>

            <div className="mb-6 h-2 w-full rounded-full bg-slate-800 border border-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  Number(questionTimeLeft) <= 3
                    ? 'bg-linear-to-r from-red-500 to-red-400'
                    : 'bg-linear-to-r from-blue-500 to-blue-400'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, ((questionTimeLeft ?? currentAllocatedSeconds) / Math.max(1, currentAllocatedSeconds)) * 100))}%` }}
              />
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">{currentQuestion.title}</h2>
            {currentQuestion.description && (
              <p className="text-slate-300 mb-6">{currentQuestion.description}</p>
            )}

            {Number(questionTimeLeft) === 0 && (
              <div className="mb-6 rounded-xl border border-amber-300/50 bg-amber-500/15 px-4 py-3 text-amber-100 text-sm font-semibold">
                El tiempo llego a 0. Puedes seguir respondiendo y pasar cuando quieras con Siguiente.
              </div>
            )}

            <div className="mb-8">
              {currentQuestion.type === 'choice_unique' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQuestion.form_question_options?.map((option, index) => {
                    const style = getChoicePalette(index);
                    const isSelected = answers[currentQuestion.id] === option.id;
                    return (
                    <div
                      key={option.id}
                      onClick={() => handleAnswerChange(currentQuestion.id, option.id)}
                      className={`group flex items-center justify-between gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 bg-linear-to-br ${
                        isSelected
                          ? `${style.selected} ring-4 ${style.ring} shadow-[0_0_0_2px_rgba(255,255,255,0.18),0_18px_40px_rgba(15,23,42,0.55)] scale-[1.015]`
                          : `${style.bg} ${style.border} hover:scale-[1.01] hover:border-white/35`
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-9 w-9 rounded-lg font-black text-sm flex items-center justify-center ${style.badge}`}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className="font-extrabold tracking-tight text-slate-100 text-lg">
                          {option.label}
                        </span>
                      </div>
                      <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-white bg-white/90' : 'border-white/40 bg-transparent'}`}>
                        {isSelected ? <div className="h-3 w-3 rounded-full bg-slate-900" /> : null}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-3">
                  {currentQuestion.form_question_options?.map((option, index) => {
                    const style = getChoicePalette(index);
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
                        className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 bg-linear-to-br ${
                          isChecked
                            ? `${style.selected} ring-4 ${style.ring} shadow-[0_12px_30px_rgba(15,23,42,0.45)]`
                            : `${style.bg} ${style.border} hover:border-white/35`
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isChecked ? 'bg-white/90 border-white/90' : 'border-white/40'
                        }`}>
                          {isChecked && (
                            <svg className="w-4 h-4 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`ml-4 font-semibold transition-all ${isChecked ? 'text-white' : 'text-slate-100/90'}`}>
                          {option.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'checkboxes' && (
                <div className="space-y-3">
                  {currentQuestion.form_question_options?.map((option, index) => {
                    const style = getChoicePalette(index);
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
                        className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 bg-linear-to-br ${
                          isChecked
                            ? `${style.selected} ring-4 ${style.ring} shadow-[0_12px_30px_rgba(15,23,42,0.45)]`
                            : `${style.bg} ${style.border} hover:border-white/35`
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isChecked ? 'bg-white/90 border-white/90' : 'border-white/40'
                        }`}>
                          {isChecked && (
                            <svg className="w-4 h-4 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`ml-4 font-semibold transition-all ${isChecked ? 'text-white' : 'text-slate-100/90'}`}>
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
                  className="w-full px-4 py-3 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 bg-slate-900 text-slate-100 font-medium transition-all"
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
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium placeholder-slate-400 bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'paragraph' && (
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  rows="6"
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium placeholder-slate-400 resize-none bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'email' && (
                <input
                  type="email"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium placeholder-slate-400 bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'number' && (
                <input
                  type="number"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Ingresa un número..."
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium placeholder-slate-400 bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'phone' && (
                <input
                  type="tel"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Tu número de teléfono"
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium placeholder-slate-400 bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'url' && (
                <input
                  type="url"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="https://ejemplo.com"
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium placeholder-slate-400 bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'date' && (
                <input
                  type="date"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'time' && (
                <input
                  type="time"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  className="w-full px-5 py-4 border-2 border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all font-medium bg-slate-900 text-slate-100"
                />
              )}

              {currentQuestion.type === 'linear_scale' && (
                <div className="space-y-6">
                  <div className="flex justify-between mb-4 text-sm font-semibold text-slate-300">
                    <span className="flex-1 text-left">{currentQuestion.settings?.scale_min_label || 'Mínimo'}</span>
                    <span className="flex-1 text-right">{currentQuestion.settings?.scale_max_label || 'Máximo'}</span>
                  </div>
                  <input
                    type="range"
                    min={currentQuestion.settings?.scale_min || 1}
                    max={currentQuestion.settings?.scale_max || 10}
                    value={answers[currentQuestion.id] || currentQuestion.settings?.scale_min || 1}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="text-center p-4 bg-cyan-500/15 border-2 border-cyan-400/40 rounded-lg">
                    <p className="text-lg font-bold text-cyan-100">
                      Valor seleccionado: {answers[currentQuestion.id] || currentQuestion.settings?.scale_min || 1}
                    </p>
                  </div>
                </div>
              )}

              {currentQuestion.type === 'emoji_scale' && (
                <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = i + 1;
                    const isSelected = Number(answers[currentQuestion.id]) === value;
                    return (
                      <button
                        key={value}
                        onClick={() => handleAnswerChange(currentQuestion.id, value)}
                        className={`rounded-xl border-2 p-4 transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-300 bg-blue-500/25 ring-4 ring-blue-300/35 scale-[1.03]'
                            : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <FaceScaleIcon level={value} active={isSelected} />
                          <span className={`text-xs font-bold ${isSelected ? 'text-blue-100' : 'text-slate-300'}`}>{value}</span>
                        </div>
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
                            ? 'text-yellow-300 scale-110 drop-shadow-lg'
                            : 'text-slate-500 hover:text-yellow-300 hover:scale-105'
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
                  <div className="flex items-center gap-2 mb-6 p-4 bg-fuchsia-500/10 border-l-4 border-fuchsia-400 rounded-lg">
                    <svg className="w-5 h-5 text-fuchsia-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3z" />
                    </svg>
                    <p className="text-sm text-fuchsia-100 font-medium">Ordena de mayor a menor prioridad (arrastra o usa los botones)</p>
                  </div>
                  {getRankingOrder(currentQuestion, answers).map((optionId, idx, arr) => {
                    const option = (currentQuestion.form_question_options || []).find((opt) => opt.id === optionId);
                    return (
                      <div
                        key={optionId}
                        className="flex items-center gap-4 p-4 bg-linear-to-r from-fuchsia-500/20 to-slate-800 border-2 border-fuchsia-300/30 rounded-xl shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="shrink-0 w-10 h-10 bg-linear-to-br from-fuchsia-400 to-pink-500 text-slate-950 font-bold flex items-center justify-center rounded-full shadow-md">
                          {idx + 1}
                        </div>
                        <span className="flex-1 font-semibold text-slate-100 text-lg">{option?.label || 'Opción'}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleRankingMove(currentQuestion, idx, -1)}
                            className="rounded-lg border-2 border-fuchsia-300/40 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium text-fuchsia-100 transition-all"
                          >
                            ↑ Subir
                          </button>
                          <button
                            type="button"
                            disabled={idx === arr.length - 1}
                            onClick={() => handleRankingMove(currentQuestion, idx, 1)}
                            className="rounded-lg border-2 border-fuchsia-300/40 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium text-fuchsia-100 transition-all"
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
                <p className="mt-3 text-sm font-semibold text-rose-300">{questionError}</p>
              )}
            </div>

            <div className="flex gap-4 pt-6 border-t border-white/10">
              <button
                onClick={handlePreviousQuestion}
                disabled
                className="flex-1 px-4 py-3 bg-white/5 text-slate-500 rounded-lg font-semibold transition-all cursor-not-allowed"
              >
                Anterior bloqueado
              </button>

              {currentQuestionIndex === totalQuestions - 1 ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:brightness-110 disabled:opacity-60 font-semibold transition-all"
                >
                  {submitting ? 'Enviando...' : 'Enviar Quiz'}
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="flex-1 px-4 py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:brightness-110 font-semibold transition-all"
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
