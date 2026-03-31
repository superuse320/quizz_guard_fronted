
import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { SearchIcon } from '../../assets/icons/Search';
import { setHomeSearchQuery } from '../../redux/slices/homeUiSlice';

// Colores sutiles para avatares
const avatarColors = [
  'bg-slate-500',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-blue-600',
  'bg-rose-500',
  'bg-indigo-600',
  'bg-cyan-600',
  'bg-teal-600',
];

// Generar color basado en el nombre
const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const hash = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return avatarColors[hash % avatarColors.length];
};

export default function DashboardHeader({ email, name, showSearch = true }) {
    const displayName = name || email || '';
    const initial = displayName.charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(displayName);
    const isLoading = !name && !email;
    const [showMenu, setShowMenu] = useState(false);
    const avatarRef = useRef(null);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const searchQuery = useSelector((state) => state.homeUi?.searchQuery || '');

    // Cerrar el menú al hacer click fuera
    useEffect(() => {
        if (!showMenu) return;
        const handleClick = (e) => {
            if (avatarRef.current && !avatarRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showMenu]);

    return (
        <header className="py-3 border-white/10 shadow-sm">
            <div className=" mx-auto px-6 py-3 flex items-center justify-between gap-4">
                {/* Logo y título */}
                <div className="flex items-center gap-3 min-w-45">
                                        <Link to="/" className="font-semibold text-white text-lg tracking-tight hover:text-white/90 transition">
                                            QUIZZIA
                                        </Link>
                </div>

                {/* Barra de búsqueda */}
                {showSearch ? (
                    <div className="flex-1 flex justify-center">
                        <div className="flex items-center w-full max-w-xl bg-white/15 rounded-full px-4 py-3">
                            <SearchIcon className="text-gray-400 size-5 mr-2" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="bg-transparent outline-none border-none text-white placeholder-gray-400 flex-1 text-sm w-full"
                                style={{ minWidth: 0 }}
                                value={searchQuery}
                                onChange={(event) => dispatch(setHomeSearchQuery(event.target.value))}
                            />
                        </div>
                    </div>
                ) : <div className="flex-1" />}

                {/* Menú apps y avatar */}
                <div className="flex items-center gap-4 min-w-30 justify-end">
                    {/* Menú apps tipo Google */}
                    <button className="p-2 rounded-full hover:bg-white/10 transition">
                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="5" cy="5" r="2" />
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="19" cy="5" r="2" />
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                            <circle cx="5" cy="19" r="2" />
                            <circle cx="12" cy="19" r="2" />
                            <circle cx="19" cy="19" r="2" />
                        </svg>
                    </button>
                    {/* Avatar circular con popup */}
                    <div className="relative" ref={avatarRef}>
                        <div className="flex items-center gap-2">
                            <span className="max-w-40 truncate text-sm font-medium text-white/85">{displayName || 'Usuario'}</span>
                            <button
                                className={`h-10 w-10 flex items-center justify-center rounded-full text-white font-bold text-lg shadow-md select-none focus:outline-none focus:ring-2 focus:ring-emerald-400 transition ${
                                  isLoading 
                                    ? 'bg-linear-to-r from-gray-400 to-gray-500 animate-pulse' 
                                    : `${avatarColor} hover:ring-2 hover:ring-emerald-400`
                                }`}
                                onClick={() => setShowMenu((v) => !v)}
                                aria-label="Opciones de perfil"
                                tabIndex={0}
                            >
                                {!isLoading && initial}
                            </button>
                        </div>
                        {showMenu && (
                            <div className="absolute right-0 mt-3 w-72 bg-linear-to-b from-black to-black border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                              {/* Header del popup */}
                              <div className="bg-linear-to-r from-emerald-500/10 via-transparent to-cyan-500/10 px-6 py-6 border-b border-white/5">
                                <div className="flex items-center gap-4">
                                  <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${avatarColor} shadow-lg`}>
                                    {initial}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold text-base truncate">{displayName}</p>
                                    <p className="text-gray-400 text-xs truncate mt-1">{email}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Divider */}
                              <div className="h-px bg-linear-to-r from-white/0 via-white/5 to-white/0" />

                              {/* Button */}
                              <button
                                  onClick={async () => {
                                      setShowMenu(false);
                                      const { error } = await supabase.auth.signOut();
                                      if (error) {
                                          alert(error.message || 'No se pudo cerrar sesion');
                                          return;
                                      }
                                      navigate('/home', { replace: true });
                                  }}
                                  className="w-full text-left px-6 py-3 text-sm text-red-400 hover:bg-red-500/10 transition font-medium"
                              >
                                  <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                    </svg>
                                    Cerrar sesión
                                  </div>
                              </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
