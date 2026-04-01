import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../hooks/useSession'
import { useProfile } from '../hooks/useProfile'
import { EyeIcon } from '../assets/icons/EyeIcon'
import { PencilIcon } from '../assets/icons/PencilIcon'
import { AppearancePaletteIcon } from '../assets/icons/AppearancePaletteIcon'
import { LinkChainIcon } from '../assets/icons/LinkChainIcon'
import { TuneSlidersIcon } from '../assets/icons/TuneSlidersIcon'
import { PhotoIcon } from '../assets/icons/PhotoIcon'

export default function FormBuilderHeader({
  formTheme,
  formMode,
  joinCode,
  isPreviewOpen,
  setIsPreviewOpen,
  setShowResults,
  setPreviewSection,
  formTitle,
  saving,
  checkingSession,
  saveIntent,
  hasPersistedForm,
  formStatus,
  publicFormUrl,
  persistForm,
  saveError,
  onLoadTemplate,
  onImportFile,
  onExportFile,
  showAppearancePanel,
  onToggleAppearancePanel,
  onCloseAppearancePanel,
  selectedThemePreset,
  themePresetOptions,
  onThemePresetChange,
  onOpenCustomTheme,
  onOpenCoverPicker,
  onClearCoverImage,
  onOpenControlPanel,
  onOpenPublishModal,
}) {
  const { session } = useSession()
  const user = session?.user || null
  const { profile } = useProfile(user?.id || null)
  const displayName = profile?.name?.trim() || user?.user_metadata?.full_name || user?.email || ''
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U'
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showUrlPopup, setShowUrlPopup] = useState(false)
  const [urlPopupMsg, setUrlPopupMsg] = useState('')
  const avatarRef = useRef(null)
  const urlPopupRef = useRef(null)
  const appearancePopupRef = useRef(null)
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

  useEffect(() => {
    if (!showUrlPopup) return
    const handleClickOutside = (event) => {
      if (urlPopupRef.current && !urlPopupRef.current.contains(event.target)) {
        setShowUrlPopup(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUrlPopup])

  useEffect(() => {
    if (!showAppearancePanel) return
    const handleClickOutside = (event) => {
      if (appearancePopupRef.current && !appearancePopupRef.current.contains(event.target)) {
        onCloseAppearancePanel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAppearancePanel, onCloseAppearancePanel])

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

  const canCopyPublicUrl = formStatus === 'published' && Boolean(publicFormUrl)
  const canShowUrlButton = true
  const iconBtnBaseClass = 'inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10'

  const handleCopyPublicUrl = async () => {
    if (!canCopyPublicUrl) return
    try {
      await navigator.clipboard.writeText(publicFormUrl)
      setUrlPopupMsg('Link copiado')
    } catch {
      setUrlPopupMsg('No se pudo copiar')
    }
    window.setTimeout(() => setUrlPopupMsg(''), 1500)
  }

  const handleCopyQuizCode = async () => {
    if (!joinCode) return
    try {
      await navigator.clipboard.writeText(joinCode)
      setUrlPopupMsg('Codigo copiado')
    } catch {
      setUrlPopupMsg('No se pudo copiar')
    }
    window.setTimeout(() => setUrlPopupMsg(''), 1500)
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
            className={`${iconBtnBaseClass} ${isPreviewOpen ? 'bg-primary-500/15 text-primary-100' : ''}`}
            title={isPreviewOpen ? 'Editar' : 'Vista previa'}
            aria-label={isPreviewOpen ? 'Editar' : 'Vista previa'}
          >
            {isPreviewOpen ? <PencilIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>

          <div className="relative" ref={appearancePopupRef}>
            <button
              type="button"
              onClick={onToggleAppearancePanel}
              className={`${iconBtnBaseClass} ${showAppearancePanel ? 'bg-cyan-500/20 text-cyan-100 shadow-[0_8px_24px_rgba(6,182,212,0.25)]' : ''}`}
              title="Apariencia"
              aria-label="Apariencia"
            >
              <AppearancePaletteIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            {showAppearancePanel ? (
              <div className="absolute right-0 top-12 z-50 w-[23rem] overflow-hidden rounded-2xl border border-white/15 bg-black p-4 shadow-[0_24px_60px_rgba(2,6,23,0.75)] backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-wide text-slate-100">Apariencia</h3>
                  <button
                    type="button"
                    onClick={onCloseAppearancePanel}
                    className="rounded-md border border-white/20 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10"
                  >
                    Cerrar
                  </button>
                </div>

                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Tema
                  <select
                    value={selectedThemePreset}
                    onChange={(event) => onThemePresetChange(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
                  >
                    {themePresetOptions.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedThemePreset === 'custom' ? (
                  <button
                    type="button"
                    onClick={onOpenCustomTheme}
                    className="mt-3 w-full rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                  >
                    Ajustar colores personalizados
                  </button>
                ) : null}

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Portada</p>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={onOpenCoverPicker}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                    >
                      <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                      Seleccionar portada
                    </button>
                    {formTheme?.coverImage ? (
                      <button
                        type="button"
                        onClick={onClearCoverImage}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                      >
                        Quitar portada
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {canShowUrlButton ? (
            <div className="relative" ref={urlPopupRef}>
              <button
                type="button"
                onClick={() => setShowUrlPopup((current) => !current)}
                className={`${iconBtnBaseClass} ${showUrlPopup ? 'bg-cyan-500/20 text-cyan-100' : ''}`}
                title="URL o código"
                aria-label="URL o código"
              >
                <LinkChainIcon className="h-4 w-4" aria-hidden="true" />
              </button>

              {showUrlPopup ? (
                <div className="absolute right-0 top-12 z-50 w-[30rem] overflow-hidden rounded-2xl border border-white/15 bg-[#0b0f17] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">

                  <div className="border-b border-white/10 px-5 py-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <LinkChainIcon className="h-4 w-4 text-slate-300" aria-hidden="true" />
                      {formMode === 'quiz' ? 'Código de acceso' : 'Enlace de respuesta'}
                    </div>

                    {formMode === 'quiz' ? (
                      <>
                        <input
                          type="text"
                          readOnly
                          value={joinCode || 'Se genera al guardar'}
                          className="w-full rounded-lg border border-white/20 bg-[#05070d] px-3 py-2 text-sm font-bold text-slate-100"
                        />
                        <p className="mt-2 text-xs text-slate-400">Comparte este código con los participantes para entrar al quiz.</p>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          readOnly
                          value={publicFormUrl || 'Publica para obtener el link'}
                          className="w-full rounded-lg border border-white/20 bg-[#05070d] px-3 py-2 text-xs text-slate-100"
                        />
                        <p className="mt-2 text-xs text-slate-400">Este enlace abre el formulario para encuestados.</p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setShowUrlPopup(false)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
                    >
                      Cancelar
                    </button>

                    <div className="flex items-center gap-2">
                      {formMode !== 'quiz' ? (
                        <button
                          type="button"
                          onClick={() => window.open(publicFormUrl, '_blank')}
                          disabled={!publicFormUrl}
                          className="rounded-lg border border-emerald-300/35 bg-emerald-500/12 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Abrir
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={formMode === 'quiz' ? handleCopyQuizCode : handleCopyPublicUrl}
                        disabled={formMode === 'quiz' ? !joinCode : !publicFormUrl}
                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {formMode === 'quiz' ? 'Copiar código' : 'Copiar enlace'}
                      </button>
                    </div>
                  </div>

                  {urlPopupMsg ? (
                    <p className="px-5 pb-3 text-right text-xs font-semibold text-cyan-200">{urlPopupMsg}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
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



          {hasPersistedForm ? (
            <button
              type="button"
              disabled={!formTitle.trim() || saving || checkingSession}
              className="rounded-xl  cursor-pointer  text-primary-400 px-5 py-2 text-sm font-semibold  shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed "
              onClick={() => persistForm(formStatus === 'published' ? 'published' : 'draft', 'save')}
              title="Ctrl + S para guardar"
              aria-label="Guardar (Ctrl + S)"
            >
              {saving && saveIntent === 'save' ? 'Guardando...' : 'Guardar'}
            </button>
          ) : null}

          {!isPreviewOpen && (formMode === 'quiz' || formMode === 'strict') ? (
            <button
              type="button"
              onClick={onOpenControlPanel}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-primary-500"
              title="Panel de control"
              aria-label="Panel de control"
            >
              <TuneSlidersIcon className="h-4 w-4" aria-hidden="true" />
              <span>Panel de control</span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={!formTitle.trim() || saving || checkingSession}
            className={`rounded-xl cursor-pointer px-5 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed ${formStatus === 'published'
              ? 'border border-primary-500 bg-transparent text-primary-400 hover:bg-primary-500/10'
              : 'border border-green-600 bg-green-600 text-white hover:bg-green-700 disabled:border-gray-300 font-bold'
              }`}
            onClick={onOpenPublishModal}
          >
            {saving && saveIntent === 'published' ? 'Publicando...' : formStatus === 'published' ? (
              <span className="inline-flex items-center gap-2">
                Publicado
                <TuneSlidersIcon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : 'Publicar'}
          </button>



          <div className="h-6 w-px bg-gray-300/50" />

          <div className="relative" ref={avatarRef}>
            <div className="flex items-center gap-2">
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
