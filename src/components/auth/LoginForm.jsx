import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'

export default function LoginForm({ open, onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const { loginWithEmail, registerWithEmail, loginWithGoogle, loading } = useAuth()

  useEffect(() => {
    const handler = () => setIsRegistering(true)
    window.addEventListener('open-register', handler)
    return () => window.removeEventListener('open-register', handler)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isRegistering) {
      const { error } = await registerWithEmail(email, password, name)
      if (error) {
        alert("Error al registrar: " + error.message)
      } else {
        setShowSuccessModal(true)
        setEmail('')
        setPassword('')
        setName('')
      }
    } else {
      const { error } = await loginWithEmail(email, password)
      if (error) alert("Error al entrar: " + error.message)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose} role="presentation">
      <div className="bg-black relative rounded-xl max-w-md w-full p-6 border border-white/20 shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Formulario de inicio de sesion">
        <div className='pointer-events-none select-none absolute top-0 left-0 w-full h-full z-0'>
          <div className='absolute left-1/2 -translate-x-1/2 -top-30 bg-white size-52 rounded-full shadow-2xl shadow-white blur-[190px] opacity-60'></div>
        </div>
        <div className='relative z-10'>
          <div className="flex justify-end items-center">
            <button onClick={onClose} className="text-gray-300 cursor-pointer">✕</button>
          </div>
          <div className="mt-4 text-white">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-extrabold text-white">{isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
              <p className="text-gray-400 mt-1 text-sm">
                {isRegistering
                  ? 'Crea tu cuenta para empezar'
                  : 'Bienvenido. Por favor ingresa tus datos.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white/90">Nombre completo</label>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isRegistering}
                    className="w-full border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/90">Correo electrónico</label>
                <input
                  type="email"
                  placeholder="email@dominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full  border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/90">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-2 cursor-pointer top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-400 focus:outline-none"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 2.25 12c2.036 3.807 6.07 6.75 9.75 6.75 1.772 0 3.543-.457 5.02-1.223M21.75 12c-.511-.956-1.24-2.07-2.12-3.077m-2.12-2.12C15.543 6.457 13.772 6 12 6c-1.772 0-3.543.457-5.02 1.223M9.75 9.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Zm0 0L3 21m18-18-6.75 6.75" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12S5.25 6.75 12 6.75 21.75 12 21.75 12 18.75 17.25 12 17.25 2.25 12 2.25 12Zm9.75-2.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="w-full bg-primary-600 text-white font-semibold rounded-lg px-4 py-2 mt-5 cursor-pointer disabled:opacity-50" disabled={loading}>
                {loading
                  ? 'Procesando...'
                  : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6 text-sm text-gray-400">
              <hr className="flex-1 border-t border-gray-700" />
              <span className=" tracking-wider text-xs">O</span>
              <hr className="flex-1 border-t border-gray-700" />
            </div>

            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3  border border-white/20 cursor-pointer rounded-lg text-white hover:bg-white/10"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              <img src="https://static.vecteezy.com/system/resources/previews/046/861/647/non_2x/google-logo-transparent-background-free-png.png" alt="google" className="w-4 h-4" />
              Continua con Google
            </button>

            <div className="text-center text-gray-400 mt-4 text-sm">
              {isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
              <button
                type="button"
                className="ml-2 text-primary-500 cursor-pointer font-semibold"
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering ? 'Inicia Sesión' : 'Regístrate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black relative rounded-xl max-w-md w-full p-6 border border-white/20 shadow-lg overflow-hidden">
            <div className='pointer-events-none select-none absolute top-0 left-0 w-full h-full z-0'>
              <div className='absolute left-1/2 -translate-x-1/2 -top-30 bg-white size-52 rounded-full shadow-2xl shadow-white blur-[190px] opacity-60'></div>
            </div>
            <div className='relative z-10'>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-green-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-white mb-2">¡Registro Exitoso!</h2>
                <p className="text-gray-400 text-sm mb-6">
                  Tu cuenta ha sido creada correctamente. Estás listo para comenzar.
                </p>
                <button
                  onClick={() => {
                    setShowSuccessModal(false)
                    setIsRegistering(false)
                    onClose()
                  }}
                  className="w-full bg-primary-600 text-white font-semibold rounded-lg px-4 py-2 cursor-pointer hover:bg-primary-700"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}