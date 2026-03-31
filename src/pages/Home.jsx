import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import DashboardHeader from '../components/common/DashboardHeader';
import AiGenerateModal from '../components/common/AiGenerateModal';
import FormCardThumbnail from '../components/common/FormCardThumbnail';
import { useSession } from '../hooks/useSession';
import { useProfile } from '../hooks/useProfile';
import { useDeleteFormMutation, useGetFormsQuery } from '../redux/services/formsApi';
import CreateFormIcon from '../assets/icons/CreateFormIcon';
import GenerateAiIcon from '../assets/icons/GenerateAiIcon';
import JoinCodeIcon from '../assets/icons/JoinCodeIcon';

export default function Home() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [openMenuFormId, setOpenMenuFormId] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const menuRef = useRef(null);
  const userId = session?.user?.id;
  const { profile } = useProfile(userId);
  const { data: forms = [], isLoading: loading } = useGetFormsQuery(userId, {
    skip: !userId,
  });
  const [deleteForm] = useDeleteFormMutation();
  const searchQuery = useSelector((state) => state.homeUi?.searchQuery || '');

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

    return { label: 'Borrador', className: 'bg-slate-500/25 border-slate-300/35 text-slate-100', isPublished: false };
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
        <div className='bg-white/5 w-full h-full   z-30 mx-auto px-24 py-4'>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h2 className="text-xl  text-white tracking-tight">Formularios recientes</h2>

        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-16">Cargando...</div>
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
                  const isStrictOrNormal = ['strict', 'normal'].includes(String(form.form_mode || 'normal').toLowerCase());
                  return (
                <article
                  key={form.id}
                  className="relative cursor-pointer overflow-visible rounded-lg border border-white/12 bg-white/5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition"
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

                  <div className="px-4 pt-2 pb-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide ${publishMeta.isPublished ? 'px-0 py-0' : 'rounded-full border px-2.5 py-1'} ${publishMeta.className}`}>
                        {publishMeta.isPublished ? <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" /> : null}
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

                          {isStrictOrNormal ? (
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
                    <h3 className="text-[22px] leading-7 font-medium text-white truncate">{form.title || 'Formulario sin título'}</h3>
                  </div>

                  <div className="relative border-t border-white/8 px-4 py-3 flex items-center justify-between" ref={openMenuFormId === form.id ? menuRef : null}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="h-4 w-4 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
          navigate('/form', {
            state: { aiGeneratedTemplate: template },
          })
        }}
      />
    </main>
  )
}

