import { useState } from 'react'
import { useAuth } from '../../api/hooks/useAuth.js.js'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loading } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (isRegistering) {
      const { error } = await registerWithEmail(email, password)
      if (error) {
        alert("Error al registrar: " + error.message)
      } else {
        alert("¡Registro exitoso! Revisa tu correo para confirmar cuenta.")
      }
    } else {

      const { error } = await loginWithEmail(email, password)
      if (error) alert("Error al entrar: " + error.message)
    }
  }

  return (
    <> 
      <div className="auth-header">
        <h2>QuizGuard</h2>
        <p>
          {isRegistering 
            ? 'Crea tu cuenta para empezar' 
            : 'Bienvenido. Por favor ingresa tus datos.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="input-group">
          <label>Correo electrónico</label>
          <input 
            type="email" 
            placeholder="nombre@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>

        <div className="input-group">
          <label>Contraseña</label>
          <input 
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>

        <button type="submit" className="main-submit-btn" disabled={loading}>
          {loading 
            ? 'Procesando...' 
            : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}
        </button>
      </form>

      <div className="separator">
        <hr /> <span>O continúa con</span> <hr />
      </div>

      <button 
        type="button" 
        className="google-btn-v2" 
        onClick={loginWithGoogle}
        disabled={loading}
      >
        <img src="https://www.google.com/favicon.ico" alt="google" />
        Google
      </button>

      <div className="auth-footer-links">
        {isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} 
        <button 
          type="button"
          className="link-btn" 
          onClick={() => setIsRegistering(!isRegistering)} 
        >
          {isRegistering ? 'Inicia Sesión' : 'Regístrate'}
        </button>
      </div>
    </>
  )
}