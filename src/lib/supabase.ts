import { createClient } from '@supabase/supabase-js'

// Credenciais padrão da Alfa Eletrônicos (Publishable Anon Key - segura para bundle frontend)
const DEFAULT_SUPABASE_URL = 'https://hygbyvzkwqclyjodsjto.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_GZFj7ZPn_0T_T6YDi-BWUA_eirAmJQJ'

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

const supabaseUrl = envUrl || DEFAULT_SUPABASE_URL
const supabaseAnonKey = envKey || DEFAULT_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
)

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Variáveis de ambiente não configuradas. ' +
    'Exibindo dados visuais de demonstração até conectar o Supabase.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)
