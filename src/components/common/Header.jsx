import { Link } from "react-router-dom";
export default function Header({ onLoginClick, onRegisterClick }) {
    return (
        <header className="p-4 fixed z-90 w-full">
            <div className="container mx-auto flex justify-between items-center">
                <Link to="/" className="text-xl font-bold">
                    QUIZZIA
                </Link>
                <nav className="flex gap-4 text-white/80 ">
                    <Link to="/join-quiz" className="mx-2 hover:underline hover:text-white">
                        Unirse a un quiz
                    </Link>
                    <Link to="/features" className="mx-2 hover:underline hover:text-white">
                        Funcionalidades
                    </Link>
                    <Link to="/about" className="mx-2 hover:underline hover:text-white">
                        Sobre nosotros
                    </Link>
                </nav>
                <nav>
                    <button type="button" onClick={onLoginClick} className="mx-2 hover:underline text-sm bg-transparent border-none outline-none cursor-pointer">
                        Iniciar Sesión
                    </button>
                    <button type="button" onClick={onRegisterClick} className="mx-2 bg-white text-black rounded-full px-4 py-2 text-sm hover:underline border-none outline-none cursor-pointer">
                        Crear cuenta
                    </button>
                </nav>
            </div>
        </header>
    );
}