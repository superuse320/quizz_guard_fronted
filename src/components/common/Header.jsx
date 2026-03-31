import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const featureItems = [
    {
        title: "Generar preguntas con IA",
        description: "Describe tu tema y la plataforma te propone preguntas listas para editar y publicar en minutos.",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 3v4" strokeLinecap="round" />
                <path d="M12 17v4" strokeLinecap="round" />
                <path d="M3 12h4" strokeLinecap="round" />
                <path d="M17 12h4" strokeLinecap="round" />
                <path d="M6.3 6.3l2.8 2.8" strokeLinecap="round" />
                <path d="M14.9 14.9l2.8 2.8" strokeLinecap="round" />
                <path d="M17.7 6.3l-2.8 2.8" strokeLinecap="round" />
                <path d="M9.1 14.9l-2.8 2.8" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3.5" />
            </svg>
        ),
    },
    {
        title: "Cambiar entre Quiz y Examen",
        description: "Usa modo quiz para dinamicas rapidas o modo estricto para evaluaciones con mayor control.",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="4" width="8" height="6" rx="1.5" />
                <rect x="13" y="14" width="8" height="6" rx="1.5" />
                <path d="M11 7h5a2 2 0 0 1 2 2v1" strokeLinecap="round" />
                <path d="M13 17H8a2 2 0 0 1-2-2v-1" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        title: "Seguimiento en tiempo real",
        description: "Observa quien esta respondiendo, quien termino y como avanza cada participante durante la sesion.",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 19h16" strokeLinecap="round" />
                <rect x="5" y="11" width="3" height="6" rx="1" />
                <rect x="10.5" y="8" width="3" height="9" rx="1" />
                <rect x="16" y="5" width="3" height="12" rx="1" />
            </svg>
        ),
    },
    {
        title: "Control estricto del examen",
        description: "En modo estricto puedes vigilar incidencias y tomar decisiones mientras el examen esta en curso.",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.2-2.7 8.2-7 10-4.3-1.8-7-5.8-7-10V6l7-3z" />
                <path d="M9.5 12l1.8 1.8 3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        title: "Entrada simple por codigo",
        description: "Comparte un codigo y tus participantes entran rapido desde celular o computadora, sin pasos confusos.",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="3" width="8" height="8" rx="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" />
                <path d="M15 13h6v6h-6z" />
            </svg>
        ),
    },
    {
        title: "Resultados claros al finalizar",
        description: "Revisa respuestas, puntajes y desempeno para tomar decisiones o mejorar la siguiente evaluacion.",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 19V9" strokeLinecap="round" />
                <path d="M10 19V5" strokeLinecap="round" />
                <path d="M15 19v-7" strokeLinecap="round" />
                <path d="M20 19v-3" strokeLinecap="round" />
                <path d="M4 19h17" strokeLinecap="round" />
            </svg>
        ),
    },
];

function ModalShell({ title, subtitle, onClose, children }) {
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
            <button
                type="button"
                aria-label="Cerrar modal"
                className="absolute inset-0 bg-black/85"
                onClick={onClose}
            />

            <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-black text-slate-100">

                <div className="relative border-b border-white/10 px-6 pb-5 pt-6 sm:px-8">
                    <div className="pr-10">
                        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
                        {subtitle ? <p className="mt-2 text-sm text-slate-300 sm:text-base">{subtitle}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10">
                        Cerrar
                    </button>
                </div>

                <div className="relative max-h-[68vh] overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
            </div>
        </div>
    );
}

export default function Header({ onLoginClick, onRegisterClick }) {
    const [activeModal, setActiveModal] = useState(null);

    return (
        <>
            <header className="fixed z-30 w-full p-4">
                <div className="container mx-auto flex items-center justify-between">
                    <Link to="/" className="text-xl font-bold">
                        QUIZZIA
                    </Link>
                    <nav className="flex gap-4 text-white/80">
                        <Link to="/join-quiz" className="mx-2 hover:text-white hover:underline">
                            Unirse a un quiz
                        </Link>
                        <button
                            type="button"
                            onClick={() => setActiveModal("features")}
                            className="mx-2 cursor-pointer bg-transparent text-white/80 transition hover:text-white hover:underline"
                        >
                            Funcionalidades
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveModal("about")}
                            className="mx-2 cursor-pointer bg-transparent text-white/80 transition hover:text-white hover:underline"
                        >
                            Sobre nosotros
                        </button>
                    </nav>
                    <nav>
                        <button type="button" onClick={onLoginClick} className="mx-2 cursor-pointer border-none bg-transparent text-sm outline-none hover:underline">
                            Iniciar Sesion
                        </button>
                        <button type="button" onClick={onRegisterClick} className="mx-2 cursor-pointer rounded-full border-none bg-white px-4 py-2 text-sm text-black outline-none hover:underline">
                            Crear cuenta
                        </button>
                    </nav>
                </div>
            </header>

            {activeModal === "features" ? (
                <ModalShell
                    title="Funcionalidades de Quizzia"
                    subtitle="Funciones reales para crear, lanzar y monitorear actividades sin complicaciones tecnicas."
                    onClose={() => setActiveModal(null)}
                >
                    <div className="mb-4 rounded-xl border border-white/15 bg-black p-4 text-sm leading-relaxed text-slate-200">
                        Ideal para clases, equipos y eventos: creas preguntas rapido, eliges el modo de actividad y haces seguimiento en vivo.
                    </div>

                    <div className="flex flex-col gap-3">
                        {featureItems.map((item) => (
                            <article key={item.title} className="rounded-xl border border-white/15 bg-black p-4">
                                <div className="flex items-start gap-3">
                                    <div className="inline-flex shrink-0 rounded-lg border border-cyan-300/40 bg-black p-2 text-cyan-200">{item.icon}</div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white sm:text-base">{item.title}</h3>
                                        <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.description}</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </ModalShell>
            ) : null}

            {activeModal === "about" ? (
                <ModalShell
                    title="Sobre nosotros"
                    subtitle="Nacimos para convertir una idea de hackathon en una herramienta que realmente ayude a evaluar y aprender mejor."
                    onClose={() => setActiveModal(null)}
                >
                    <div className="space-y-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100">
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path d="M8 6h8" strokeLinecap="round" />
                                <path d="M9 3h6" strokeLinecap="round" />
                                <path d="M7 6l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
                            </svg>
                            Cube Path Hackathon
                        </div>

                        <p>
                            Quizzia fue creado para participar en la hackathon de Cube Path, con la idea de resolver un problema real: facilitar la creacion
                            de formularios y quizzes interactivos, y al mismo tiempo ofrecer herramientas de control para escenarios exigentes.
                        </p>
                        <p>
                            La meta del proyecto es combinar una experiencia simple para el usuario final con capacidades avanzadas para organizadores,
                            docentes o equipos que necesitan seguimiento en tiempo real y resultados confiables.
                        </p>
                        <div className="rounded-xl border border-white/20 bg-black p-4 text-cyan-100">
                            Construimos Quizzia para mostrar como el diseno, la experiencia de usuario y la tecnologia pueden trabajar juntos en una
                            plataforma lista para competir en la hackathon.
                        </div>
                    </div>
                </ModalShell>
            ) : null}
        </>
    );
}