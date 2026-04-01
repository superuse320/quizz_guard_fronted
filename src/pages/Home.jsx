import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import DashboardHeader from '../components/common/DashboardHeader';
import AiGenerateModal from '../components/common/AiGenerateModal';
import FormCardThumbnail from '../components/common/FormCardThumbnail';
import { useSession } from '../hooks/useSession';
import { useProfile } from '../hooks/useProfile';
import { normalizeFormPayload } from '../utils/formTemplateLoader';
import { useDeleteFormMutation, useGetFormsQuery, useUpsertFormMutation } from '../redux/services/formsApi';
import { supabase } from '../lib/supabase';
import CreateFormIcon from '../assets/icons/CreateFormIcon';
import GenerateAiIcon from '../assets/icons/GenerateAiIcon';
import JoinCodeIcon from '../assets/icons/JoinCodeIcon';
import { PencilIcon } from '../assets/icons/PencilIcon';

const MIDNIGHT_BLUE_THEME = {
  primary: '#4f7cff',
  accent: '#38bdf8',
  surface: '#0d1424',
  bgFrom: '#02040b',
  bgTo: '#090f1e',
};

export default function Home() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [openMenuFormId, setOpenMenuFormId] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showTemplateModeModal, setShowTemplateModeModal] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const [creatingDraftFromTemplate, setCreatingDraftFromTemplate] = useState(false);
  const [templateModeError, setTemplateModeError] = useState('');
  const menuRef = useRef(null);
  const userId = session?.user?.id;
  const { profile } = useProfile(userId);
  const { data: forms = [], isLoading: loading } = useGetFormsQuery(userId, {
    skip: !userId,
  });
  const [deleteForm] = useDeleteFormMutation();
  const [upsertForm] = useUpsertFormMutation();
  const searchQuery = useSelector((state) => state.homeUi?.searchQuery || '');

  const generateQuizCode = () =>
    Math.random().toString(36).slice(2, 8).toUpperCase();

  const toIsoDateTimeOrNull = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const createDraftFromTemplate = async (rawTemplate, selectedMode) => {
    const normalized = normalizeFormPayload(rawTemplate);
    const questions = Array.isArray(normalized.questions) ? normalized.questions : [];
    const sectionCount = Math.max(1, ...questions.map((q) => Number(q.section) || 1));
    const aiDraftTheme = {
      ...MIDNIGHT_BLUE_THEME,
      coverImage: normalized?.theme?.coverImage || '',
    };

    const strictDurationEnabled = selectedMode === 'strict';
    const strictWindowEnabled = false;
    const strictDurationMinutes = 60;
    const strictSettings = {
      strict_duration_enabled: strictDurationEnabled,
      strict_duration_minutes: strictDurationMinutes,
      strict_window_enabled: strictWindowEnabled,
      strict_starts_at: null,
      strict_ends_at: null,
      strict_require_auth: selectedMode === 'strict',
    };

    const formData = {
      title: normalized.title || 'Formulario IA',
      description: normalized.description || '',
      status: 'draft',
      form_mode: selectedMode,
      is_quiz: selectedMode === 'quiz',
      requires_auth: selectedMode === 'strict',
      opened_at: strictWindowEnabled ? toIsoDateTimeOrNull(normalized.strictStartsAt) : null,
      closed_at: strictWindowEnabled ? toIsoDateTimeOrNull(normalized.strictEndsAt) : null,
      settings: strictSettings,
      theme: aiDraftTheme,
      cover_image_url: aiDraftTheme.coverImage || null,
      join_code: selectedMode === 'quiz' ? generateQuizCode() : null,
    };

    const formRow = await upsertForm({
      editMode: false,
      publicId: null,
      formData,
    }).unwrap();

    const formId = formRow.id;
    const publicId = formRow.public_id;

    const sectionMap = new Map();
    const sectionsPayload = [];
    for (let section = 1; section <= sectionCount; section += 1) {
      const sectionId = uuidv4();
      sectionMap.set(section, sectionId);
      sectionsPayload.push({
        id: sectionId,
        form_id: formId,
        title: `Sección ${section}`,
        description: '',
        position: section,
      });
    }

    if (sectionsPayload.length > 0) {
      const { error: sectionsInsertError } = await supabase
        .from('form_sections')
        .insert(sectionsPayload);
      if (sectionsInsertError) throw sectionsInsertError;
    }

    const questionsPayload = [];
    const optionsPayload = [];

    for (let idx = 0; idx < questions.length; idx += 1) {
      const q = questions[idx];
      const questionId = uuidv4();

      questionsPayload.push({
        id: questionId,
        form_id: formId,
        section_id: sectionMap.get(Number(q.section) || 1),
        position: idx + 1,
        type: q.type,
        title: q.title,
        description: q.description,
        required: Boolean(q.required),
        required_condition_enabled: Boolean(q.requiredConditionEnabled),
        required_condition_question_id: null,
        required_condition_operator: '=',
        required_condition_value: q.requiredConditionValue ?? null,
        points: q.points,
        settings: {
          short_answer_correct: q.type === 'short_answer' ? (q.shortAnswerCorrect || '').trim() : null,
          short_answer_variants: q.type === 'short_answer'
            ? String(q.shortAnswerVariants || '')
              .split(/[\n,;]+/)
              .map((item) => item.trim())
              .filter(Boolean)
            : [],
          number_correct: q.type === 'number' && q.numberCorrect !== '' ? Number(q.numberCorrect) : null,
          date_correct: q.type === 'date' ? (q.dateCorrect || null) : null,
          time_correct: q.type === 'time' ? (q.timeCorrect || null) : null,
        },
      });

      if (Array.isArray(q.options) && q.options.length > 0) {
        for (let optIdx = 0; optIdx < q.options.length; optIdx += 1) {
          optionsPayload.push({
            id: uuidv4(),
            question_id: questionId,
            position: optIdx + 1,
            label: q.options[optIdx],
            value: null,
            is_correct: Array.isArray(q.correctAnswers) ? q.correctAnswers.includes(optIdx) : false,
            metadata: {},
          });
        }
      }
    }

    if (questionsPayload.length > 0) {
      const { error: questionsInsertError } = await supabase
        .from('form_questions')
        .insert(questionsPayload);
      if (questionsInsertError) throw questionsInsertError;
    }

    const optionBatchSize = 250;
    for (let start = 0; start < optionsPayload.length; start += optionBatchSize) {
      const batch = optionsPayload.slice(start, start + optionBatchSize);
      const { error: optionsInsertError } = await supabase
        .from('form_question_options')
        .insert(batch);
      if (optionsInsertError) throw optionsInsertError;
    }

    return publicId;
  };

  const handleSelectTemplateMode = async (selectedMode) => {
    if (!pendingTemplate || creatingDraftFromTemplate) return;

    setTemplateModeError('');
    setCreatingDraftFromTemplate(true);

    try {
      const publicId = await createDraftFromTemplate(pendingTemplate, selectedMode);
      setShowTemplateModeModal(false);
      setPendingTemplate(null);
      navigate(`/form/${publicId}/edit`, {
        state: { successToast: 'Borrador creado desde plantilla IA.' },
      });
    } catch (error) {
      setTemplateModeError(error?.data || error?.message || 'No se pudo crear el borrador desde la plantilla.');
    } finally {
      setCreatingDraftFromTemplate(false);
    }
  };

  const getFormModeMeta = (formMode) => {
    const mode = String(formMode || 'normal').toLowerCase();
    if (mode === 'quiz') {
      return { label: 'Quiz', className: 'bg-blue-400 text-blue-950 border-blue-200/90 shadow-lg shadow-blue-500/45' };
    }
    if (mode === 'strict') {
      return { label: 'Examen', className: 'bg-amber-400 text-amber-950 border-amber-200/90 shadow-lg shadow-amber-500/45' };
    }
    return { label: 'Normal', className: 'bg-emerald-400 text-emerald-950 border-emerald-200/90 shadow-lg shadow-emerald-500/45' };
  };

  const getPublishStatusMeta = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (normalized === 'published') {
      return { label: 'Publicado', className: 'text-emerald-300', isPublished: true };
    }

    return { label: 'Borrador', className: 'bg-slate-500/25 text-slate-100', isPublished: false };
  };

  const formatHumanDate = (value) => {
    if (!value) return 'Fecha desconocida';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha desconocida';

    const now = Date.now();
    const diffMs = now - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < hour) {
      const mins = Math.max(1, Math.floor(diffMs / minute));
      return mins === 1 ? 'hace 1 minuto' : `hace ${mins} minutos`;
    }

    if (diffMs < day) {
      const hours = Math.max(1, Math.floor(diffMs / hour));
      return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
    }

    if (diffMs < 7 * day) {
      const days = Math.max(1, Math.floor(diffMs / day));
      return days === 1 ? 'hace 1 dia' : `hace ${days} dias`;
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const liquidGlassCardClass =
    'group relative w-full cursor-pointer overflow-hidden text-left min-h-36 px-5 pt-9 pb-4 rounded-2xl border border-white/25 bg-white/[0.08] backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150 shadow-[0_12px_38px_rgba(8,12,20,0.45),inset_0_1px_0_rgba(255,255,255,0.38),inset_0_-1px_0_rgba(255,255,255,0.08)] hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/35 hover:shadow-[0_20px_50px_rgba(10,14,24,0.6),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(255,255,255,0.14)] transition-all duration-500';

  const normalizeSearchValue = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const filteredForms = forms.filter((form) => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) return true;

    const modeMeta = getFormModeMeta(form.form_mode);
    const statusMeta = getPublishStatusMeta(form.status);
    const searchableText = normalizeSearchValue([
      form.title,
      form.public_id,
      modeMeta.label,
      statusMeta.label,
      formatHumanDate(form.created_at),
    ].join(' '));

    return searchableText.includes(normalizedQuery);
  });

  useEffect(() => {
    if (!openMenuFormId) return;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuFormId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuFormId]);

  if (!session || !session.user) {
    return null;
  }

  return (
    <main className=" bg-black text-white">
      <DashboardHeader email={session.user.email} name={profile?.name} />
        <div className="pointer-events-none absolute left-1/2 translate-y-30 -translate-x-1/2 size-[45vw] bg-primary-600 rounded-full blur-[290px] opacity-70 " />

      <section className="relative px-6 md:px-20 pt-6 pb-8 overflow-hidden">
        <div className="relative flex flex-col gap-4 md:gap-0 md:flex-row md:items-stretch md:justify-center md:-space-x-4">
          <div className="relative md:w-72">
            <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 h-11 w-11 rounded-full bg-[#0f131d] border border-white/15 shadow-md grid place-items-center z-40">
              <CreateFormIcon className="w-5 h-5 text-white" />
            </div>
            <button
              className={liquidGlassCardClass}
              style={{ clipPath: 'polygon(0 0, 94% 0, 100% 100%, 0 100%)' }}
              onClick={() => navigate('/form')}
            >
              <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/5 via-white/0 cursor-pointer to-transparent opacity-75" />
              <span className="pointer-events-none absolute -left-1/2 top-[-120%] h-[280%] w-[48%] rotate-22 bg-linear-to-r from-transparent via-white/55 to-transparent opacity-0 blur-md transition-all duration-700 group-hover:left-[125%] group-hover:opacity-100" />
              <span className="pointer-events-none absolute inset-x-[18%] top-1 h-8 rounded-full bg-white/10 blur-xl opacity-55" />
              <p className="text-center text-white font-semibold text-xl leading-6 mt-1 tracking-tight">Crear Formulario</p>
              <p className="text-center text-[#8b93a7] text-sm leading-5 mt-2">Empieza desde cero</p>
            </button>
          </div>

          <div className="relative md:w-72 z-10">
            <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 h-11 w-11 rounded-full bg-[#0f131d] border border-white/15 shadow-md grid place-items-center z-40">
              <GenerateAiIcon className="w-5 h-5 text-white" />
            </div>
            <button
              className={liquidGlassCardClass}
              style={{ clipPath: 'polygon(2% 0, 98% 0, 88% 100%, 8% 100%)' }}
              onClick={() => setShowAiModal(true)}
            >
              <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/5 via-white/0 cursor-pointer to-transparent opacity-75" />
              <span className="pointer-events-none absolute -left-1/2 top-[-120%] h-[280%] w-[48%] rotate-22 bg-linear-to-r from-transparent via-white/55 to-transparent opacity-0 blur-md transition-all duration-700 group-hover:left-[125%] group-hover:opacity-100" />
              <span className="pointer-events-none absolute inset-x-[18%] top-1 h-8 rounded-full bg-white/10 blur-xl opacity-55" />
              <p className="text-center text-[#dce2ef] font-semibold text-xl leading-6 mt-1 tracking-tight">Generar con IA</p>
              <p className="text-center text-[#8b93a7] text-sm leading-5 mt-2">Crea preguntas rapido</p>
            </button>
          </div>

          <div className="relative md:w-72 md:-ml-2">
            <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 h-11 w-11 rounded-full bg-[#0f131d] border border-white/15 shadow-md grid place-items-center z-40">
              <JoinCodeIcon className="w-5 h-5 text-white" />
            </div>
            <button
              className={liquidGlassCardClass}
              style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0 100%)' }}
              onClick={() => navigate('/join-quiz')}
            >
              <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/5 via-white/0 cursor-pointer to-transparent opacity-75" />
              <span className="pointer-events-none absolute -left-1/2 top-[-120%] h-[280%] w-[48%] rotate-22 bg-linear-to-r from-transparent via-white/55 to-transparent opacity-0 blur-md transition-all duration-700 group-hover:left-[125%] group-hover:opacity-100" />
              <span className="pointer-events-none absolute inset-x-[18%] top-1 h-8 rounded-full bg-white/10 blur-xl opacity-55" />
              <p className="text-center text-[#dce2ef] font-semibold text-xl leading-6 mt-1 tracking-tight">Unirme con código</p>
              <p className="text-center text-[#8b93a7] text-sm leading-5 mt-2">Ingresa a una sesion</p>
            </button>
          </div>
        </div>
      </section>


      <div className="bg-black w-full relative flex-1 h-[140vh]">
        <div className='bg-white/5 w-full h-full   z-30 mx-auto px-28 py-4'>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h2 className="text-xl  text-white tracking-tight">Formularios recientes</h2>

        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <article key={`form-skeleton-${idx}`} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.035] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
                <div className="h-32 border-b border-white/8 p-3 shimmer-strip-dark-soft">
                  <div className="h-full w-full rounded-md bg-white/4.5" />
                </div>
                <div className="px-4 pt-3 pb-2">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="h-5 w-20 rounded-full bg-white/7.5 shimmer-strip-dark-soft" />
                    <span className="h-5 w-16 rounded-md bg-white/7.5 shimmer-strip-dark-soft" />
                  </div>
                  <div className="h-5 w-4/5 rounded-md bg-white/7.5 shimmer-strip-dark-soft" />
                </div>
                <div className="border-t border-white/8 px-4 py-3 flex items-center justify-between">
                  <span className="h-4 w-28 rounded-md bg-white/7.5 shimmer-strip-dark-soft" />
                  <span className="h-8 w-8 rounded-full bg-white/7.5 shimmer-strip-dark-soft" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">


            {/* Cards de formularios */}
            {forms.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-white/15 grid place-items-center">
                  <svg className="h-8 w-8 text-primary-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6A2.25 2.25 0 0 1 15.75 6v.75h.75A2.25 2.25 0 0 1 18.75 9v10.5A2.25 2.25 0 0 1 16.5 21.75h-9A2.25 2.25 0 0 1 5.25 19.5V9A2.25 2.25 0 0 1 7.5 6.75h.75V6A2.25 2.25 0 0 1 10.5 3.75Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 11.25h6M9 14.25h6M9 17.25h3" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-white">Aún no has creado formularios</h3>
                <p className="mt-2 text-sm text-gray-400">Empieza creando uno nuevo desde las opciones superiores.</p>
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-white/15 grid place-items-center">
                  <svg className="h-8 w-8 text-primary-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.6-3.6" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-white">No se encontraron formularios</h3>
                <p className="mt-2 text-sm text-gray-400">Prueba con otro término en el buscador.</p>
              </div>
            ) : (
              filteredForms.map((form) => (
                (() => {
                  const modeMeta = getFormModeMeta(form.form_mode);
                  const publishMeta = getPublishStatusMeta(form.status);
                  const isQuiz = String(form.form_mode || '').toLowerCase() === 'quiz';
                  const isStrict = String(form.form_mode || '').toLowerCase() === 'strict';
                  const isNormal = String(form.form_mode || 'normal').toLowerCase() === 'normal';
                  return (
                <article
                  key={form.id}
                  className="relative flex h-full cursor-pointer flex-col overflow-visible rounded-lg border border-white/12 bg-white/5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                  onClick={() => navigate(`/form/${form.public_id}/edit`)}
                >
                  <button
                    className="w-full text-left"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/form/${form.public_id}/edit`);
                    }}
                  >
                    <div className="relative h-32 border-b border-white/8 px-3 pt-3 pb-2">
                      <span className={`absolute right-5 top-4 z-10 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${modeMeta.className}`}>
                        {modeMeta.label}
                      </span>
                      <FormCardThumbnail
                        formMode={form.form_mode}
                        previewQuestions={form.previewQuestions || []}
                        formTheme={form.theme}
                        formTitle={form.title}
                        formDescription={form.description}
                      />
                    </div>
                  </button>

                  <div className="flex-1 px-4 pt-2 pb-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${publishMeta.isPublished ? 'px-0 py-0' : 'rounded-full px-2.5 py-1'} ${publishMeta.className}`}>
                        {publishMeta.isPublished ? <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" /> : null}
                        {!publishMeta.isPublished ? <PencilIcon className="h-3 w-3" /> : null}
                        {publishMeta.label}
                      </span>
                      {!isQuiz ? (
                        <div className="ml-auto flex items-center gap-2">
                          {isStrict ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/form/${form.public_id}/strict-control`);
                              }}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-amber-300/35 px-2.5 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/10"
                              title="Panel de control estricto"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="4" rx="1" />
                                <rect x="14" y="10" width="7" height="11" rx="1" />
                                <rect x="3" y="12" width="7" height="9" rx="1" />
                              </svg>
                              Dashboard
                            </button>
                          ) : null}

                          {isNormal ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/form/${form.public_id}/respuestas`);
                              }}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-blue-300/35 px-2.5 py-1 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/10"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 5h18" />
                                <path d="M3 12h18" />
                                <path d="M3 19h18" />
                              </svg>
                              Respuestas
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              window.open(`/formulario/${form.public_id}`, '_blank');
                            }}
                            className="inline-flex cursor-pointer h-7 w-7 items-center justify-center rounded-md border border-gray-300/35 text-gray-200 transition hover:bg-gray-500/10"
                            aria-label="Abrir enlace publico"
                            title="Abrir enlace publico"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M10 13a5 5 0 0 0 7.54.54l2.12-2.12a5 5 0 1 0-7.07-7.07L11.4 5.52" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54L4.34 12.58a5 5 0 0 0 7.07 7.07l1.17-1.17" />
                            </svg>
                          </button>
                        </div>
                      ) : null}
                      {isQuiz ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/form/${form.public_id}/quiz-control`);
                          }}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-blue-300/35 px-2.5 py-1 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/10"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="11" width="4" height="10" rx="1" />
                            <rect x="10" y="7" width="4" height="14" rx="1" />
                            <rect x="17" y="3" width="4" height="18" rx="1" />
                          </svg>
                          Panel de control
                        </button>
                      ) : null}
                    </div>
                    <h3 className="text-[19px] leading-6 font-medium text-white truncate">{form.title || 'Formulario sin título'}</h3>
                  </div>

                  <div className="relative mt-auto flex items-center justify-between border-t border-white/8 px-4 py-3" ref={openMenuFormId === form.id ? menuRef : null}>
                    <div className="flex items-center gap-1.5 text-xs text-gray-300">
                      <svg className="h-3.5 w-3.5 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>Creado {formatHumanDate(form.created_at)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenuFormId((prev) => (prev === form.id ? null : form.id));
                      }}
                      className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10 text-gray-400"
                      aria-label="Opciones"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                    </button>

                    {openMenuFormId === form.id ? (
                      <div className="absolute right-2 top-11 z-20 w-44 rounded-lg border border-white/10 bg-[#10141d] shadow-2xl p-1">
                        {isStrict ? (
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded text-blue-300 hover:bg-blue-500/10"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/form/${form.public_id}/respuestas`);
                              setOpenMenuFormId(null);
                            }}
                          >
                            Respuestas
                          </button>
                        ) : null}
                        <button
                          className="w-full text-left px-3 py-2 text-sm rounded text-red-400 hover:bg-red-500/10"
                          onClick={async (event) => {
                            event.stopPropagation();
                            if (window.confirm('¿Seguro que deseas eliminar este formulario? Esta acción no se puede deshacer.')) {
                              try {
                                await deleteForm(form.id).unwrap();
                                setOpenMenuFormId(null);
                              } catch (error) {
                                alert('Error al eliminar: ' + (error?.data || error?.message || 'Error desconocido'));
                              }
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
                  );
                })()
              ))
            )}
          </div>
        )}
        </div>

      </div>

      <AiGenerateModal
        isOpen={showAiModal}
        accessToken={session?.access_token}
        onClose={() => setShowAiModal(false)}
        onUseTemplate={(template) => {
          setShowAiModal(false)
          setPendingTemplate(template)
          setTemplateModeError('')
          setShowTemplateModeModal(true)
        }}
      />

      {showTemplateModeModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-xl p-4 overflow-hidden">
          {/* Fondo decorativo */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute top-1/3 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl" />
          </div>

          <div className="w-full max-w-4xl rounded-3xl border border-white/15 bg-black/90 p-8 shadow-2xl backdrop-blur-sm overflow-y-auto max-h-[90vh] relative z-10">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400/80">Selecciona tu tipo</p>
                <h3 className="mt-3 text-4xl font-bold text-white">¿Qué quieres crear?</h3>
                <p className="mt-2 text-sm text-slate-300">Elige la opción que mejor se adapte a lo que necesitas</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (creatingDraftFromTemplate) return;
                  setShowTemplateModeModal(false);
                  setPendingTemplate(null);
                }}
                className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 px-4 py-2 text-sm text-slate-200 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur shrink-0 cursor-pointer"
                disabled={creatingDraftFromTemplate}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-3 mb-6">
              <button
                type="button"
                onClick={() => handleSelectTemplateMode('normal')}
                disabled={creatingDraftFromTemplate}
                className="group relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-black/60 p-5 text-left shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 hover:border-emerald-400/80 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-60 hover:-translate-y-1 backdrop-blur cursor-pointer"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 bg-linear-to-br from-emerald-400 to-transparent transition-opacity duration-300" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-emerald-500/20 mb-4 group-hover:bg-emerald-500/40 transition-colors">
                    <CreateFormIcon className="w-5 h-5 text-emerald-300" />
                  </div>
                  <p className="text-lg font-bold text-emerald-100">Formulario</p>
                  <p className="mt-1 text-xs text-emerald-300/70 font-medium">Para recopilar opiniones</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2">Úsalo para:</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        <li className="flex gap-2"><svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Encuestas</li>
                        <li className="flex gap-2"><svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Comentarios</li>
                        <li className="flex gap-2"><svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Registros</li>
                      </ul>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-emerald-500/10">
                      <div className="flex gap-2 items-center text-xs text-slate-500 font-medium mt-2">
                        <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><path d="M12 1v6m0 6v6"></path><path d="M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24"></path><path d="M1 12h6m6 0h6"></path><path d="M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24"></path></svg>
                        Sin prisa
                      </div>
                      <p className="text-xs text-slate-500">Completa cuando quieras</p>
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplateMode('quiz')}
                disabled={creatingDraftFromTemplate}
                className="group relative overflow-hidden rounded-2xl border border-blue-500/40 bg-black/60 p-5 text-left shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:border-blue-400/80 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-60 hover:-translate-y-1 backdrop-blur cursor-pointer"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 bg-linear-to-br from-blue-400 to-transparent transition-opacity duration-300" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-blue-500/20 mb-4 group-hover:bg-blue-500/40 transition-colors">
                    <JoinCodeIcon className="w-5 h-5 text-blue-300" />
                  </div>
                  <p className="text-lg font-bold text-blue-100">Quiz</p>
                  <p className="mt-1 text-xs text-blue-300/70 font-medium">Para competir y aprender</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2">Úsalo para:</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        <li className="flex gap-2"><svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Jugar</li>
                        <li className="flex gap-2"><svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Competir</li>
                        <li className="flex gap-2"><svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Divertirse</li>
                      </ul>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-blue-500/10">
                      <div className="flex gap-2 items-center text-xs text-slate-500 font-medium mt-2">
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M4 9h16M4 15h16"></path></svg>
                        Rápido y vivo
                      </div>
                      <p className="text-xs text-slate-500">Puntajes en tiempo real</p>
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplateMode('strict')}
                disabled={creatingDraftFromTemplate}
                className="group relative overflow-hidden rounded-2xl border border-amber-500/40 bg-black/60 p-5 text-left shadow-lg hover:shadow-amber-500/20 transition-all duration-300 hover:border-amber-400/80 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-60 hover:-translate-y-1 backdrop-blur cursor-pointer"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 bg-linear-to-br from-amber-400 to-transparent transition-opacity duration-300" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-amber-500/20 mb-4 group-hover:bg-amber-500/40 transition-colors">
                    <GenerateAiIcon className="w-5 h-5 text-amber-300" />
                  </div>
                  <p className="text-lg font-bold text-amber-100">Examen</p>
                  <p className="mt-1 text-xs text-amber-300/70 font-medium">Para evaluar correctamente</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2">Úsalo para:</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        <li className="flex gap-2"><svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Exámenes</li>
                        <li className="flex gap-2"><svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Pruebas serias</li>
                        <li className="flex gap-2"><svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Certificación</li>
                      </ul>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-amber-500/10">
                      <div className="flex gap-2 items-center text-xs text-slate-500 font-medium mt-2">
                        <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L9.464 9.036H1.036L7.764 13.764L5.228 21.8L12 17.072L18.772 21.8L16.236 13.764L22.964 9.036H14.536L12 1Z"></path></svg>
                        Seguro
                      </div>
                      <p className="text-xs text-slate-500">Supervisado y controlado</p>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {templateModeError ? (
              <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
                {templateModeError}
              </div>
            ) : null}

            {creatingDraftFromTemplate ? (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-sky-200">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M4 12a8 8 0 0114.928-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Preparando tu formulario...
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}

