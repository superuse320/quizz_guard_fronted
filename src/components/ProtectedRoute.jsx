import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(session)
      } catch (err) {
        console.error('Error getting session', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    check()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="h-10 w-10 border-4 border-transparent border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
