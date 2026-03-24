import { useEffect, useState } from 'react'
import { supabase } from './api/supabase'
import './App.css'
import LoginPage from './pages/authPages/LoginPage'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        if (session && window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      } catch (error) {
        console.error("Error al obtener sesión:", error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Evento de Auth:", _event)
      setSession(session)
      if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
        setLoading(false)
      }
      if (_event === 'SIGNED_OUT') {
        setSession(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])
  if (loading) {
    return (
      <div className="auth-wrapper">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div className="loader"></div> 
          <p>Cargando QuizGuard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {!session ? (
        <LoginPage />
      ) : (
        <main className="app-shell">
          <header className="header" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '20px',
            background: 'white',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>QuizGuard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                {session.user.email}
              </span>
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="main-submit-btn" 
                style={{ 
                  padding: '8px 16px', 
                  marginTop: 0, 
                  backgroundColor: '#dc3545',
                  fontSize: '0.85rem' 
                }}
              >
                Cerrar Sesión
              </button>
            </div>
          </header>
          
          <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
            <section className="auth-container" style={{ maxWidth: '100%' }}>
              <div className="auth-header" style={{ textAlign: 'left' }}>
                <h2>Panel Principal</h2>
                <p>Bienvenido de nuevo. Has iniciado sesión correctamente.</p>
              </div>
              
              <div style={{ marginTop: '24px', padding: '20px', border: '1px dashed #ccc', borderRadius: '12px' }}>
                <p>Aquí aparecerán tus cuestionarios próximamente...</p>
              </div>
            </section>
          </div>
        </main>
      )}
    </>
  )
}

export default App