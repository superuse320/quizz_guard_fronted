import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const getMood = (warnings) => {
  const score = Math.max(0, 100 - (Number(warnings) || 0) * 20)
  if (score >= 70) return { label: 'Estable', score, tone: 'good' }
  if (score >= 40) return { label: 'Atencion', score, tone: 'warn' }
  if (score >= 20) return { label: 'Riesgo', score, tone: 'risk' }
  return { label: 'Critico', score, tone: 'bad' }
}

const getSeverityColor = (severity) => {
  if (severity === 'high') return 'text-rose-200 border-rose-400/35 bg-rose-500/10'
  if (severity === 'low') return 'text-emerald-200 border-emerald-400/35 bg-emerald-500/10'
  return 'text-amber-200 border-amber-400/35 bg-amber-500/10'
}

const formatDateTime = (value) => {
  if (!value) return '--'
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatSecondsAsMinutes = (value) => {
  if (value === null || value === undefined) return '--'
  const total = Math.max(0, Number(value) || 0)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} min`
}

const getInitials = (name) => {
  const safe = String(name || '').trim()
  if (!safe) return 'US'
  const parts = safe.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'US'
}

const getReadableReason = (reason) => {
  const labels = {
    tab_hidden: 'Salio de la pestana del examen',
    window_blur: 'Perdio el foco de la ventana',
    fullscreen_exit: 'Salio de pantalla completa',
    return_timeout: 'No regreso en 30 segundos',
    context_menu_blocked: 'Intento de click derecho',
    copy_blocked: 'Intento de copiar',
    paste_blocked: 'Intento de pegar',
    cut_blocked: 'Intento de cortar',
    ctrl_c_blocked: 'Intento de Ctrl+C',
    ctrl_v_blocked: 'Intento de Ctrl+V',
    ctrl_x_blocked: 'Intento de Ctrl+X',
    ctrl_a_blocked: 'Intento de Ctrl+A',
    ctrl_p_blocked: 'Intento de Ctrl+P',
    ctrl_s_blocked: 'Intento de Ctrl+S',
    ctrl_u_blocked: 'Intento de Ctrl+U',
    f12_blocked: 'Intento de abrir DevTools',
    print_screen_detected: 'Intento de captura de pantalla',
    strict_incident_limit_reached: 'Supero el limite de incidentes',
    owner_cancelled_exam: 'Examen anulado por el propietario',
    left_exam_page: 'Salio de la pagina del examen',
    window_focus_lost: 'Perdio foco durante el examen',
    time_expired: 'Tiempo de examen agotado',
  }
  return labels[reason] || reason || 'Evento no identificado'
}

const getReadableLockedReason = (reason) => {
  const labels = {
    cancelled_by_owner: 'Anulado por el propietario',
    return_timeout: 'No regreso en 30 segundos',
    strict_incident_limit_reached: 'Supero el limite de incidentes',
    fullscreen_exit: 'Salio de pantalla completa',
    window_focus_lost: 'Perdio foco de ventana',
    left_exam_page: 'Salio de la pagina del examen',
    time_expired: 'Se agoto el tiempo del examen',
    reentry_attempt_after_exit: 'Intento volver a entrar tras salir',
  }
  return labels[reason] || reason || 'Regla de seguridad'
}

export default function StrictExamAdminPanel({ formId, publicId, formTitle, formDescription, onClose }) {
  const navigate = useNavigate()
  const [liveRows, setLiveRows] = useState([])
  const [annulledRows, setAnnulledRows] = useState([])
  const [events, setEvents] = useState([])
  const [profileNameMap, setProfileNameMap] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const loadData = async () => {
    setError('')

    const [{ data: liveData, error: liveError }, { data: eventData, error: eventError }, { data: submissionsData, error: submissionsError }, { data: annulledData, error: annulledError }] = await Promise.all([
      supabase
        .from('strict_exam_live_state')
        .select('submission_id, respondent_user_id, respondent_label, current_question, total_questions, progress_percent, seconds_remaining, warning_count, is_active, updated_at')
        .eq('form_id', formId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false }),
      supabase
        .from('strict_exam_events')
        .select('id, submission_id, respondent_user_id, reason, severity, warning_count, question_index, created_at')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('form_submissions')
        .select('id, respondent_user_id, respondent_email, started_at, warnings')
        .eq('form_id', formId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false }),
      supabase
        .from('form_submissions')
        .select('id, respondent_user_id, respondent_email, respondent_name, submitted_at, strict_locked_reason, warnings, strict_locked')
        .eq('form_id', formId)
        .eq('strict_locked', true)
        .order('submitted_at', { ascending: false })
        .limit(50),
    ])

    if (submissionsError) {
      setError(submissionsError.message || 'No se pudieron cargar participantes en progreso.')
      setLoading(false)
      return
    }

    const safeLiveRows = Array.isArray(liveData) ? liveData : []
    const safeEvents = Array.isArray(eventData) ? eventData : []
    const safeSubmissions = Array.isArray(submissionsData) ? submissionsData : []
    const safeAnnulled = Array.isArray(annulledData) ? annulledData : []

    if (liveError || eventError || annulledError) {
      // Evitamos ruido visual; seguimos con la mejor informacion disponible.
    }

    const profileIds = [
      ...new Set([
        ...safeLiveRows.map((row) => row.respondent_user_id).filter(Boolean),
        ...safeSubmissions.map((row) => row.respondent_user_id).filter(Boolean),
        ...safeAnnulled.map((row) => row.respondent_user_id).filter(Boolean),
        ...safeEvents.map((row) => row.respondent_user_id).filter(Boolean),
      ]),
    ]

    let nextProfileMap = new Map()
    if (profileIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', profileIds)

      nextProfileMap = new Map((profilesData || []).map((profile) => [profile.id, profile.name]))
    }
    setProfileNameMap(nextProfileMap)

    const liveRowsBySubmission = new Map(safeLiveRows.map((row) => [row.submission_id, row]))
    const fallbackRows = safeSubmissions
      .filter((submission) => !liveRowsBySubmission.has(submission.id))
      .map((submission) => ({
        submission_id: submission.id,
        respondent_user_id: submission.respondent_user_id,
        respondent_label: submission.respondent_email || null,
        current_question: 1,
        total_questions: 1,
        progress_percent: 0,
        seconds_remaining: null,
        warning_count: submission.warnings || 0,
        is_active: true,
        updated_at: submission.started_at,
      }))

    setLiveRows([...safeLiveRows, ...fallbackRows])
    setEvents(safeEvents)
    setAnnulledRows(safeAnnulled)
    setLoading(false)
  }

  useEffect(() => {
    if (!formId) return
    loadData()

    const liveChannel = supabase
      .channel(`strict_live_${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strict_exam_live_state',
          filter: `form_id=eq.${formId}`,
        },
        () => {
          loadData()
        },
      )
      .subscribe()

    const eventsChannel = supabase
      .channel(`strict_events_${formId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'strict_exam_events',
          filter: `form_id=eq.${formId}`,
        },
        () => {
          loadData()
        },
      )
      .subscribe()

    const submissionsChannel = supabase
      .channel(`strict_submissions_${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_submissions',
          filter: `form_id=eq.${formId}`,
        },
        () => {
          loadData()
        },
      )
      .subscribe()

    return () => {
      liveChannel.unsubscribe()
      eventsChannel.unsubscribe()
      submissionsChannel.unsubscribe()
    }
  }, [formId])

  const activeCount = useMemo(() => liveRows.filter((row) => row.is_active).length, [liveRows])

  const resolveDisplayName = (userId, fallbackA, fallbackB) => {
    return (
      profileNameMap.get(userId) ||
      fallbackA ||
      fallbackB ||
      `Usuario ${String(userId || '').slice(0, 8)}`
    )
  }

  const getMoodIcon = (tone) => {
    if (tone === 'good') {
      return (
        <svg className="h-4 w-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 10h.01" />
          <path d="M16 10h.01" />
          <path d="M8 15c1.2 1 2.4 1.5 4 1.5s2.8-.5 4-1.5" />
        </svg>
      )
    }
    if (tone === 'warn' || tone === 'risk') {
      return (
        <svg className="h-4 w-4 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 10h.01" />
          <path d="M16 10h.01" />
          <path d="M8 16c1.2-.8 2.4-1.2 4-1.2s2.8.4 4 1.2" />
        </svg>
      )
    }

    return (
      <svg className="h-4 w-4 text-rose-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 10h.01" />
        <path d="M16 10h.01" />
        <path d="M8 17c1.2-1 2.4-1.5 4-1.5s2.8.5 4 1.5" />
      </svg>
    )
  }

  const handleCancelExam = async (row) => {
    const targetName = row.respondent_label || `Participante ${String(row.respondent_user_id || '').slice(0, 8)}`
    const confirmCancel = window.confirm(`Anular examen de ${targetName}?`)
    if (!confirmCancel) return

    try {
      const nowIso = new Date().toISOString()
      const { error: subError } = await supabase
        .from('form_submissions')
        .update({
          status: 'submitted',
          submitted_at: nowIso,
          strict_locked: true,
          strict_locked_reason: 'cancelled_by_owner',
          terminated_at: nowIso,
          meta: {
            strict_mode: true,
            strict_owner_cancelled: true,
            strict_owner_cancelled_at: nowIso,
          },
        })
        .eq('id', row.submission_id)

      if (subError) throw subError

      await supabase
        .from('strict_exam_live_state')
        .update({ is_active: false, updated_at: nowIso })
        .eq('submission_id', row.submission_id)
        .then(() => {})
        .catch(() => {})

      await supabase.from('strict_exam_events').insert({
        form_id: formId,
        submission_id: row.submission_id,
        respondent_user_id: row.respondent_user_id,
        question_index: row.current_question,
        warning_count: row.warning_count,
        severity: 'high',
        reason: 'owner_cancelled_exam',
      }).then(() => {}).catch(() => {})

      setActionMessage(`${targetName} fue anulado correctamente.`)
      setTimeout(() => setActionMessage(''), 2500)
      await loadData()
    } catch (err) {
      alert(err.message || 'No se pudo anular el examen.')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-slate-100">
        <p className="text-sm text-slate-300">Cargando monitor de examen...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-slate-100 md:px-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/90">Monitoreo estricto</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Panel de examen en tiempo real</h2>
            <p className="mt-1 text-sm text-slate-300">{formTitle || 'Formulario sin titulo'}</p>
            <p className="text-xs text-slate-400">{formDescription || 'Sin descripcion'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Volver al editor
          </button>
        </div>
      </header>

      {actionMessage ? (
        <div className="mb-4 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{actionMessage}</div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Activos ahora</p>
          <p className="mt-1 text-3xl font-black text-white">{activeCount}</p>
        </div>
        <div className="bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Eventos sospechosos</p>
          <p className="mt-1 text-3xl font-black text-white">{events.length}</p>
        </div>
        <div className="bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ultima actualizacion</p>
          <p className="mt-1 text-xl font-bold text-white">{formatDateTime(new Date().toISOString())}</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-rose-200">Participantes anulados</h3>
          {annulledRows.length === 0 ? (
            <p className="text-xs text-slate-400">Aun no hay participantes anulados.</p>
          ) : (
            <ul className="space-y-2">
              {annulledRows.map((row) => {
                const displayName = resolveDisplayName(
                  row.respondent_user_id,
                  row.respondent_name,
                  row.respondent_email,
                )
                return (
                  <li key={row.id} className="border border-rose-400/20 bg-rose-500/5 px-3 py-2 text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-100">
                        {getInitials(displayName)}
                      </span>
                      <div>
                        <p className="font-semibold text-rose-100">{displayName}</p>
                        <p className="text-[11px] text-rose-200/85">Fue anulado</p>
                      </div>
                    </div>
                    <p className="text-rose-200/85">Motivo: {getReadableLockedReason(row.strict_locked_reason)}</p>
                    <p className="text-slate-400">{formatDateTime(row.submitted_at)} | Advertencias: {row.warnings || 0}</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/form/${publicId}/respuestas/${row.id}`)}
                      className="mt-2 w-full rounded-md border border-sky-300/35 bg-sky-500/10 px-2 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
                    >
                      Ver respuestas
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <div className="space-y-3">
          {liveRows.length === 0 ? (
            <div className="border border-white/10 bg-white/5 p-5 text-sm text-slate-300">No hay participantes activos en este momento.</div>
          ) : (
            liveRows.map((row) => {
              const mood = getMood(row.warning_count)
              const displayName = resolveDisplayName(row.respondent_user_id, row.respondent_label, null)
              return (
                <article key={row.submission_id} className="border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/60 text-[11px] font-bold text-slate-100">
                        {getInitials(displayName)}
                      </span>
                      <h3 className="text-sm font-semibold text-white">{displayName}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancelExam(row)}
                      className="rounded-md border border-rose-300/30 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/35"
                    >
                      Anular examen
                    </button>
                  </div>

                  <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-3">
                    <p>Pregunta: <span className="font-semibold text-white">{row.current_question}/{row.total_questions}</span></p>
                    <p>Tiempo: <span className="font-semibold text-white">{formatSecondsAsMinutes(row.seconds_remaining)}</span></p>
                    <p>Advertencias: <span className="font-semibold text-white">{row.warning_count}</span></p>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-300">Progreso</span>
                      <span className="text-white">{Math.round(Number(row.progress_percent) || 0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-linear-to-r from-sky-400 to-emerald-400" style={{ width: `${Math.max(0, Math.min(100, Number(row.progress_percent) || 0))}%` }} />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-300">Estado de confianza</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-white">{getMoodIcon(mood.tone)} {mood.label}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${mood.score >= 70 ? 'bg-emerald-400' : mood.score >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${mood.score}%` }} />
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <aside className="border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-200">Actividad sospechosa en vivo</h3>
          {events.length === 0 ? (
            <p className="text-xs text-slate-400">Sin eventos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className={`rounded-lg border px-2 py-2 text-xs ${getSeverityColor(event.severity)}`}>
                  <p className="mb-1 text-[11px] font-semibold text-slate-100">
                    {resolveDisplayName(event.respondent_user_id, null, `Participante ${String(event.submission_id || '').slice(0, 8)}`)}
                  </p>
                  <p className="font-semibold">{getReadableReason(event.reason)}</p>
                  <p>Pregunta: {event.question_index || 0} | Warn: {event.warning_count || 0}</p>
                  <p className="opacity-85">{formatDateTime(event.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </div>
  )
}
