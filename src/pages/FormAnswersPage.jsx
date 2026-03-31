import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardHeader from '../components/common/DashboardHeader';
import { useSession } from '../hooks/useSession';
import { useProfile } from '../hooks/useProfile';
import { useGetFormResponsesDashboardQuery } from '../redux/services/formsApi';

const PIE_COLORS = ['#22d3ee', '#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185', '#cbd5e1'];
const AVATAR_COLORS = ['bg-primary-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];

const parseAnswerValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const getAvatarColorClass = (seed) => {
  const base = String(seed || 'U');
  const first = base.charCodeAt(0) || 1;
  const last = base.charCodeAt(base.length - 1) || 1;
  return AVATAR_COLORS[(first + last) % AVATAR_COLORS.length];
};

export default function FormAnswersPage() {
  const { public_id } = useParams();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { profile } = useProfile(userId);
  const [activeTab, setActiveTab] = useState('responses');

  const {
    data: dashboardData,
    isLoading: loading,
    isError,
    error,
  } = useGetFormResponsesDashboardQuery(public_id, { skip: !public_id });

  const form = dashboardData?.form || null;
  const blockedByQuizMode = Boolean(dashboardData?.blockedByQuizMode);
  const submissions = dashboardData?.submissions || [];
  const questions = dashboardData?.questions || [];
  const options = dashboardData?.options || [];
  const answers = dashboardData?.answers || [];
  const errorMsg = isError ? (error?.data || error?.message || 'No se pudo cargar la informacion.') : '';

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const uniqueRespondents = useMemo(() => {
    const uniqueNames = new Set(
      submissions
        .map((submission) => submission.respondent_display)
        .filter(Boolean)
    );
    return uniqueNames.size;
  }, [submissions]);

  const isFormScored = useMemo(
    () => submissions.some((submission) => Number(submission.max_score || 0) > 0),
    [submissions]
  );

  const averageScore = useMemo(() => {
    const scored = submissions.filter((submission) => Number(submission.max_score || 0) > 0);
    if (scored.length === 0) return null;

    const totalPct = scored.reduce((acc, submission) => {
      const score = Number(submission.score || 0);
      const maxScore = Number(submission.max_score || 0);
      if (maxScore <= 0) return acc;
      return acc + (score / maxScore) * 100;
    }, 0);

    return Math.round(totalPct / scored.length);
  }, [submissions]);

  const questionStats = useMemo(() => {
    if (!questions.length) return [];

    const optionsByQuestion = new Map();
    options.forEach((option) => {
      const current = optionsByQuestion.get(option.question_id) || [];
      current.push(option);
      optionsByQuestion.set(option.question_id, current);
    });

    optionsByQuestion.forEach((value, key) => {
      optionsByQuestion.set(
        key,
        [...value].sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      );
    });

    return questions.map((question) => {
      const questionAnswers = answers.filter((answer) => answer.question_id === question.id);
      const questionOptions = optionsByQuestion.get(question.id) || [];
      const counters = new Map();
      const addCount = (label) => {
        const safeLabel = String(label || 'Sin respuesta').trim() || 'Sin respuesta';
        counters.set(safeLabel, (counters.get(safeLabel) || 0) + 1);
      };

      questionAnswers.forEach((answer) => {
        const parsed = parseAnswerValue(answer.answer_value);
        const type = String(question.type || '').toLowerCase();

        if (['dropdown', 'choice_unique', 'multiple_choice'].includes(type)) {
          if (Array.isArray(parsed)) {
            parsed.forEach((idx) => {
              const option = questionOptions[Number(idx)];
              addCount(option?.label || `Opcion ${Number(idx) + 1}`);
            });
          } else if (parsed !== null && parsed !== undefined && parsed !== '') {
            const option = questionOptions[Number(parsed)];
            addCount(option?.label || `Opcion ${Number(parsed) + 1}`);
          } else {
            addCount('Sin respuesta');
          }
          return;
        }

        if (type === 'checkboxes') {
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((idx) => {
              const option = questionOptions[Number(idx)];
              addCount(option?.label || `Opcion ${Number(idx) + 1}`);
            });
          } else {
            addCount('Sin respuesta');
          }
          return;
        }

        if (type === 'ranking') {
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = Number(parsed[0]);
            const topOption = questionOptions[first];
            addCount(`Top 1: ${topOption?.label || `Opcion ${first + 1}`}`);
          } else {
            addCount('Sin respuesta');
          }
          return;
        }

        if (Array.isArray(parsed)) {
          addCount(parsed.length > 0 ? parsed.map((v) => String(v)).join(', ') : 'Sin respuesta');
          return;
        }

        if (parsed === null || parsed === undefined || String(parsed).trim() === '') {
          addCount('Sin respuesta');
          return;
        }

        addCount(String(parsed));
      });

      const segments = [...counters.entries()]
        .map(([label, count], index) => ({
          label,
          count,
          color: PIE_COLORS[index % PIE_COLORS.length],
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const total = segments.reduce((acc, item) => acc + item.count, 0);
      let progress = 0;
      const gradientParts = segments.map((segment) => {
        if (total === 0) return `${segment.color} 0deg 0deg`;
        const start = progress;
        const end = progress + (segment.count / total) * 360;
        progress = end;
        return `${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
      });

      const pieBackground = total > 0
        ? `conic-gradient(${gradientParts.join(', ')})`
        : 'conic-gradient(#334155 0deg 360deg)';

      return {
        questionId: question.id,
        title: question.title || 'Pregunta sin titulo',
        type: question.type || 'otro',
        total,
        segments,
        pieBackground,
      };
    });
  }, [answers, options, questions]);

  useEffect(() => {
    setActiveTab('responses');
  }, [public_id]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary-500/12 blur-3xl" />
        <div className="absolute -right-16 top-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <DashboardHeader email={session?.user?.email} name={profile?.name} showSearch={false} />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <section className="space-y-4 py-4">
            <div className="space-y-3 border-b border-white/12 pb-6">
              <div className="h-3 w-44 rounded bg-slate-700/70 shimmer-strip-dark" />
              <div className="h-8 w-3/5 rounded bg-slate-700/70 shimmer-strip-dark" />
              <div className="h-4 w-4/5 rounded bg-slate-700/60 shimmer-strip-dark" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`kpi-skel-${idx}`} className="h-20 rounded-xl border border-white/10 bg-[#0f1522] p-4">
                  <div className="h-3 w-20 rounded bg-slate-700/70 shimmer-strip-dark" />
                  <div className="mt-3 h-6 w-14 rounded bg-slate-700/70 shimmer-strip-dark" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={`row-skel-${idx}`} className="rounded-2xl border border-white/10 bg-[#0d1420]/95 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-700/70 shimmer-strip-dark" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-slate-700/70 shimmer-strip-dark" />
                      <div className="h-3 w-56 rounded bg-slate-700/60 shimmer-strip-dark" />
                    </div>
                    <div className="h-8 w-28 rounded bg-slate-700/70 shimmer-strip-dark" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && blockedByQuizMode ? (
          <div className="py-14 text-center text-slate-300">Las respuestas no estan disponibles para formularios tipo quiz.</div>
        ) : null}

        {!loading && !blockedByQuizMode && !form ? (
          <div className="py-14 text-center text-slate-300">Formulario no encontrado</div>
        ) : null}

        {!loading && !blockedByQuizMode && form && errorMsg ? (
          <div className="py-14 text-center text-rose-300">{errorMsg}</div>
        ) : null}

        {!loading && !blockedByQuizMode && form && !errorMsg ? (
          <>
            <header className="border-b border-white/12 pb-6">
              <p className="text-xs uppercase tracking-[0.18em] text-primary-200/90">Panel de respuestas</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{form.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-200/90">{form.description || 'Sin descripcion'}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
                <span>Respuestas: <strong className="text-white">{submissions.length}</strong></span>
                <span>Participantes: <strong className="text-white">{uniqueRespondents}</strong></span>
                <span>Preguntas: <strong className="text-white">{questions.length}</strong></span>
                <span>Puntaje promedio: <strong className="text-white">{isFormScored ? `${averageScore ?? 0}%` : 'No aplica'}</strong></span>
              </div>
            </header>

            <nav className="mt-6 flex items-center gap-3 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('responses')}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activeTab === 'responses'
                    ? 'bg-primary-500/20 text-primary-200'
                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                Respuestas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activeTab === 'stats'
                    ? 'bg-primary-500/20 text-primary-200'
                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                Estadisticas
              </button>
            </nav>

            {activeTab === 'responses' ? (
              <section className="mt-6">
                {submissions.length === 0 ? (
                  <div className="py-14 text-center text-slate-300">No hay respuestas aun.</div>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((submission, index) => {
                      const hasScore = isFormScored && Number(submission.max_score || 0) > 0;

                      return (
                        <article
                          key={submission.id}
                          className="grid gap-4 rounded-2xl border border-white/12 bg-[#0d1420]/95 p-4 shadow-[0_16px_35px_rgba(0,0,0,0.35)] transition hover:border-primary-300/40 hover:bg-[#111b2b] md:grid-cols-[1fr_auto]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              <div className={`h-10 w-10 rounded-full ${getAvatarColorClass(submission.respondent_display)} grid place-items-center text-sm font-bold text-white ring-2 ring-white/20`}>
                                {String(submission.respondent_display || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-base font-semibold text-white">{submission.respondent_display}</p>
                                  <span className="rounded-full border border-primary-300/40 bg-primary-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-200">#{index + 1}</span>
                                </div>
                                <p className="truncate text-sm text-slate-300">{submission.respondent_email_display || submission.respondent_email || 'Sin email'}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                  <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1">{formatDateTime(submission.submitted_at || submission.created_at)}</span>
                                  <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1">Estado: {submission.status || 'submitted'}</span>
                                  {isFormScored ? (
                                    <span className={`rounded-md border px-2 py-1 ${hasScore ? 'border-primary-300/35 bg-primary-500/15 text-primary-100' : 'border-white/15 bg-white/5 text-slate-300'}`}>
                                      Puntaje: {hasScore ? `${Number(submission.score || 0)} / ${Number(submission.max_score || 0)}` : 'No aplica'}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end">
                            <Link
                              to={`/form/${public_id}/respuestas/${submission.id}`}
                              className="inline-flex items-center rounded-lg border border-primary-300/40 bg-primary-500/15 px-3 py-2 text-xs font-semibold text-primary-100 transition hover:bg-primary-500/25"
                            >
                              Ver respuestas
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              <section className="mt-6 space-y-8">
                {questionStats.length === 0 ? (
                  <div className="py-14 text-center text-slate-300">No hay datos estadisticos para mostrar.</div>
                ) : (
                  questionStats.map((stat) => (
                    <article key={stat.questionId} className="rounded-2xl border border-white/10 bg-[#0f1522] p-6">
                      <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{stat.title}</h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">Tipo: {stat.type} | Registros: {stat.total}</p>
                        </div>
                      </div>

                      <div className="grid gap-5 md:grid-cols-[240px_1fr] md:items-center">
                        <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-white/10" style={{ background: stat.pieBackground }}>
                          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-primary-400/20 bg-[#090d14] text-center">
                            <div>
                              <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Total</p>
                              <p className="text-xl font-black text-white">{stat.total}</p>
                            </div>
                          </div>
                        </div>

                        <ul className="space-y-2">
                          {stat.segments.length > 0 ? stat.segments.map((segment) => (
                            <li key={`${stat.questionId}-${segment.label}`} className="flex items-center justify-between gap-3 border-b border-white/10 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                                <span className="truncate text-sm text-slate-200" title={segment.label}>{segment.label}</span>
                              </div>
                              <span className="text-sm font-semibold text-primary-200">{segment.count}</span>
                            </li>
                          )) : (
                            <li className="text-sm text-slate-400">Sin respuestas registradas.</li>
                          )}
                        </ul>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
