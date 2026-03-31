
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

const hexToRgba = (hex, alpha = 1) => {
  if (!hex || typeof hex !== 'string') return `rgba(15, 23, 42, ${alpha})`;
  let normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    normalized = normalized.split('').map((char) => `${char}${char}`).join('');
  }
  if (normalized.length !== 6) return `rgba(15, 23, 42, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(15, 23, 42, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getLuminance = (hex) => {
  if (!hex || typeof hex !== 'string') return 0.2;
  let normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    normalized = normalized.split('').map((char) => `${char}${char}`).join('');
  }
  if (normalized.length !== 6) return 0.2;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return 0.2;
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
};

function FormPublicView() {
  const { public_id } = useParams();
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [blockedByQuizMode, setBlockedByQuizMode] = useState(false);
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
  const [strictSubmissionId, setStrictSubmissionId] = useState(null);
  const [strictDurationRemaining, setStrictDurationRemaining] = useState(null);
  const [strictDurationActive, setStrictDurationActive] = useState(false);
  const [strictStarting, setStrictStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [strictWarningCount, setStrictWarningCount] = useState(0);
  const [strictSuspiciousEvents, setStrictSuspiciousEvents] = useState([]);
  const [strictNowMs, setStrictNowMs] = useState(Date.now());
  const [strictReturnCountdown, setStrictReturnCountdown] = useState(null);
  const [strictReturnCountdownActive, setStrictReturnCountdownActive] = useState(false);
  const [strictSessionStartedAtMs, setStrictSessionStartedAtMs] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [alreadySubmittedAt, setAlreadySubmittedAt] = useState(null);
  const [completedView, setCompletedView] = useState(false);
  const strictLastEventRef = useRef(0);
  const wakeLockRef = useRef(null);
  const strictClosingRef = useRef(false);

  const checkUserAlreadySubmitted = async (formId, userId) => {
    if (!formId || !userId) return { hasSubmission: false, submittedAt: null };
    const { data, error } = await supabase
      .from('form_submissions')
      .select('id, submitted_at, created_at')
      .eq('form_id', formId)
      .eq('respondent_user_id', userId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) return { hasSubmission: false, submittedAt: null };
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return {
      hasSubmission: Boolean(row),
      submittedAt: row?.submitted_at || row?.created_at || null,
    };
  };

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

    let nextWarningCount = strictWarningCount + 1;
    setStrictWarningCount((current) => {
      nextWarningCount = current + 1;
      return nextWarningCount;
    });
    setStrictSuspiciousEvents((current) => {
      const next = [...current, { reason, at: new Date().toISOString() }];
      if (next.length > 200) return next.slice(next.length - 200);
      return next;
    });
    setSubmitMsg('Actividad sospechosa detectada. Se registrara y se reportara al propietario del formulario.');

    const severity = ['tab_hidden', 'window_blur', 'fullscreen_exit', 'return_timeout', 'beforeunload_attempt']
      .includes(reason)
      ? 'high'
      : 'medium';

    if (strictSubmissionId && form?.id) {
      supabase.from('strict_exam_events').insert({
        form_id: form.id,
        submission_id: strictSubmissionId,
        respondent_user_id: activeSession?.user?.id || null,
        question_index: strictStep + 1,
        warning_count: nextWarningCount,
        severity,
        reason,
      }).then(() => {}).catch(() => {});
    }
  };

  const upsertStrictLiveState = async (overrides = {}) => {
    if (!strictSubmissionId || !form?.id || !activeSession?.user?.id) return;

    const totalQuestions = Math.max(questions.length || 0, 1);
    const currentQuestion = Math.min(Math.max(strictStep + 1, 1), totalQuestions);
    const progressPercent = Math.round((currentQuestion / totalQuestions) * 100);
    const respondentLabel =
      activeSession?.user?.user_metadata?.full_name ||
      activeSession?.user?.user_metadata?.name ||
      activeSession?.user?.email ||
      `Usuario ${activeSession.user.id.slice(0, 8)}`;

    await supabase
      .from('strict_exam_live_state')
      .upsert(
        {
          submission_id: strictSubmissionId,
          form_id: form.id,
          respondent_user_id: activeSession.user.id,
          respondent_label: respondentLabel,
          current_question: currentQuestion,
          total_questions: totalQuestions,
          progress_percent: progressPercent,
          seconds_remaining: strictDurationRemaining,
          warning_count: strictWarningCount,
          is_active: true,
          ...overrides,
        },
        { onConflict: 'submission_id' },
      )
      .then(() => {})
      .catch(() => {});
  };

  const beginStrictReturnCountdown = () => {
    setStrictReturnCountdown(30);
    setStrictReturnCountdownActive(true);
  };

  const pauseStrictReturnCountdown = () => {
    setStrictReturnCountdownActive(false);
  };

  const handleStrictBoundaryViolation = (reason) => {
    if (!strictStarted || strictClosingRef.current) return;

    registerStrictSuspiciousEvent(reason);

    setSubmitMsg('Saliste del examen. Tienes 30 segundos para regresar o el examen sera anulado.');
    beginStrictReturnCountdown();
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
    if (strictStarting) return;
    setStrictStarting(true);

    try {

    const strictConfig = form?.strict_config && typeof form.strict_config === 'object' ? form.strict_config : {};
    const durationEnabled = Boolean(strictConfig.duration_enabled);
    const durationMinutes = Math.max(1, Number(strictConfig.duration_minutes) || 0);
    const windowEnabled = Boolean(strictConfig.window_enabled);
    const startsAt = toValidDate(strictConfig.starts_at || form?.opened_at);
    const endsAt = toValidDate(strictConfig.ends_at || form?.closed_at);
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

    const { data: sessionData } = await supabase.auth.getSession();
    const userSession = sessionData?.session || null;
    if (!userSession?.user?.id) {
      setSubmitMsg('Debes iniciar sesion para responder este formulario.');
      return;
    }

    setActiveSession(userSession);

    const submissionCheck = await checkUserAlreadySubmitted(form.id, userSession.user.id);
    if (submissionCheck.hasSubmission) {
      setAlreadySubmitted(true);
      setAlreadySubmittedAt(submissionCheck.submittedAt);
      setSubmitMsg('Ya has respondido este formulario anteriormente.');
      return;
    }

    const durationSeconds = durationEnabled && durationMinutes > 0 ? durationMinutes * 60 : null;
    const { data: inProgressRows, error: inProgressError } = await supabase
      .from('form_submissions')
      .select('id, started_at')
      .eq('form_id', form.id)
      .eq('respondent_user_id', userSession.user.id)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1);

    if (inProgressError) {
      setSubmitMsg('No se pudo iniciar el examen (error de sesion).');
      return;
    }

    if (Array.isArray(inProgressRows) && inProgressRows.length > 0) {
      const staleAttempt = inProgressRows[0];
      const nowIso = new Date().toISOString();
      await supabase
        .from('form_submissions')
        .update({
          status: 'submitted',
          submitted_at: nowIso,
          strict_locked: true,
          strict_locked_reason: 'reentry_attempt_after_exit',
          terminated_at: nowIso,
          meta: {
            strict_mode: true,
            strict_end_reason: 'reentry_attempt_after_exit',
          },
        })
        .eq('id', staleAttempt.id)
        .eq('respondent_user_id', userSession.user.id);

      await supabase
        .from('strict_exam_live_state')
        .upsert({
          submission_id: staleAttempt.id,
          form_id: form.id,
          respondent_user_id: userSession.user.id,
          respondent_label: userSession.user.email || `Usuario ${userSession.user.id.slice(0, 8)}`,
          current_question: 1,
          total_questions: Math.max(questions.length || 0, 1),
          progress_percent: 0,
          seconds_remaining: 0,
          warning_count: strictWarningCount,
          is_active: false,
        }, { onConflict: 'submission_id' })
        .then(() => {})
        .catch(() => {});

      setAlreadySubmitted(true);
      setAlreadySubmittedAt(nowIso);
      setSubmitMsg('Tu intento fue cerrado por salir del examen. No puedes volver a entrar.');
      return;
    }

    const startedAtIso = new Date().toISOString();
    const { data: createdSubmission, error: createdError } = await supabase
      .from('form_submissions')
      .insert([
        {
          form_id: form.id,
          respondent_user_id: userSession.user.id,
          status: 'in_progress',
          started_at: startedAtIso,
          submitted_at: null,
          warnings: strictWarningCount,
          strict_total_questions: Math.max(questions.length || 0, 1),
          strict_last_question_index: 1,
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
    setStrictDurationActive(Boolean(durationSeconds));
    setStrictSessionStartedAtMs(Date.now());

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

    await supabase
      .from('strict_exam_live_state')
      .upsert({
        submission_id: createdSubmission.id,
        form_id: form.id,
        respondent_user_id: userSession.user.id,
        respondent_label: userSession.user.email || `Usuario ${userSession.user.id.slice(0, 8)}`,
        current_question: 1,
        total_questions: Math.max(questions.length || 0, 1),
        progress_percent: questions.length > 0 ? Math.round((1 / questions.length) * 100) : 0,
        seconds_remaining: durationSeconds,
        warning_count: strictWarningCount,
        is_active: true,
      }, { onConflict: 'submission_id' })
      .then(() => {})
      .catch(() => {});
    } catch {
      setSubmitMsg('No se pudo iniciar el examen en este momento. Intenta nuevamente.');
  } finally {
    setStrictStarting(false);
    }
  };

  // Enviar respuestas (real)
  const handleSubmit = async (options = {}) => {
    const {
      forcedReason = null,
      preserveProgressOnly = false,
      markLocked = false,
      completionMessage = '',
    } = options;

    if (submitting || strictClosingRef.current) return;
    if (forcedReason) strictClosingRef.current = true;

    const { data: sessionData } = await supabase.auth.getSession();
    const userSession = sessionData?.session || null;
    if (!userSession?.user?.id) {
      setSubmitMsg('Debes iniciar sesion para responder este formulario.');
      return;
    }

    if (!forcedReason) {
      const submissionCheck = await checkUserAlreadySubmitted(form.id, userSession.user.id);
      if (submissionCheck.hasSubmission) {
        setAlreadySubmitted(true);
        setAlreadySubmittedAt(submissionCheck.submittedAt);
        setSubmitMsg('Ya has respondido este formulario anteriormente.');
        return;
      }
    }

    const nextErrors = {};

    if (!forcedReason) {
      for (const question of questions) {
        if (isQuestionRequired(question) && isResponseEmpty(question, responses[question.id])) {
          nextErrors[question.id] = 'Esta pregunta es obligatoria.';
        }
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
            strict_locked: Boolean(markLocked),
            strict_locked_reason: markLocked ? forcedReason : null,
            terminated_at: markLocked ? submittedAtIso : null,
            meta: {
              strict_mode: form?.form_mode === 'strict',
              suspicious_warnings: strictWarningCount,
              suspicious_events: strictSuspiciousEvents,
              strict_end_reason: forcedReason || 'manual_submit',
            },
          })
          .eq('id', strictSubmissionId)
          .eq('respondent_user_id', userSession.user.id)
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
          respondent_user_id: userSession.user.id,
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
      const answersPayload = questions
        .filter((q) => (preserveProgressOnly ? !isResponseEmpty(q, responses[q.id]) : true))
        .map(q => ({
          submission_id: submission.id,
          question_id: q.id,
          answer_value: JSON.stringify(responses[q.id] ?? null),
          points_earned: 0,
        }));

      await supabase
        .from('form_submission_answers')
        .delete()
        .eq('submission_id', submission.id);

      const { error: ansError } = await supabase
        .from('form_submission_answers')
        .insert(answersPayload);
      if (ansError) {
        setSubmitMsg('Error al guardar respuestas.');
        return;
      }

      await supabase
        .from('strict_exam_live_state')
        .upsert(
          {
            submission_id: submission.id,
            form_id: form.id,
            respondent_user_id: userSession.user.id,
            respondent_label: userSession.user.email || `Usuario ${userSession.user.id.slice(0, 8)}`,
            current_question: Math.min(strictStep + 1, Math.max(questions.length || 0, 1)),
            total_questions: Math.max(questions.length || 0, 1),
            progress_percent: questions.length > 0 ? Math.round(((Math.min(strictStep + 1, questions.length)) / questions.length) * 100) : 0,
            seconds_remaining: strictDurationRemaining,
            warning_count: strictWarningCount,
            is_active: false,
          },
          { onConflict: 'submission_id' },
        )
        .then(() => {})
        .catch(() => {});

      if (forcedReason && strictSubmissionId && form?.id) {
        await supabase.from('strict_exam_events').insert({
          form_id: form.id,
          submission_id: strictSubmissionId,
          respondent_user_id: userSession.user.id,
          question_index: strictStep + 1,
          warning_count: strictWarningCount,
          severity: 'high',
          reason: forcedReason,
        }).then(() => {}).catch(() => {});
      }

      await releaseWakeLock();
      releaseKeyboardLock();
      setStrictDurationActive(false);
      setStrictStarted(false);
      setSubmitMsg(forcedReason ? (completionMessage || 'Tu intento fue cerrado automaticamente.') : '');
      setAlreadySubmitted(true);
      setCompletedView(!forcedReason);
    } catch (e) {
      setSubmitMsg('Error inesperado al enviar.');
    } finally {
      setSubmitting(false);
      strictClosingRef.current = false;
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

      if (String(formData?.form_mode || '').toLowerCase() === 'quiz') {
        setBlockedByQuizMode(true);
        setLoading(false);
        return;
      }

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

      // Antes de mostrar el formulario, validar si el usuario ya respondio.
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session || null;
      setActiveSession(session);

      if (formData?.id && session?.user?.id) {
        const submissionCheck = await checkUserAlreadySubmitted(formData.id, session.user.id);
        setAlreadySubmitted(submissionCheck.hasSubmission);
        setAlreadySubmittedAt(submissionCheck.submittedAt);
      } else {
        setAlreadySubmitted(false);
        setAlreadySubmittedAt(null);
      }

      setLoading(false);
    }
    fetchForm();
  }, [public_id]);

  useEffect(() => {
    setStrictStep(0);
    setStrictStarted(false);
    setStrictSubmissionId(null);
    setStrictDurationRemaining(null);
    setStrictDurationActive(false);
    setStrictWarningCount(0);
    setStrictSuspiciousEvents([]);
    setStrictReturnCountdown(null);
    setStrictReturnCountdownActive(false);
    setStrictSessionStartedAtMs(null);
    setCompletedView(false);
    setAlreadySubmitted(false);
    setAlreadySubmittedAt(null);
    strictLastEventRef.current = 0;
    releaseWakeLock();
    releaseKeyboardLock();
  }, [public_id, questions.length, form?.form_mode]);

  useEffect(() => {
    const isStrictMode = form?.form_mode === 'strict';
    if (!isStrictMode || !strictStarted) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleStrictBoundaryViolation('tab_hidden');
      } else {
        pauseStrictReturnCountdown();
        setStrictReturnCountdown(null);
        setSubmitMsg('Regresaste al examen. Continua con normalidad.');
      }
    };

    const onWindowBlur = () => {
      handleStrictBoundaryViolation('window_blur');
    };

    const onWindowFocus = () => {
      if (!document.hidden) {
        pauseStrictReturnCountdown();
        setStrictReturnCountdown(null);
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleStrictBoundaryViolation('fullscreen_exit');
      } else {
        pauseStrictReturnCountdown();
        setStrictReturnCountdown(null);
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
  }, [form?.form_mode, strictStarted, strictSubmissionId]);

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
          setSubmitMsg('No regresaste en 30 segundos. El examen sera anulado.');
          setTimeout(() => {
            handleSubmit({
              forcedReason: 'return_timeout',
              preserveProgressOnly: true,
              markLocked: true,
              completionMessage: 'El examen fue anulado por no regresar en 30 segundos.',
            });
          }, 0);
          return null;
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
          setSubmitMsg('Se agoto el tiempo del examen. El intento se cerrara con tu progreso actual.');
          setTimeout(() => {
            handleSubmit({
              forcedReason: 'time_expired',
              preserveProgressOnly: true,
              markLocked: true,
              completionMessage: 'Tu tiempo termino. Se guardo solo tu progreso alcanzado.',
            });
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

  useEffect(() => {
    const strictModeActive = form?.form_mode === 'strict' && strictStarted;
    if (!strictModeActive || !strictSubmissionId) return;

    upsertStrictLiveState();
  }, [strictStarted, strictSubmissionId, strictStep, strictWarningCount, strictDurationRemaining, questions.length]);

  useEffect(() => {
    if (!strictSubmissionId || !strictStarted) return;

    const channel = supabase
      .channel(`strict_submission_${strictSubmissionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'form_submissions',
          filter: `id=eq.${strictSubmissionId}`,
        },
        (payload) => {
          const updated = payload?.new;
          if (!updated) return;

          if (updated.status === 'submitted' && updated.strict_locked) {
            releaseWakeLock();
            releaseKeyboardLock();
            setStrictStarted(false);
            setStrictDurationActive(false);
            setAlreadySubmitted(true);
            setCompletedView(false);
            setSubmitMsg('Tu intento fue cerrado por el propietario o por una regla de seguridad.');
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [strictSubmissionId, strictStarted]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-white bg-black">
        <div className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        <p className="text-sm text-white/80">Cargando...</p>
        <Link
          to="/"
          className="mt-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Ir a inicio
        </Link>
      </div>
    );
  }
  if (notFound) return <div className="min-h-screen flex items-center justify-center text-white bg-black">Formulario no encontrado</div>;
  if (blockedByQuizMode) return <div className="min-h-screen flex items-center justify-center text-white bg-black">Este formulario es tipo quiz y no tiene acceso por link publico.</div>;
  if (completedView) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 py-10 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
        </div>
        <section className="relative mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/90">Formulario completado</p>
            <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">{form?.title || 'Formulario'}</h1>
            <div className="mx-auto mt-6 h-px w-28 bg-emerald-300/50" />
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-200/90 sm:text-lg">
              Tus respuestas fueron enviadas correctamente. Gracias por completar el formulario.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (alreadySubmitted) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 py-10 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
        </div>
        <section className="relative mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center">
          <div className="w-full rounded-2xl border border-amber-300/25 bg-amber-500/10 px-6 py-7 text-center sm:px-9">
            <p className="inline-flex rounded-full border border-amber-300/35 bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-100">
              Estado del envio
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight text-amber-100 sm:text-4xl">Ya respondiste este formulario</h1>
            <h2 className="mt-3 text-base font-semibold text-white sm:text-xl">{form?.title || 'Formulario'}</h2>
            <div className="mx-auto mt-6 h-px w-36 bg-amber-300/50" />
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-slate-100 sm:text-base">
              {form?.form_mode === 'strict'
                ? 'Este examen permite un solo intento. Si sales de la pagina, el intento se cierra y no puedes volver a entrar.'
                : 'Tu cuenta ya registro una respuesta para este formulario. Solo se permite un envio por usuario.'}
            </p>
            {alreadySubmittedAt ? (
              <p className="mx-auto mt-3 max-w-2xl text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/90 sm:text-sm">
                Respondido el {new Date(alreadySubmittedAt).toLocaleString()}
              </p>
            ) : null}
            <Link
              to="/"
              className="mx-auto mt-8 inline-flex rounded-lg border border-amber-300/35 bg-amber-500/10 px-5 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
            >
              Ir a inicio
            </Link>
          </div>
        </section>
      </main>
    );
  }

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
  const strictElapsedSeconds = strictSessionStartedAtMs
    ? Math.max(0, Math.floor((strictNowMs - strictSessionStartedAtMs) / 1000))
    : 0;

  const sectionsToRender = strictSessionActive
    ? [{
        id: strictSection?.id || 'strict-section',
        title: strictSection?.title || 'Pregunta',
        description: strictSection?.description || `Pregunta ${safeStrictStep + 1} de ${strictQuestionCount}`,
        questions: strictQuestion ? [strictQuestion] : [],
      }]
    : (isStrictMode ? [] : questionsBySection);

  const isSurfaceDark = getLuminance(formTheme.surface) < 0.52;
  const textPrimary = isSurfaceDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isSurfaceDark ? '#e2e8f0' : '#1e293b';
  const textMuted = isSurfaceDark ? '#cbd5e1' : '#475569';
  const panelBg = hexToRgba(formTheme.surface, isSurfaceDark ? 0.86 : 0.92);
  const panelBorder = hexToRgba(formTheme.accent, isSurfaceDark ? 0.35 : 0.26);
  const inputBg = hexToRgba(formTheme.bgFrom, isSurfaceDark ? 0.5 : 0.65);
  const inputBorder = hexToRgba(formTheme.accent, isSurfaceDark ? 0.32 : 0.26);
  const overlayBg = isSurfaceDark ? 'rgba(2, 6, 23, 0.55)' : 'rgba(15, 23, 42, 0.28)';
  const inputBaseClass = 'w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none transition';
  const inputBaseStyle = { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary };

  return (
    <main
      className={`min-h-screen ${strictSessionActive ? 'select-none' : ''}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${formTheme.bgFrom}, ${formTheme.bgTo})`,
        color: textPrimary,
      }}
    >
      <div className="fixed inset-0 -z-10" style={{ backgroundColor: overlayBg }} />
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full" style={{backgroundColor: formTheme.primary, opacity: 0.12, filter: 'blur(48px)'}} />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full" style={{backgroundColor: formTheme.accent, opacity: 0.12, filter: 'blur(48px)'}} />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full" style={{backgroundColor: formTheme.surface, opacity: 0.12, filter: 'blur(48px)'}} />
      </div>

      {strictSessionActive ? (
        <div className="fixed right-4 top-4 z-40 w-56 border border-sky-300/35 bg-[#071022]/90 px-4 py-3 text-sky-100 shadow-2xl backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.16em] text-sky-200/85">Cronometro de examen</p>
          <p className="mt-1 text-2xl font-black leading-none">{strictDurationRemaining !== null ? formatSeconds(strictDurationRemaining) : '--:--'}</p>
          <p className="mt-1 text-[11px] text-sky-200/85">Transcurrido: {formatSeconds(strictElapsedSeconds)}</p>
        </div>
      ) : null}

      <div className={strictSessionActive ? 'mx-auto min-h-screen w-full max-w-6xl py-6 px-4' : 'max-w-3xl mx-auto py-10 px-4'}>
          {formTheme.coverImage && !strictSessionActive ? (
            <div className="mb-6 overflow-hidden rounded-xl shadow-lg shadow-black/40" style={{ border: `1px solid ${panelBorder}` }}>
              <img src={formTheme.coverImage} alt="Portada del formulario" className="h-52 w-full object-cover" />
            </div>
          ) : null}
          <div className="mb-9">
            <h1 className="mb-2 text-4xl font-black leading-tight" style={{ color: formTheme.primary, textShadow: isSurfaceDark ? '0 1px 10px rgba(0,0,0,0.35)' : 'none' }}>
              {form.title}
            </h1>
            <p className="text-base leading-relaxed" style={{ color: textSecondary }}>{form.description}</p>
          </div>
        {isStrictMode && !strictStarted ? (
          <section className="mb-7 px-1 py-2">
            <h2 className="text-xl font-bold text-rose-300">Modo estricto</h2>
            {strictWindowStatus === 'not_started' ? (
              <div className="mt-3 rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200">
                Este examen aun no ha comenzado. Inicia en {formatMsAsCountdown(strictTimeUntilStartMs)}.
              </div>
            ) : null}
            {strictWindowStatus === 'in_progress' ? (
              <div className="mt-3 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200">
                Estado: En curso.
              </div>
            ) : null}
            {strictWindowStatus === 'finished' ? (
              <div className="mt-3 rounded-lg border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200">
                Este examen ya finalizo.
              </div>
            ) : null}
            <div className="mt-3 border-l-2 border-amber-300/50 bg-amber-500/8 p-3">
              <p className="text-sm font-semibold text-amber-200">Recomendaciones del examen</p>
              <ul className="mt-2 space-y-1 text-sm" style={{ color: textSecondary }}>
                <li>- Solo puedes responder una sola vez.</li>
                <li>- Si sales de esta pagina tienes 30 segundos para volver.</li>
                <li>- Si no regresas en 30 segundos, el examen se anula y no podras volver a entrar.</li>
                <li>- Toda actividad sospechosa se reporta en tiempo real al propietario.</li>
                <li>- Debes estar logueado para rendir este examen.</li>
              </ul>
            </div>
            {strictDurationEnabled ? (
              <p className="mt-2 text-sm font-semibold text-amber-200">Duracion por usuario: {strictDurationMinutes} min (por cuenta logueada).</p>
            ) : null}
            {strictWindowEnabled ? (
              <p className="mt-2 text-sm" style={{ color: textMuted }}>
                Ventana habilitada: {strictStartsAt ? strictStartsAt.toLocaleString() : 'sin inicio'} - {strictEndsAt ? strictEndsAt.toLocaleString() : 'sin fin'}
              </p>
            ) : null}
            <button
              type="button"
              onClick={startStrictSession}
              disabled={!strictCanStartNow || strictStarting}
              className="mt-5 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`}}
            >
              {strictWindowStatus === 'not_started'
                ? 'Aun no disponible'
                : strictWindowStatus === 'finished'
                  ? 'Examen finalizado'
                  : strictStarting
                    ? 'Iniciando...'
                    : 'Iniciar examen'}
            </button>
            {isStrictMode && !strictStarted && submitMsg ? (
              <p className={`mt-3 text-sm font-semibold ${submitMsg.toLowerCase().includes('error') ? 'text-rose-300' : 'text-amber-200'}`}>
                {submitMsg}
              </p>
            ) : null}
          </section>
        ) : null}

        {strictSessionActive ? (
          <div className="mb-4 py-2">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide" style={{ color: textSecondary }}>
              <span>Modo estricto</span>
              <span>{safeStrictStep + 1} / {strictQuestionCount || 1}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: hexToRgba(formTheme.accent, 0.25) }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${strictProgress}%`,
                  backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`,
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-200">Advertencias: {strictWarningCount}</span>
              {strictDurationRemaining !== null ? (
                <span className="rounded-md border border-sky-400/40 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-200">Tiempo restante: {formatSeconds(strictDurationRemaining)}</span>
              ) : null}
              {strictWindowRemainingMs !== null ? (
                <span className="rounded-md border border-violet-400/40 bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-200">
                  Ventana global restante: {formatMsAsCountdown(strictWindowRemainingMs)}
                </span>
              ) : null}
              {Array.from({ length: Math.min(strictWarningCount, 12) }, (_, idx) => (
                <span key={`strict-warn-${idx}`} className="rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-200">[!]</span>
              ))}
            </div>

            {strictReturnCountdown !== null ? (
              <div className="mt-3 rounded-lg border border-rose-500/60 bg-rose-900/40 px-3 py-3 text-sm font-semibold text-rose-100">
                <p className="text-xs uppercase tracking-wide text-rose-200">Advertencia de salida</p>
                <p className="mt-1 text-base font-bold text-rose-100">
                  Regresa al examen en <span className="text-xl text-rose-300">{strictReturnCountdown}s</span> o sera anulado automaticamente.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {sectionsToRender.map((section, idx) => (
          <section key={section.id} className="mb-8">
            <h2 className="mb-2 text-2xl font-bold" style={{color: formTheme.accent}}>{section.title}</h2>
            <p className="mb-3 text-base" style={{ color: textSecondary }}>{section.description}</p>
            <div className="space-y-6">
              {section.questions.map((question, questionIndex) => (
                <article
                  key={question.id}
                  className="space-y-3 py-4"
                  style={questionIndex < section.questions.length - 1 ? { borderBottom: `1px solid ${hexToRgba(formTheme.accent, 0.2)}` } : undefined}
                >
                  <div className="mb-1 text-[1.35rem] font-bold leading-snug" style={{ color: textPrimary }}>
                    {question.title}
                    {isQuestionRequired(question) ? <span className="ml-1 text-red-600">*</span> : null}
                  </div>
                  <div className="mb-3 text-base leading-relaxed" style={{ color: textSecondary }}>{question.description}</div>
                  {/* Renderizado de todos los tipos */}
                  {question.type === 'short_answer' && (
                    <input className={inputBaseClass} style={inputBaseStyle} type="text" placeholder="Respuesta corta"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'paragraph' && (
                    <textarea className={inputBaseClass} style={inputBaseStyle} rows={3} placeholder="Respuesta larga"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'number' && (
                    <input className={inputBaseClass} style={inputBaseStyle} type="number" placeholder="123"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'email' && (
                    <input className={inputBaseClass} style={inputBaseStyle} type="email" placeholder="correo@ejemplo.com"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'url' && (
                    <input className={inputBaseClass} style={inputBaseStyle} type="url" placeholder="https://..."
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'phone' && (
                    <input className={inputBaseClass} style={inputBaseStyle} type="tel" placeholder="Telefono"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'date' && (
                    <input className={inputBaseClass} style={inputBaseStyle} type="date"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'time' && (
                    <input className={inputBaseClass} style={inputBaseStyle} type="time"
                      value={responses[question.id] || ''}
                      onChange={e => handleResponse(question.id, e.target.value)} />
                  )}
                  {question.type === 'multiple_choice' && (
                    <div className="space-y-1">
                      {(question.options || []).map((opt, idx) => (
                        <label key={idx} className="flex items-center gap-2" style={{ color: textPrimary }}>
                          <input type="checkbox" checked={Array.isArray(responses[question.id]) && responses[question.id].includes(idx)}
                            onChange={() => handleCheckbox(question.id, idx)} /> {opt || `Opción ${idx + 1}`}
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === 'checkboxes' && (
                    <div className="space-y-1">
                      {(question.options || []).map((opt, idx) => (
                        <label key={idx} className="flex items-center gap-2" style={{ color: textPrimary }}>
                          <input type="checkbox" checked={Array.isArray(responses[question.id]) && responses[question.id].includes(idx)}
                            onChange={() => handleCheckbox(question.id, idx)} /> {opt || `Opción ${idx + 1}`}
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === 'dropdown' && (
                    <select className={inputBaseClass} style={inputBaseStyle}
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
                        <label key={idx} className="flex items-center gap-2" style={{ color: textPrimary }}>
                          <input type="radio" name={`choice-${question.id}`} checked={Number(responses[question.id]) === idx}
                            onChange={() => handleResponse(question.id, idx)} /> {opt || `Opción ${idx + 1}`}
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === 'linear_scale' && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs" style={{ color: textMuted }}>
                        <span>Bajo</span><span>Alto</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {Array.from({ length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1 }, (_, i) => (question.scaleMin || 1) + i).map((val) => (
                          <label key={val} className="flex flex-col items-center gap-1 text-xs" style={{ color: textPrimary }}>
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
                          <button key={value} type="button" onClick={() => handleResponse(question.id, value)} className="rounded-lg border px-2 py-1 transition"
                            style={selected
                              ? { borderColor: formTheme.primary, backgroundColor: hexToRgba(formTheme.primary, 0.22) }
                              : { borderColor: inputBorder, backgroundColor: inputBg }}>{emoji}</button>
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
                      <p className="text-xs" style={{ color: textMuted }}>Arrastra y suelta para reordenar.</p>
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
                          className="flex cursor-grab items-center gap-2 rounded-lg px-3 py-2 active:cursor-grabbing"
                          style={{ border: `1px solid ${inputBorder}`, backgroundColor: inputBg }}
                        >
                          <span className="w-6 text-sm font-semibold" style={{ color: textMuted }}>{pos + 1}</span>
                          <span className="flex-1 text-sm" style={{ color: textPrimary }}>{question.options[optIdx] || `Opción ${optIdx + 1}`}</span>
                          <button type="button" disabled={pos === 0} onClick={() => handleRankingMove(question.id, pos, -1, question.options)} className="rounded px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40" style={{ border: `1px solid ${inputBorder}`, backgroundColor: panelBg, color: textSecondary }}>Subir</button>
                          <button type="button" disabled={pos === arr.length - 1} onClick={() => handleRankingMove(question.id, pos, 1, question.options)} className="rounded px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-40" style={{ border: `1px solid ${inputBorder}`, backgroundColor: panelBg, color: textSecondary }}>Bajar</button>
                        </div>
                      ))
                      })()}
                    </div>
                  )}
                  {fieldErrors[question.id] ? (
                    <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors[question.id]}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ))}
        {/* Navegación / Envío */}
        <div className="max-w-3xl mx-auto py-6 px-1">
          {strictSessionActive ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={safeStrictStep === 0 || submitting || (strictDurationRemaining !== null && strictDurationRemaining <= 0)}
                onClick={() => {
                  setSubmitMsg('');
                  setStrictStep((current) => Math.max(0, current - 1));
                }}
                className="rounded-xl px-5 py-2 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ border: `1px solid ${inputBorder}`, backgroundColor: panelBg, color: textPrimary }}
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
                  disabled={submitting || !activeSession?.user?.id || (strictDurationRemaining !== null && strictDurationRemaining <= 0)}
                  onClick={() => {
                    if (!validateRequiredQuestion(strictQuestion)) return;
                    handleSubmit();
                  }}
                  className="rounded-xl px-5 cursor-pointer py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`}}
                >
                  Enviar 
                </button>
              )}
            </div>
          ) : !isStrictMode ? (
            <div className="flex justify-end">
              <button disabled={submitting || !activeSession?.user?.id} onClick={handleSubmit} className="cursor-pointer rounded-xl px-10 py-2  font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-gray-300" style={{backgroundImage: `linear-gradient(90deg, ${formTheme.primary}, ${formTheme.accent})`}}>
                Enviar 
              </button>
            </div>
          ) : null}
          {!activeSession?.user?.id ? (
            <p className="mt-3 text-sm" style={{ color: textMuted }}>Debes iniciar sesion para enviar respuestas.</p>
          ) : null}
          {submitMsg && (
            <div className={`mt-3 font-semibold ${Object.keys(fieldErrors).length > 0 || submitMsg.toLowerCase().includes('error') ? 'text-rose-300' : 'text-emerald-300'}`}>
              {submitMsg}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default FormPublicView;