
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const parseThemeValue = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
};

const shuffleOrder = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatSeconds = (value) => {
  if (value === null || value === undefined) return '--:--';
  const total = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatMsAsCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function FormPublicView() {
  const { public_id } = useParams();
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formTheme, setFormTheme] = useState({
    primary: '#2563eb',
    accent: '#14b8a6',
    surface: '#ffffff',
    bgFrom: '#f8fbff',
    bgTo: '#e8f1ff',
    coverImage: '',
  });
  const [responses, setResponses] = useState({});
  const [rankingDrag, setRankingDrag] = useState({ questionId: null, fromIndex: null });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitMsg, setSubmitMsg] = useState('');
  const [strictStep, setStrictStep] = useState(0);
  const [strictStarted, setStrictStarted] = useState(false);
  const [strictSession, setStrictSession] = useState(null);
  const [strictSubmissionId, setStrictSubmissionId] = useState(null);
  const [strictDurationRemaining, setStrictDurationRemaining] = useState(null);
  const [strictDurationActive, setStrictDurationActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [strictWarningCount, setStrictWarningCount] = useState(0);
  const [strictSuspiciousEvents, setStrictSuspiciousEvents] = useState([]);
  const [strictNowMs, setStrictNowMs] = useState(Date.now());
  const [strictReturnCountdown, setStrictReturnCountdown] = useState(null);
  const [strictReturnCountdownActive, setStrictReturnCountdownActive] = useState(false);
  const strictLastEventRef = useRef(0);
  const wakeLockRef = useRef(null);

  // Handler para actualizar respuestas
  const handleResponse = (qid, value) => {
    setResponses((prev) => ({ ...prev, [qid]: value }));
    setFieldErrors((prev) => {
      if (!prev[qid]) return prev;
      const next = { ...prev };
      delete next[qid];
      return next;
    });
  };

  const isQuestionRequired = (question) => {
    if (!question.required) return false;

    if (!question.required_condition_enabled || !question.required_condition_question_id) {
      return true;
    }

    const baseResponse = responses[question.required_condition_question_id];
    const conditionValue = String(question.required_condition_value ?? '').trim();
    const operator = question.required_condition_operator || '=';

    if (operator === 'contains') {
      if (Array.isArray(baseResponse)) {
        return baseResponse.map(String).includes(conditionValue);
      }
      return String(baseResponse ?? '').includes(conditionValue);
    }

    if (operator === '!=') {
      return String(baseResponse ?? '').trim() !== conditionValue;
    }

    return String(baseResponse ?? '').trim() === conditionValue;
  };

  const isResponseEmpty = (question, response) => {
    if (response === null || response === undefined) return true;

    if (question.type === 'multiple_choice' || question.type === 'checkboxes') {
      return !Array.isArray(response) || response.length === 0;
    }

    if (question.type === 'choice_unique' || question.type === 'dropdown') {
      return response === '' || response === null || response === undefined;
    }

    if (question.type === 'ranking') {
      return !Array.isArray(response) || response.length === 0;
    }

    if (typeof response === 'string') {
      return response.trim() === '';
    }

    return false;
  };

  // Handler para checkboxes
  const handleCheckbox = (qid, idx) => {
    const arr = Array.isArray(responses[qid]) ? [...responses[qid]] : [];
    if (arr.includes(idx)) {
      handleResponse(qid, arr.filter(i => i !== idx));
    } else {
      handleResponse(qid, [...arr, idx]);
    }
  };

  const getNormalizedRankingOrder = (qid, opts) => {
    const defaultOrder = (opts || []).map((_, i) => i);
    const current = Array.isArray(responses[qid]) ? responses[qid] : defaultOrder;
    const valid = current.filter((value) => Number.isInteger(value) && value >= 0 && value < defaultOrder.length);
    const missing = defaultOrder.filter((value) => !valid.includes(value));
    return [...valid, ...missing];
  };

  // Handler para ranking
  const handleRankingMove = (qid, pos, dir, opts) => {
    const arr = getNormalizedRankingOrder(qid, opts);
    const next = pos + dir;
    if (next < 0 || next >= arr.length) return;
    [arr[pos], arr[next]] = [arr[next], arr[pos]];
    handleResponse(qid, arr);
  };

  const handleRankingDragStart = (qid, fromIndex) => {
    setRankingDrag({ questionId: qid, fromIndex });
  };

  const handleRankingDragOver = (event) => {
    event.preventDefault();
  };

  const handleRankingDrop = (qid, toIndex, opts) => {
    const { questionId, fromIndex } = rankingDrag;
    if (questionId !== qid || fromIndex === null) return;

    const arr = getNormalizedRankingOrder(qid, opts);
    if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) {
      setRankingDrag({ questionId: null, fromIndex: null });
      return;
    }

    if (fromIndex === toIndex) {
      setRankingDrag({ questionId: null, fromIndex: null });
      return;
    }

    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    handleResponse(qid, arr);
    setRankingDrag({ questionId: null, fromIndex: null });
  };

  const handleRankingDragEnd = () => {
    setRankingDrag({ questionId: null, fromIndex: null });
  };

  const validateRequiredQuestion = (question) => {
    if (!question) return true;
    if (!isQuestionRequired(question)) return true;

    if (isResponseEmpty(question, responses[question.id])) {
      setFieldErrors((prev) => ({ ...prev, [question.id]: 'Esta pregunta es obligatoria.' }));
      setSubmitMsg('Completa la pregunta obligatoria antes de continuar.');
      return false;
    }

    return true;
  };

  const registerStrictSuspiciousEvent = (reason) => {
    const now = Date.now();
    if (now - strictLastEventRef.current < 1200) return;
    strictLastEventRef.current = now;

    setStrictWarningCount((current) => current + 1);
    setStrictSuspiciousEvents((current) => {
      const next = [...current, { reason, at: new Date().toISOString() }];
      if (next.length > 200) return next.slice(next.length - 200);
      return next;
    });
    setSubmitMsg('Actividad sospechosa detectada. Se registrara y se reportara al propietario del formulario.');
  };

  const beginStrictReturnCountdown = () => {
    setStrictReturnCountdown((current) => (current === null ? 30 : current));
    setStrictReturnCountdownActive(true);
  };

  const pauseStrictReturnCountdown = () => {
    setStrictReturnCountdownActive(false);
  };

  const getStrictReasonLabel = (reason) => {
    const labels = {
      tab_hidden: 'Salio de la pestana',
      window_blur: 'Perdio foco de la ventana',
      fullscreen_exit: 'Salio de pantalla completa',
      return_timeout: 'No regreso dentro de 30 segundos',
      context_menu_blocked: 'Intento de click derecho',
      copy_blocked: 'Intento de copiar',
      paste_blocked: 'Intento de pegar',
      ctrl_c_blocked: 'Intento de Ctrl+C',
      ctrl_v_blocked: 'Intento de Ctrl+V',
      cut_blocked: 'Intento de cortar',
      print_screen_detected: 'Intento de Print Screen',
      select_text_blocked: 'Intento de seleccionar texto',
      ctrl_x_blocked: 'Intento de Ctrl+X',
      ctrl_a_blocked: 'Intento de Ctrl+A',
      ctrl_p_blocked: 'Intento de Ctrl+P',
      ctrl_s_blocked: 'Intento de Ctrl+S',
      ctrl_u_blocked: 'Intento de Ctrl+U',
      f12_blocked: 'Intento de abrir DevTools (F12)',
      beforeunload_attempt: 'Intento de cerrar o recargar la pagina',
      keyboard_lock_request_failed: 'No se pudo activar keyboard lock',
      wake_lock_request_failed: 'No se pudo activar wake lock',
    };
    return labels[reason] || reason;
  };

  const requestWakeLock = async () => {
    try {
      if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) return;
      if (wakeLockRef.current) return;
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      registerStrictSuspiciousEvent('wake_lock_request_failed');
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }
    } catch {
      // no-op
    } finally {
      wakeLockRef.current = null;
    }
  };

  const requestKeyboardLock = async () => {
    try {
      if (!('keyboard' in navigator) || !navigator.keyboard?.lock) return;
      await navigator.keyboard.lock([
        'Escape',
        'Tab',
        'MetaLeft',
        'MetaRight',
        'AltLeft',
        'AltRight',
      ]);
    } catch {
      registerStrictSuspiciousEvent('keyboard_lock_request_failed');
    }
  };

  const releaseKeyboardLock = () => {
    try {
      if ('keyboard' in navigator && navigator.keyboard?.unlock) {
        navigator.keyboard.unlock();
      }
    } catch {
      // no-op
    }
  };

  const startStrictSession = async () => {
    const strictConfig = form?.strict_config && typeof form.strict_config === 'object' ? form.strict_config : {};
    const durationEnabled = Boolean(strictConfig.duration_enabled);
    const durationMinutes = Math.max(1, Number(strictConfig.duration_minutes) || 0);
    const windowEnabled = Boolean(strictConfig.window_enabled);
    const startsAt = toValidDate(strictConfig.starts_at || form?.opened_at);
    const endsAt = toValidDate(strictConfig.ends_at || form?.closed_at);
    const requiresAuth = Boolean(strictConfig.require_auth || durationEnabled);
    const now = new Date();

    if (windowEnabled) {
      if (startsAt && now < startsAt) {
        setSubmitMsg(`El examen aun no inicia. Disponible desde ${startsAt.toLocaleString()}.`);
        return;
      }
      if (endsAt && now > endsAt) {
        setSubmitMsg('El examen ya finalizo por fecha de cierre.');
        return;
      }
    }

    let activeSession = null;
    if (requiresAuth) {
      const { data: sessionData } = await supabase.auth.getSession();
      const userSession = sessionData?.session || null;
      if (!userSession?.user?.id) {
        setSubmitMsg('Debes iniciar sesion para responder este examen en modo estricto.');
        return;
      }
      activeSession = userSession;
      setStrictSession(userSession);
    }

    if (durationEnabled && durationMinutes > 0) {
      if (!activeSession?.user?.id) {
        setSubmitMsg('La duracion por usuario requiere cuenta logueada.');
        return;
      }

      const durationSeconds = durationMinutes * 60;
      const { data: inProgressRows, error: inProgressError } = await supabase
        .from('form_submissions')
        .select('id, started_at')
        .eq('form_id', form.id)
        .eq('respondent_user_id', activeSession.user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1);

      if (inProgressError) {
        setSubmitMsg('No se pudo iniciar el examen (error de sesion).');
        return;
      }

      if (Array.isArray(inProgressRows) && inProgressRows.length > 0) {
        const existing = inProgressRows[0];
        const startedAt = toValidDate(existing.started_at);
        const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)) : 0;
        const remaining = Math.max(0, durationSeconds - elapsed);
        if (remaining <= 0) {
          setSubmitMsg('Tu tiempo de examen ya termino para este intento.');
          return;
        }
        setStrictSubmissionId(existing.id);
        setStrictDurationRemaining(remaining);
        setStrictDurationActive(true);
      } else {
        const startedAtIso = new Date().toISOString();
        const { data: createdSubmission, error: createdError } = await supabase
          .from('form_submissions')
          .insert([
            {
              form_id: form.id,
              respondent_user_id: activeSession.user.id,
              status: 'in_progress',
              started_at: startedAtIso,
              submitted_at: null,
              warnings: strictWarningCount,
              meta: {
                strict_mode: true,
                strict_duration_seconds: durationSeconds,
              },
            },
          ])
          .select('id')
          .single();

        if (createdError || !createdSubmission) {
          setSubmitMsg('No se pudo crear el intento del examen.');
          return;
        }

        setStrictSubmissionId(createdSubmission.id);
        setStrictDurationRemaining(durationSeconds);
        setStrictDurationActive(true);
      }
    } else {
      setStrictSubmissionId(null);
      setStrictDurationRemaining(null);
      setStrictDurationActive(false);
    }

    setStrictStarted(true);
    setStrictStep(0);
    setSubmitMsg('');

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setSubmitMsg('No se pudo activar pantalla completa automaticamente. Puedes continuar.');
    }

    await requestWakeLock();
    await requestKeyboardLock();
  };

  // Enviar respuestas (real)
  const handleSubmit = async () => {
    if (submitting) return;
    const nextErrors = {};

    for (const question of questions) {
      if (isQuestionRequired(question) && isResponseEmpty(question, responses[question.id])) {
        nextErrors[question.id] = 'Esta pregunta es obligatoria.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSubmitMsg('Completa las preguntas obligatorias antes de enviar.');
      return;
    }

    setFieldErrors({});
    setSubmitMsg('Enviando...');
    setSubmitting(true);
    try {
      const submittedAtIso = new Date().toISOString();
      let submission = null;

      if (strictSubmissionId) {
        const { data: updatedSubmission, error: updateError } = await supabase
          .from('form_submissions')
          .update({
            status: 'submitted',
            submitted_at: submittedAtIso,
            warnings: strictWarningCount,
            meta: {
              strict_mode: form?.form_mode === 'strict',
              suspicious_warnings: strictWarningCount,
              suspicious_events: strictSuspiciousEvents,
            },
          })
          .eq('id', strictSubmissionId)
          .select()
          .single();

        if (updateError || !updatedSubmission) {
          setSubmitMsg('Error al cerrar el intento del examen.');
          return;
        }
        submission = updatedSubmission;
      } else {
        const submissionPayload = {
          form_id: form.id,
          respondent_user_id: strictSession?.user?.id || null,
          status: 'submitted',
          started_at: new Date().toISOString(),
          submitted_at: submittedAtIso,
          warnings: strictWarningCount,
          meta: {
            strict_mode: form?.form_mode === 'strict',
            suspicious_warnings: strictWarningCount,
            suspicious_events: strictSuspiciousEvents,
          },
        };

        const { data: createdSubmission, error: submError } = await supabase
          .from('form_submissions')
          .insert([submissionPayload])
          .select()
          .single();

        if (submError || !createdSubmission) {
          setSubmitMsg('Error al guardar el envío.');
          return;
        }
        submission = createdSubmission;
      }

      // 2. Insertar respuestas por pregunta
      const answersPayload = questions.map(q => ({
        submission_id: submission.id,
        question_id: q.id,
        answer_value: JSON.stringify(responses[q.id] ?? null),
        // is_correct: null, // Se puede calcular después si es quiz
        points_earned: 0,
      }));
      const { error: ansError } = await supabase
        .from('form_submission_answers')
        .insert(answersPayload);
      if (ansError) {
        setSubmitMsg('Error al guardar respuestas.');
        return;
      }

      await releaseWakeLock();
      releaseKeyboardLock();
      setStrictDurationActive(false);
      setSubmitMsg('¡Respuestas enviadas correctamente!');
    } catch (e) {
      setSubmitMsg('Error inesperado al enviar.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    async function fetchForm() {
      setLoading(true);
      const { data: payload, error: payloadError } = await supabase
        .rpc('get_public_form_for_response', { p_public_id: public_id });

      if (payloadError || !payload?.form) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const formData = payload.form;
      const sectionsData = Array.isArray(payload.sections) ? payload.sections : [];
      const questionsData = Array.isArray(payload.questions) ? payload.questions : [];

      setForm(formData);
      const parsedTheme = parseThemeValue(formData.theme);
      setFormTheme((theme) => ({
        ...theme,
        ...parsedTheme,
        coverImage: parsedTheme.coverImage || formData.cover_image_url || '',
      }));

      setSections(sectionsData || []);

      // Mapear preguntas con opciones
      const questionsWithOptions = (questionsData || []).map(q => ({
        ...q,
        options: (q.options || [])
          .sort((a, b) => a.position - b.position)
          .map(opt => opt.label),
      }));
      setQuestions(questionsWithOptions);

      // Inicializa ranking mezclado para que el usuario ordene desde un estado aleatorio.
      setResponses((prev) => {
        const next = { ...prev };
        for (const question of questionsWithOptions) {
          if (question.type !== 'ranking') continue;
          if (Array.isArray(next[question.id]) && next[question.id].length > 0) continue;
          const baseOrder = (question.options || []).map((_, i) => i);
          next[question.id] = shuffleOrder(baseOrder);
        }
        return next;
      });

      setLoading(false);
    }
    fetchForm();
  }, [public_id]);

  useEffect(() => {
    setStrictStep(0);
    setStrictStarted(false);
    setStrictSession(null);
    setStrictSubmissionId(null);
    setStrictDurationRemaining(null);
    setStrictDurationActive(false);
    setStrictWarningCount(0);
    setStrictSuspiciousEvents([]);
    setStrictReturnCountdown(null);
    setStrictReturnCountdownActive(false);
    strictLastEventRef.current = 0;
    releaseWakeLock();
    releaseKeyboardLock();
  }, [public_id, questions.length, form?.form_mode]);

  useEffect(() => {
    const isStrictMode = form?.form_mode === 'strict';
    if (!isStrictMode || !strictStarted) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        registerStrictSuspiciousEvent('tab_hidden');
        beginStrictReturnCountdown();
      } else {
        pauseStrictReturnCountdown();
      }
    };

    const onWindowBlur = () => {
      registerStrictSuspiciousEvent('window_blur');
      beginStrictReturnCountdown();
    };

    const onWindowFocus = () => {
      pauseStrictReturnCountdown();
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        registerStrictSuspiciousEvent('fullscreen_exit');
        beginStrictReturnCountdown();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [form?.form_mode, strictStarted]);

  useEffect(() => {
    const isStrictModeActive = form?.form_mode === 'strict' && strictStarted;
    if (!isStrictModeActive) return;

    const onBeforeUnload = (event) => {
      registerStrictSuspiciousEvent('beforeunload_attempt');
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [form?.form_mode, strictStarted]);

  useEffect(() => {
    const isStrictModeActive = form?.form_mode === 'strict' && strictStarted;
    if (!isStrictModeActive) return;

    requestWakeLock();
    requestKeyboardLock();

    const onVisibilityChange = () => {
      if (!document.hidden) {
        requestWakeLock();
        requestKeyboardLock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseWakeLock();
      releaseKeyboardLock();
    };
  }, [form?.form_mode, strictStarted]);

  useEffect(() => {
    const strictModeActive = form?.form_mode === 'strict' && strictStarted;
    if (!strictModeActive) return;

    const onContextMenu = (event) => {
      event.preventDefault();
      registerStrictSuspiciousEvent('context_menu_blocked');
    };

    const onCopy = (event) => {
      event.preventDefault();
      registerStrictSuspiciousEvent('copy_blocked');
    };

    const onPaste = (event) => {
      event.preventDefault();
      registerStrictSuspiciousEvent('paste_blocked');
    };

    const onCut = (event) => {
      event.preventDefault();
      registerStrictSuspiciousEvent('cut_blocked');
    };

    const onSelectStart = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      event.preventDefault();
      registerStrictSuspiciousEvent('select_text_blocked');
    };

    const onKeyDown = (event) => {
      const key = String(event.key || '').toLowerCase();
      const hasCtrl = event.ctrlKey || event.metaKey;

      if (hasCtrl && key === 'c') {
        event.preventDefault();
        registerStrictSuspiciousEvent('ctrl_c_blocked');
        return;
      }

      if (hasCtrl && key === 'v') {
        event.preventDefault();
        registerStrictSuspiciousEvent('ctrl_v_blocked');
        return;
      }

      if (hasCtrl && key === 'x') {
        event.preventDefault();
        registerStrictSuspiciousEvent('ctrl_x_blocked');
        return;
      }

      if (hasCtrl && key === 'a') {
        event.preventDefault();
        registerStrictSuspiciousEvent('ctrl_a_blocked');
        return;
      }

      if (hasCtrl && key === 'p') {
        event.preventDefault();
        registerStrictSuspiciousEvent('ctrl_p_blocked');
        return;
      }

      if (hasCtrl && key === 's') {
        event.preventDefault();
        registerStrictSuspiciousEvent('ctrl_s_blocked');
        return;
      }

      if (hasCtrl && key === 'u') {
        event.preventDefault();
        registerStrictSuspiciousEvent('ctrl_u_blocked');
        return;
      }

      if (event.key === 'F12') {
        event.preventDefault();
        registerStrictSuspiciousEvent('f12_blocked');
        return;
      }

      if (event.key === 'PrintScreen' || event.code === 'PrintScreen') {
        registerStrictSuspiciousEvent('print_screen_detected');
      }
    };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('cut', onCut);
    document.addEventListener('selectstart', onSelectStart);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('selectstart', onSelectStart);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [form?.form_mode, strictStarted]);

  useEffect(() => {
    if (!strictReturnCountdownActive || strictReturnCountdown === null) return;

    const timer = setInterval(() => {
      setStrictReturnCountdown((current) => {
        if (current === null) return null;

        const next = Math.max(0, current - 1);
        if (next <= 0) {
          setStrictReturnCountdownActive(false);
          registerStrictSuspiciousEvent('return_timeout');
          setSubmitMsg('No regresaste a tiempo. Evento sospechoso adicional registrado.');
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [strictReturnCountdownActive, strictReturnCountdown]);

  useEffect(() => {
    if (!strictDurationActive || strictDurationRemaining === null) return;

    const timer = setInterval(() => {
      setStrictDurationRemaining((current) => {
        if (current === null) return null;
        const next = Math.max(0, current - 1);
        if (next <= 0) {
          setStrictDurationActive(false);
          setSubmitMsg('Se agoto el tiempo del examen. Se enviara automaticamente.');
          setTimeout(() => {
            handleSubmit();
          }, 0);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [strictDurationActive, strictDurationRemaining]);

  useEffect(() => {
    if (form?.form_mode !== 'strict') return;
    const timer = setInterval(() => {
      setStrictNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [form?.form_mode]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white bg-black">Cargando formulario...</div>;
  if (notFound) return <div className="min-h-screen flex items-center justify-center text-white bg-black">Formulario no encontrado</div>;

  // Agrupar preguntas por sección
  const questionsBySection = sections.map(section => ({
    ...section,
    questions: questions.filter(q => q.section_id === section.id)
  }));

  const isStrictMode = form?.form_mode === 'strict';
  const strictConfig = form?.strict_config && typeof form.strict_config === 'object' ? form.strict_config : {};
  const strictDurationEnabled = Boolean(strictConfig.duration_enabled);
  const strictDurationMinutes = Math.max(1, Number(strictConfig.duration_minutes) || 0);
  const strictWindowEnabled = Boolean(strictConfig.window_enabled);
  const strictStartsAt = toValidDate(strictConfig.starts_at || form?.opened_at);
  const strictEndsAt = toValidDate(strictConfig.ends_at || form?.closed_at);
  const strictNow = new Date(strictNowMs);
  const strictWindowStatus = !strictWindowEnabled
    ? 'no_window'
    : strictStartsAt && strictNow < strictStartsAt
      ? 'not_started'
      : strictEndsAt && strictNow > strictEndsAt
        ? 'finished'
        : 'in_progress';
  const strictTimeUntilStartMs = strictWindowStatus === 'not_started' && strictStartsAt
    ? Math.max(0, strictStartsAt.getTime() - strictNow.getTime())
    : 0;
  const strictWindowRemainingMs = strictWindowEnabled && strictEndsAt && strictWindowStatus === 'in_progress'
    ? Math.max(0, strictEndsAt.getTime() - strictNow.getTime())
    : null;
  const strictCanStartNow = strictWindowStatus !== 'not_started' && strictWindowStatus !== 'finished';
  const strictSessionActive = isStrictMode && strictStarted;
  const strictQuestionCount = questions.length;
  const safeStrictStep = strictQuestionCount > 0 ? Math.min(strictStep, strictQuestionCount - 1) : 0;
  const strictQuestion = strictQuestionCount > 0 ? questions[safeStrictStep] : null;
  const strictSection = sections.find((section) => section.id === strictQuestion?.section_id) || null;
  const strictProgress = strictQuestionCount > 0 ? Math.round(((safeStrictStep + 1) / strictQuestionCount) * 100) : 0;

  const sectionsToRender = strictSessionActive
    ? [{
        id: strictSection?.id || 'strict-section',
        title: strictSection?.title || 'Pregunta',
        description: strictSection?.description || `Pregunta ${safeStrictStep + 1} de ${strictQuestionCount}`,
        questions: strictQuestion ? [strictQuestion] : [],
      }]
    : (isStrictMode ? [] : questionsBySection);

  return (
    <main
      className={`min-h-screen ${strictSessionActive ? 'select-none' : ''}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${formTheme.bgFrom}, ${formTheme.bgTo})`,
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full" style={{backgroundColor: formTheme.primary, opacity: 0.12, filter: 'blur(48px)'}} />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full" style={{backgroundColor: formTheme.accent, opacity: 0.12, filter: 'blur(48px)'}} />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full" style={{backgroundColor: formTheme.surface, opacity: 0.12, filter: 'blur(48px)'}} />
      </div>
      <div className={strictSessionActive ? 'mx-auto min-h-screen w-full max-w-6xl py-6 px-4' : 'max-w-3xl mx-auto py-10 px-4'}>
        {formTheme.coverImage ? (
          <div className="mb-5 overflow-hidden rounded-xl border border-gray-200">
            <img src={formTheme.coverImage} alt="Portada del formulario" className="h-44 w-full object-cover" />
          </div>
        ) : null}
        <h1 className="text-3xl font-bold mb-2" style={{color: formTheme.primary}}>{form.title}</h1>
        <p className="mb-6 text-gray-600">{form.description}</p>
        {isStrictMode && !strictStarted ? (
          <section className="mb-8 rounded-2xl border border-red-200 bg-white/90 p-6 shadow">
            <h2 className="text-xl font-bold text-red-700">Modo estricto</h2>
            {strictWindowStatus === 'not_started' ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                Este examen aun no ha comenzado. Inicia en {formatMsAsCountdown(strictTimeUntilStartMs)}.
              </div>
            ) : null}
            {strictWindowStatus === 'in_progress' ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                Estado: En curso.
              </div>
            ) : null}
            {strictWindowStatus === 'finished' ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                Este examen ya finalizo.
              </div>
            ) : null}
            <p className="mt-3 text-sm text-gray-700">Asegurate de no salir de esta pestana durante el examen.</p>
            <p className="mt-2 text-sm text-gray-700">Cualquier actividad sospechosa se detectara y se mandara al propietario del formulario.</p>
            <p className="mt-2 text-sm text-gray-700">Al comenzar, se intentara activar pantalla completa.</p>
            {strictDurationEnabled ? (
              <p className="mt-2 text-sm font-semibold text-amber-700">Duracion por usuario: {strictDurationMinutes} min (por cuenta logueada).</p>
            ) : null}
            {strictWindowEnabled ? (
              <p className="mt-2 text-sm text-gray-700">
                Ventana habilitada: {strictStartsAt ? strictStartsAt.toLocaleString() : 'sin inicio'} - {strictEndsAt ? strictEndsAt.toLocaleString() : 'sin fin'}
              </p>
            ) : null}
            <button
              type="button"
              onClick={startStrictSession}
              disabled={!strictCanStartNow}
              className="mt-5 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`}}
            >
              {strictWindowStatus === 'not_started' ? 'Aun no disponible' : strictWindowStatus === 'finished' ? 'Examen finalizado' : 'Iniciar examen'}
            </button>
          </section>
        ) : null}

        {strictSessionActive ? (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white/80 p-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Modo estricto</span>
              <span>{safeStrictStep + 1} / {strictQuestionCount || 1}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full transition-all"
                style={{
                  width: `${strictProgress}%`,
                  backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`,
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Advertencias: {strictWarningCount}</span>
              {strictDurationRemaining !== null ? (
                <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Tiempo restante: {formatSeconds(strictDurationRemaining)}</span>
              ) : null}
              {strictWindowRemainingMs !== null ? (
                <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                  Ventana global restante: {formatMsAsCountdown(strictWindowRemainingMs)}
                </span>
              ) : null}
              {Array.from({ length: Math.min(strictWarningCount, 12) }, (_, idx) => (
                <span key={`strict-warn-${idx}`} className="rounded-md border border-red-300 bg-white px-2 py-0.5 text-xs font-bold text-red-700">[!]</span>
              ))}
            </div>

            {strictReturnCountdown !== null ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                {strictReturnCountdownActive
                  ? `Tienes ${strictReturnCountdown}s para volver a esta pantalla.`
                  : `Temporizador en pausa: ${strictReturnCountdown}s restantes.`}
              </div>
            ) : null}

            <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Logs de actividad sospechosa</p>
              {strictSuspiciousEvents.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">Sin eventos detectados.</p>
              ) : (
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-gray-700">
                  {[...strictSuspiciousEvents].slice(-8).reverse().map((event, index) => (
                    <li key={`${event.at}-${event.reason}-${index}`} className="rounded border border-red-100 bg-red-50 px-2 py-1">
                      [!] {new Date(event.at).toLocaleTimeString()} - {getStrictReasonLabel(event.reason)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {sectionsToRender.map((section, idx) => (
          <section key={section.id} className="mb-8">
            <h2 className="text-xl font-semibold mb-2" style={{color: formTheme.accent}}>{section.title}</h2>
            <p className="mb-2 text-gray-500">{section.description}</p>
            <div className="space-y-6">
              {section.questions.map(question => (
                <div key={question.id} className="p-4 rounded-2xl shadow border border-gray-100" style={{backgroundColor: formTheme.surface}}>
                  <div className="font-medium mb-1 text-gray-900">
                    {question.title}
                    {isQuestionRequired(question) ? <span className="ml-1 text-red-600">*</span> : null}
                  </div>
                  <div className="text-sm text-gray-500 mb-2">{question.description}</div>
                  {/* Renderizado de todos los tipos */}
                  {question.type === 'short_answer' && (
                    <input className="w-full border rounded px-3 py-2" type="text" placeholder="Respuesta corta"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'paragraph' && (
                    <textarea className="w-full border rounded px-3 py-2" rows={3} placeholder="Respuesta larga"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'number' && (
                    <input className="w-full border rounded px-3 py-2" type="number" placeholder="123"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'email' && (
                    <input className="w-full border rounded px-3 py-2" type="email" placeholder="correo@ejemplo.com"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'url' && (
                    <input className="w-full border rounded px-3 py-2" type="url" placeholder="https://..."
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'phone' && (
                    <input className="w-full border rounded px-3 py-2" type="tel" placeholder="Teléfono"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'date' && (
                    <input className="w-full border rounded px-3 py-2" type="date"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'time' && (
                    <input className="w-full border rounded px-3 py-2" type="time"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'multiple_choice' && (
                    <div className="space-y-1">
                      {(question.options || []).map((opt, idx) => (
                        <label key={idx} className="flex items-center gap-2">
                          <input type="checkbox" checked={Array.isArray(responses[question.id]) && responses[question.id].includes(idx)}
                            onChange={() => handleCheckbox(question.id, idx)} /> {opt || `Opción ${idx + 1}`}
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === 'checkboxes' && (
                    <div className="space-y-1">
                      {(question.options || []).map((opt, idx) => (
                        <label key={idx} className="flex items-center gap-2">
                          <input type="checkbox" checked={Array.isArray(responses[question.id]) && responses[question.id].includes(idx)}
                            onChange={() => handleCheckbox(question.id, idx)} /> {opt || `Opción ${idx + 1}`}
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === 'dropdown' && (
                    <select className="w-full border rounded px-3 py-2"
                      value={responses[question.id] ?? ''}
                      onChange={e => handleResponse(question.id, Number(e.target.value))}>
                      <option value="" disabled>Selecciona una opción</option>
                      {(question.options || []).map((opt, idx) => (
                        <option key={idx} value={idx}>{opt || `Opción ${idx + 1}`}</option>
                      ))}
                    </select>
                  )}
                  {question.type === 'choice_unique' && (
                    <div className="space-y-2">
                      {(question.options || []).map((opt, idx) => (
                        <label key={idx} className="flex items-center gap-2">
                          <input type="radio" name={`choice-${question.id}`} checked={Number(responses[question.id]) === idx}
                            onChange={() => handleResponse(question.id, idx)} /> {opt || `Opción ${idx + 1}`}
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === 'linear_scale' && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Bajo</span><span>Alto</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {Array.from({ length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1 }, (_, i) => (question.scaleMin || 1) + i).map((val) => (
                          <label key={val} className="flex flex-col items-center gap-1 text-xs">
                            <input type="radio" name={`ls-${question.id}`} checked={responses[question.id] === val}
                              onChange={() => handleResponse(question.id, val)} />
                            {val}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {question.type === 'emoji_scale' && (
                    <div className="flex items-center gap-2 text-2xl">
                      {['😡','🙁','😐','🙂','😍'].slice(0, Math.min(5, question.scaleMax || 5)).map((emoji, idx) => {
                        const value = idx + 1;
                        const selected = responses[question.id] === value;
                        return (
                          <button key={value} type="button" onClick={() => handleResponse(question.id, value)}
                            className={`rounded-lg border px-2 py-1 transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>{emoji}</button>
                        );
                      })}
                    </div>
                  )}
                  {question.type === 'star_rating' && (
                    <div className="flex items-center gap-1 text-2xl text-amber-400">
                      {Array.from({ length: Math.min(10, question.scaleMax || 5) }, (_, idx) => {
                        const value = idx + 1;
                        const selected = (responses[question.id] || 0) >= value;
                        return (
                          <button key={value} type="button" onClick={() => handleResponse(question.id, value)}
                            className={selected ? 'opacity-100' : 'opacity-40'}>★</button>
                        );
                      })}
                    </div>
                  )}
                  {question.type === 'ranking' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Arrastra y suelta para reordenar.</p>
                      {(() => {
                        const order = getNormalizedRankingOrder(question.id, question.options);

                        return order.map((optIdx, pos, arr) => (
                        <div
                          key={optIdx}
                          draggable
                          onDragStart={() => handleRankingDragStart(question.id, pos)}
                          onDragOver={handleRankingDragOver}
                          onDrop={() => handleRankingDrop(question.id, pos, question.options)}
                          onDragEnd={handleRankingDragEnd}
                          className="flex cursor-grab items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 active:cursor-grabbing"
                        >
                          <span className="w-6 text-sm font-semibold text-gray-500">{pos + 1}</span>
                          <span className="flex-1 text-sm text-gray-700">{question.options[optIdx] || `Opción ${optIdx + 1}`}</span>
                          <button type="button" disabled={pos === 0} onClick={() => handleRankingMove(question.id, pos, -1, question.options)} className="rounded border border-gray-200 px-2 py-1 text-xs transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Subir</button>
                          <button type="button" disabled={pos === arr.length - 1} onClick={() => handleRankingMove(question.id, pos, 1, question.options)} className="rounded border border-gray-200 px-2 py-1 text-xs transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Bajar</button>
                        </div>
                      ))
                      })()}
                    </div>
                  )}
                  {fieldErrors[question.id] ? (
                    <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors[question.id]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
        {/* Navegación / Envío */}
        <div className="max-w-3xl mx-auto py-6 px-4">
          {strictSessionActive ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={safeStrictStep === 0 || submitting || (strictDurationRemaining !== null && strictDurationRemaining <= 0)}
                onClick={() => {
                  setSubmitMsg('');
                  setStrictStep((current) => Math.max(0, current - 1));
                }}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              {safeStrictStep < strictQuestionCount - 1 ? (
                <button
                  type="button"
                  disabled={submitting || (strictDurationRemaining !== null && strictDurationRemaining <= 0)}
                  onClick={() => {
                    if (!validateRequiredQuestion(strictQuestion)) return;
                    setSubmitMsg('');
                    setStrictStep((current) => Math.min(strictQuestionCount - 1, current + 1));
                  }}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`}}
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting || (strictDurationRemaining !== null && strictDurationRemaining <= 0)}
                  onClick={() => {
                    if (!validateRequiredQuestion(strictQuestion)) return;
                    handleSubmit();
                  }}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`}}
                >
                  Enviar respuestas
                </button>
              )}
            </div>
          ) : !isStrictMode ? (
            <button disabled={submitting} onClick={handleSubmit} className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-gray-300" style={{backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`}}>
              Enviar respuestas
            </button>
          ) : null}
          {submitMsg && (
            <div className={`mt-3 font-semibold ${Object.keys(fieldErrors).length > 0 || submitMsg.toLowerCase().includes('error') ? 'text-red-700' : 'text-emerald-700'}`}>
              {submitMsg}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default FormPublicView;