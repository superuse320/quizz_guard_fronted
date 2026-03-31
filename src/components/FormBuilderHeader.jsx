import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../hooks/useSession'
import { useProfile } from '../hooks/useProfile'
import { EyeIcon } from '../assets/icons/EyeIcon'
import { PencilIcon } from '../assets/icons/PencilIcon'

export default function FormBuilderHeader({
  formTheme,
  isPreviewOpen,
  setIsPreviewOpen,
  setShowResults,
  setPreviewSection,
  formTitle,
  saving,
  checkingSession,
  saveIntent,
  formStatus,
  publicFormUrl,
  persistForm,
  saveError,
  onLoadTemplate,
  onImportFile,
  onExportFile,
}) {
  const { session } = useSession()
  const user = session?.user || null
  const { profile } = useProfile(user?.id || null)
  const displayName = profile?.name?.trim() || user?.user_metadata?.full_name || user?.email || ''
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U'
  const [showUserMenu, setShowUserMenu] = useState(false)
  const avatarRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!showUserMenu) return
    const handleClickOutside = (event) => {
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  const handleImportClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (file) {
        onImportFile(file)
      }
    }
    input.click()
  }

  const canOpenPublicUrl = formStatus === 'published' && Boolean(publicFormUrl)

  const handleOpenPublicUrl = () => {
    if (!canOpenPublicUrl) return
    window.open(publicFormUrl, '_blank')
  }

  return (
    <header className="relative    top-0 z-40  backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-2xl font-bold text-white hover:text-white/90 transition">QUIZZIA</Link>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${formStatus === 'published'
              ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100'
              : 'border-amber-300/35 bg-amber-500/15 text-amber-100'
              }`}
          >
            {formStatus === 'published' ? 'Publicado' : 'Borrador'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setIsPreviewOpen((current) => !current)
              setShowResults(false)
              setPreviewSection(1)
            }}
            className="rounded-xl px-4 cursor-pointer text-sm font-medium text-white transition hover:-translate-y-0.5 "
          >
            {
              isPreviewOpen ?
            <PencilIcon className={"size-4 inline-block mr-2"} />:
                <EyeIcon className={"size-4 inline-block mr-2"} />


            }
            {isPreviewOpen ? 'Volver a edicion' : 'Vista previa'}
          </button>

          <div className="h-6 w-px bg-gray-300/50" />

          {/* <button
            type="button"
            onClick={onLoadTemplate}
            className="rounded-xl border border-violet-700/40 bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-500"
            title="Carga el formulario template con todos los tipos de preguntas"
          >
            Template
          </button> */}
          {/* 
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-xl border border-blue-700/40 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
            title="Importa un formulario desde JSON"
          >
            Importar
          </button>

          <button
            type="button"
            onClick={onExportFile}
            className="rounded-xl border border-emerald-700/40 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-500"
            title="Exporta el formulario actual como JSON"
          >
            Exportar
          </button> */}



          <button
            type="button"
            disabled={!formTitle.trim() || saving || checkingSession}
            className="rounded-xl border cursor-pointer border-primary-400 text-primary-400 px-5 py-2 text-sm font-semibold  shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed "
            onClick={() => persistForm('draft')}

          >
            {saving && saveIntent === 'draft' ? 'Guardando...' : 'Guardar como borrador'}
          </button>

          <button
            type="button"
            disabled={!formTitle.trim() || saving || checkingSession}
            className="rounded-xl  border-emerald-200 cursor-pointer bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed  disabled:border-gray-300"
            onClick={() => persistForm('published')}
          >
            {saving && saveIntent === 'published' ? 'Publicando...' : 'Publicar'}
          </button>

          {canOpenPublicUrl ? (
            <button
              type="button"
              onClick={handleOpenPublicUrl}
              className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/12 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
              title="Abrir formulario publicado"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 007.07 0l2.12-2.12a5 5 0 10-7.07-7.07L10.7 5.22" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 00-7.07 0L4.8 13.12a5 5 0 107.07 7.07l1.41-1.41" />
              </svg>
            </button>
          ) : null}

          <div className="h-6 w-px bg-gray-300/50" />

          <div className="relative" ref={avatarRef}>
            <div className="flex items-center gap-2">
              <span className="max-w-40 truncate text-sm font-medium text-white/85">{displayName || 'Usuario'}</span>
              <button
                type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                className="h-10 w-10 rounded-full bg-indigo-600 text-white grid place-items-center text-sm font-bold shadow-sm transition hover:ring-2 hover:ring-indigo-300/70"
                aria-label="Menú de usuario"
              >
                {avatarInitial}
              </button>
            </div>

            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-72 bg-linear-to-b from-black to-black border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-5 py-4 border-b border-white/10 bg-white/5">
                  <p className="text-white font-semibold truncate">{displayName || 'Usuario'}</p>
                  <p className="text-gray-400 text-xs truncate mt-1">{user?.email}</p>
                </div>
                <button
                  onClick={async () => {
                    setShowUserMenu(false)
                    const { error: signOutError } = await supabase.auth.signOut()
                    if (signOutError) return
                    navigate('/home', { replace: true })
                  }}
                  className="w-full text-left px-5 py-3 text-sm text-red-400 hover:bg-red-500/10 transition"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {saveError && <div className="text-red-500 text-sm mt-2">{saveError}</div>}
        </div>
      </div>
    </header>
  )
}
