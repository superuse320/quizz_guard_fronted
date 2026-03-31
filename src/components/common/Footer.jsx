export const Footer = () => {
    return (
        <footer className="border-t border-white/5 mt-12 py-8">
            <div className="container mx-auto px-6 text-gray-400 text-sm flex flex-col md:flex-row items-center justify-between">
                <p className="mb-4 md:mb-0">&copy; {new Date().getFullYear()} QuizzIA. Todos los derechos reservados.</p>
                <div className="flex gap-4">
                    <a href="#" className="hover:underline">Privacidad</a>
                    <a href="#" className="hover:underline">Términos</a>
                    <a href="#" className="hover:underline">Contacto</a>
                </div>
            </div>
        </footer>
    );
}