import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { StoreSettings } from '@/types'
import { getStoreSettings } from '@/services/storeSettings'
import { SHOWCASE_SETTINGS } from '@/lib/showcaseData'

interface StoreContextValue {
  settings: StoreSettings | null
  loading: boolean
  refetch: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue>({
  settings: SHOWCASE_SETTINGS,
  loading: false,
  refetch: async () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(SHOWCASE_SETTINGS)
  const [loading, setLoading] = useState(false)

  const fetchSettings = async () => {
    try {
      const data = await getStoreSettings()
      if (data) setSettings(data)
    } catch {
      // Mantém SHOWCASE_SETTINGS enquanto o Supabase não estiver conectado
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return (
    <StoreContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
