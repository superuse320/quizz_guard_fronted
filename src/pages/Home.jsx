import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/common/DashboardHeader';
import AiGenerateModal from '../components/common/AiGenerateModal';
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

  const liquidGlassCardClass =
    'group relative w-full cursor-pointer overflow-hidden text-left min-h-36 px-5 pt-9 pb-4 rounded-2xl border border-white/25 bg-white/[0.08] backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150 shadow-[0_12px_38px_rgba(8,12,20,0.45),inset_0_1px_0_rgba(255,255,255,0.38),inset_0_-1px_0_rgba(255,255,255,0.08)] hover:-translate-y-1 hover:bg-white/[0.12] hover:border-white/35 hover:shadow-[0_20px_50px_rgba(10,14,24,0.6),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(255,255,255,0.14)] transition-all duration-500';

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
            ) : (
              forms.map((form) => (
                <article
                  key={form.id}
                  className="relative cursor-pointer overflow-visible rounded-lg border border-white/12 bg-[#151923] shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition"
                >
                  <button
                    className="w-full text-left"
                    onClick={() => navigate(`/form/${form.public_id}/edit`)}
                  >
                    <div className="h-40 border-b border-white/8 bg-linear-to-br from-[#2a3040] via-[#20263a] to-[#1a1f2f] p-3">
                      <div className="h-full w-full rounded bg-white/95 p-2">
                        <div className="h-1.5 w-2/3 rounded bg-[#8f5ad9]" />
                        <div className="mt-2 h-1.5 w-1/2 rounded bg-gray-300" />
                        <div className="mt-2 space-y-1.5">
                          <div className="h-1.5 w-full rounded bg-gray-200" />
                          <div className="h-1.5 w-[92%] rounded bg-gray-200" />
                          <div className="h-1.5 w-[88%] rounded bg-gray-200" />
                          <div className="h-1.5 w-[90%] rounded bg-gray-200" />
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="px-4 pt-3 pb-2">
                    <h3 className="text-[22px] leading-7 font-medium text-white truncate">{form.title || 'Formulario sin título'}</h3>
                  </div>

                  <div className="relative border-t border-white/8 px-4 py-3 flex items-center justify-between" ref={openMenuFormId === form.id ? menuRef : null}>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <svg className="w-4 h-4 text-[#b084ff]" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 4v2h8V7H7Zm0 4v2h8v-2H7Zm0 4v2h5v-2H7Z" /></svg>
                      <span>Abierto {new Date(form.created_at).toLocaleDateString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenMenuFormId((prev) => (prev === form.id ? null : form.id))}
                      className="h-8 w-8 rounded-full grid place-items-center hover:bg-white/10 text-gray-400"
                      aria-label="Opciones"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                    </button>

                    {openMenuFormId === form.id ? (
                      <div className="absolute right-2 top-11 z-20 w-44 rounded-lg border border-white/10 bg-[#10141d] shadow-2xl p-1">
                        <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/8" onClick={() => { setOpenMenuFormId(null); navigate(`/form/${form.public_id}/respuestas`); }}>Respuestas</button>
                        <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/8" onClick={() => { setOpenMenuFormId(null); navigate(`/formulario/${form.public_id}`); }}>Ver</button>
                        <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/8" onClick={() => { setOpenMenuFormId(null); navigate(`/form/${form.public_id}/edit`); }}>Editar</button>
                        <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/8" onClick={() => { setOpenMenuFormId(null); window.open(`/formulario/${form.public_id}`, '_blank'); }}>Link público</button>
                        <div className="my-1 h-px bg-white/10" />
                        <button
                          className="w-full text-left px-3 py-2 text-sm rounded text-red-400 hover:bg-red-500/10"
                          onClick={async () => {
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

