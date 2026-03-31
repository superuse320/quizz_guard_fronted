import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useProfile = (userId) => {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, name, role, created_at')
          .eq('id', userId)
          .single()

        if (fetchError) throw fetchError
        setProfile(data)
        setError(null)
      } catch (err) {
        setError(err)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [userId])

  return { profile, loading, error }
}

export default useProfile
