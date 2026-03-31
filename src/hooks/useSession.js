import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session && window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (error) {
        console.error('Error al obtener sesión:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
        setLoading(false);
      }
      if (_event === 'SIGNED_OUT') {
        setSession(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}