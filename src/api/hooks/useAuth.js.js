import { useState } from 'react'
import { supabase } from '../supabase'

export const useAuth = () => {
  const [loading, setLoading] = useState(false)

  const loginWithEmail = async (email, password) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const registerWithEmail = async (email, password) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const loginWithGoogle = async () => {
    setLoading(true) // Ponemos carga también para Google
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        }
      })
      if (error) throw error
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return { loginWithEmail, registerWithEmail, loginWithGoogle, loading }
}