import Header from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import LoginForm from '../components/auth/LoginForm';
import { useState, useEffect } from 'react';
import { ArrowRightIcon } from '../assets/icons/ArrowRight';
import GenerateAiIcon from '../assets/icons/GenerateAiIcon';
import fondoImage from '../assets/fondo.png';
export default function LandingPage() {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    useEffect(() => {
        if (!isLoginModalOpen) return;
        const handleEscape = (event) => {
            if (event.key === 'Escape') setIsLoginModalOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isLoginModalOpen]);

    return (
        <main className="relative isolate min-h-screen overflow-hidden flex flex-col bg-black text-white">
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute left-[15vw] -bottom-60 max-w-[60vw] animate-title-quarter">
                    <img
                        src={fondoImage}
                        alt=""
                        aria-hidden="true"
                        className="shadow-lg shadow-primary-500/20"
                        style={{ transform: 'perspective(1900px) rotateX(40deg) rotateY(-22deg) rotateZ(-10deg)', transformOrigin: 'left center' }}
                    />
                </div>
            </div>

            <div className="relative z-10">
                <Header
                    onLoginClick={() => { setIsLoginModalOpen(true); }}
                    onRegisterClick={() => { setIsLoginModalOpen(true); setTimeout(() => { const evt = new CustomEvent('open-register'); window.dispatchEvent(evt); }, 0); }}
                />

                <div className='flex-1 flex min-h-screen flex-col items-center justify-center'>
                    <p className="text-sm mb-16 animate-subtitle">
                        <GenerateAiIcon className={"size-4 inline-block mr-1"} />
                        Crea quizzes, formularios y exámenes en segundos
                    </p>
                    <h1 className="text-5xl mb-5 font-light flex ">
                        {"El futuro de los quizzes".split("").map((char, i) => (
                            <span
                                key={i}
                                className="inline-block animate-letter"
                                style={{ animationDelay: `${i * 0.05}s` }}
                            >
                                {char === " " ? "\u00A0" : char}
                            </span>
                        ))}
                    </h1>
                    <h2 className="text-9xl font-semibold animate-title">
                        QUIZZIA
                    </h2>
                    <p className=' font-extralight text-white/80 text-center w-2xl leading-7 tracking-wide mt-16 mb-8'>
                        Crea quizzes, formularios y exámenes de forma rápida y sencilla. Genera preguntas con IA, evalúa automáticamente y comparte en segundos, todo en un solo lugar.
                    </p>
                    <button className='bg-white cursor-pointer rounded-full flex py-1 px-1 items-center text-black font-semibold hover:bg-gray-200' onClick={() => setIsLoginModalOpen(true)}>
                        <div className='bg-linear-to-r flex items-center justify-center from-primary-400 to-primary-700 rounded-full size-10'>
                            <ArrowRightIcon className={"text-white size-5"} />
                        </div>
                        <span className='px-4'>
                            Empezar ahora
                        </span>
                    </button>

                </div>
                <Footer />
                <div className='relative translate-x-[65vw] translate-y-[20vh] animate-spin [animation-duration:10s]  [animation-direction:reverse]'>

                    <div
                        className="w-[280vh] h-[20vh] bg-primary-500 absolute bottom-0 
             rounded-t-full shadow-xl dark:shadow-primary-500/80 shadow-primary-700/80 blur-[350px]"
                    ></div>
                    <div
                        className="w-[270vh] h-[20vh] bg-primary-500 absolute bottom-0 
             rounded-t-full rotate-45 shadow-xl dark:shadow-primary-500/80 shadow-primary-700/80 blur-[270px]"
                    ></div>
                </div>

                <LoginForm open={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
            </div>
        </main>
    );
}
