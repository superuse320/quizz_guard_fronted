import { useParams } from 'react-router-dom';
import DashboardHeader from '../components/common/DashboardHeader';
import { useSession } from '../hooks/useSession';
import { useProfile } from '../hooks/useProfile';
import { useGetFormSubmissionDetailQuery } from '../redux/services/formsApi';

const AVATAR_COLORS = ['bg-primary-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];

const getAvatarColorClass = (seed) => {
  const base = String(seed || 'U');
  const first = base.charCodeAt(0) || 1;
  const last = base.charCodeAt(base.length - 1) || 1;
  return AVATAR_COLORS[(first + last) % AVATAR_COLORS.length];
};

const getAnswerToneClasses = (isCorrect) => {
  if (isCorrect === true) {
    return {
      selected: 'border-emerald-300 bg-emerald-500/25 font-semibold text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]',
      label: 'text-emerald-400',
    };
  }

  if (isCorrect === false) {
    return {
      selected: 'border-rose-300 bg-rose-500/25 font-semibold text-rose-50 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]',
      label: 'text-rose-400',
    };
  }

  return {
    selected: 'border-primary-300 bg-primary-500/25 font-semibold text-primary-50 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]',
    label: 'text-primary-200',
  };
};

export default function FormAnswerDetailPage() {
  const { public_id, submission_id } = useParams();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { profile } = useProfile(userId);

  const { data, isLoading: loading, isError, error } = useGetFormSubmissionDetailQuery(
    { publicId: public_id, submissionId: submission_id },
    { skip: !public_id || !submission_id }
  );

  const form = data?.form || null;
  const blockedByQuizMode = Boolean(data?.blockedByQuizMode);
  const questions = data?.questions || [];
  const options = data?.options || [];
  const answers = data?.answers || [];
  const submission = data?.submission || null;
  const respondentName = data?.respondentName || 'Anonimo';
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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090d14] text-slate-100">
        <DashboardHeader email={session?.user?.email} name={profile?.name} showSearch={false} />
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="space-y-3 border-b border-white/12 pb-6">
            <div className="h-3 w-40 rounded bg-slate-700/70 shimmer-strip-dark" />
            <div className="h-8 w-3/5 rounded bg-slate-700/70 shimmer-strip-dark" />
            <div className="h-4 w-4/5 rounded bg-slate-700/60 shimmer-strip-dark" />
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={`meta-skel-${idx}`} className="h-24 rounded-xl border border-white/10 bg-[#0d1420]/95 p-4">
                <div className="h-3 w-24 rounded bg-slate-700/70 shimmer-strip-dark" />
                <div className="mt-3 h-4 w-40 rounded bg-slate-700/70 shimmer-strip-dark" />
                <div className="mt-2 h-3 w-52 rounded bg-slate-700/60 shimmer-strip-dark" />
              </div>
            ))}
          </section>

          <section className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`q-skel-${idx}`} className="border-b border-white/10 py-5">
                <div className="h-5 w-3/5 rounded bg-slate-700/70 shimmer-strip-dark" />
                <div className="mt-2 h-3 w-4/5 rounded bg-slate-700/60 shimmer-strip-dark" />
                <div className="mt-4 h-10 w-full rounded bg-slate-700/60 shimmer-strip-dark" />
              </div>
            ))}
          </section>
        </div>
      </main>
    );
  }
  if (blockedByQuizMode) return <main className="min-h-screen bg-[#090d14] text-slate-100"><div className="py-16 text-center text-slate-300">Las respuestas no estan disponibles para formularios tipo quiz.</div></main>;
  if (!form || !submission) return <main className="min-h-screen bg-[#090d14] text-slate-100"><div className="py-16 text-center text-slate-300">No encontrado</div></main>;
  if (errorMsg) return <main className="min-h-screen bg-[#090d14] text-slate-100"><div className="py-16 text-center text-rose-300">{errorMsg}</div></main>;

  return (
    <main className="min-h-screen bg-[#090d14] text-slate-100">
      <DashboardHeader email={session?.user?.email} name={profile?.name} showSearch={false} />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.16em] text-primary-200/90">Detalle de envio</p>
          <h1 className="mt-2 text-3xl font-black text-white">{form.title}</h1>
          <p className="mt-2 text-sm text-slate-300">{form.description || 'Sin descripcion'}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border-l-2 border-primary-400/60 pl-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Respondiente</p>
              <div className="mt-2 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full ${getAvatarColorClass(respondentName)} grid place-items-center text-xs font-bold text-white`}>
                  {String(respondentName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{respondentName}</p>
                  <p className="text-sm text-slate-300">{submission.respondent_email || 'Sin email registrado'}</p>
                </div>
              </div>
            </div>
            <div className="border-l-2 border-white/20 pl-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Fecha de envio</p>
              <p className="mt-1 text-lg font-bold text-white">{formatDateTime(submission.submitted_at)}</p>
              <p className="mt-1 text-sm text-slate-300">Inicio: {formatDateTime(submission.started_at)}</p>
              {Number(submission.max_score || 0) > 0 ? (
                <p className="mt-1 text-sm font-semibold text-primary-200">Puntaje: {Number(submission.score || 0)} / {Number(submission.max_score || 0)}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
        {questions.map(q => {
          const ans = answers.find(a => a.question_id === q.id);
          const tone = getAnswerToneClasses(ans?.is_correct);
          let val = ans ? ans.answer_value : null;
          try { if (typeof val === 'string') val = JSON.parse(val); } catch {}
          // Opciones de la pregunta (si aplica)
          const qOptions = options.filter(opt => opt.question_id === q.id).sort((a, b) => a.position - b.position);
          // Renderizado de opciones seleccionadas
          const renderOptions = () => {
            if (['multiple_choice', 'dropdown'].includes(q.type)) {
              return (
                <div className="mt-2 flex flex-col gap-1.5">
                  {qOptions.map((opt, idx) => {
                    const selected = val === idx;
                    return (
                      <div key={opt.id} className={`rounded-md border px-3 py-2 ${selected ? tone.selected : 'border-white/10 bg-white/5 text-slate-300'}`}>
                        {opt.label || `Opción ${idx + 1}`}
                        {selected && <span className={`ml-2 ${tone.label}`}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              );
            }
            if (q.type === 'checkboxes') {
              return (
                <div className="mt-2 flex flex-col gap-1.5">
                  {qOptions.map((opt, idx) => {
                    const selected = Array.isArray(val) && val.includes(idx);
                    return (
                      <div key={opt.id} className={`rounded-md border px-3 py-2 ${selected ? tone.selected : 'border-white/10 bg-white/5 text-slate-300'}`}>
                        {opt.label || `Opción ${idx + 1}`}
                        {selected && <span className={`ml-2 ${tone.label}`}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              );
            }
            if (q.type === 'ranking') {
              // val es un array de índices
              return (
                <div className="mt-2 flex flex-col gap-1.5">
                  {Array.isArray(val) && val.map((optIdx, pos) => {
                    const opt = qOptions[optIdx];
                    return (
                      <div key={opt?.id || pos} className={`flex items-center gap-2 rounded-md border px-3 py-2 ${tone.selected}`}>
                        <span className={`w-6 text-xs ${tone.label}`}>{pos + 1}</span>
                        <span>{opt?.label || `Opción ${optIdx + 1}`}</span>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return null;
          };
          return (
            <article key={q.id} className="border-b border-white/10 py-5 last:border-b-0">
              <div className="mb-1 text-lg font-semibold text-white">{q.title}</div>
              <div className="mb-3 text-sm text-slate-400">{q.description || 'Sin descripcion'}</div>
              <div className="text-sm text-slate-200">
                {val === null || val === undefined ? (
                  <span className="italic text-slate-500">Sin respuesta</span>
                ) : ['multiple_choice', 'dropdown', 'checkboxes', 'ranking'].includes(q.type) ? (
                  renderOptions()
                ) : (
                  <div className={`rounded-md border px-3 py-2 font-medium ${tone.selected}`}>
                    {Array.isArray(val) ? val.map((v, i) => <span key={i} className="mr-2 inline-block">{String(v)}</span>) : String(val)}
                  </div>
                )}
              </div>
              {typeof ans?.is_correct === 'boolean' && (
                <div className={ans.is_correct ? 'mt-2 text-emerald-400 font-semibold' : 'mt-2 text-rose-400 font-semibold'}>
                  {ans.is_correct ? 'Correcta' : 'Incorrecta'}
                </div>
              )}
              {typeof ans?.points_earned === 'number' && (
                <div className="mt-1 text-xs text-primary-200">Puntos: {ans.points_earned}</div>
              )}
            </article>
          );
        })}
        </section>
      </div>
    </main>
  );
}
