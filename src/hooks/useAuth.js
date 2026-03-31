import { useState } from 'react'
import { supabase } from '../lib/supabase'

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

  const registerWithEmail = async (email, password, name = '') => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      
      // Actualizar nombre en tabla profiles (el trigger ya crea el registro)
      if (data.user && name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ name: name })
          .eq('id', data.user.id)
        if (profileError) throw profileError
      }
      
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const loginWithGoogle = async () => {
    setLoading(true)
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
      
      // Esperar a que se complete el login de OAuth y actualizar perfil
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const googleName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
          // Actualizar el perfil con el nombre de Google (el trigger ya creó el registro)
          await supabase
            .from('profiles')
            .update({ name: googleName })
            .eq('id', user.id)
        }
      }, 1000)
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  return { loginWithEmail, registerWithEmail, loginWithGoogle, logout, loading }
}

export default useAuth
