import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Las variables de Supabase no cargaron correctamente.')
}

export default supabase
