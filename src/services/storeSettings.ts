import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { StoreSettings, StoreSettingsFormData } from '@/types'
import { SHOWCASE_SETTINGS } from '@/lib/showcaseData'
import {
  getExtendedStoreConfig,
  saveExtendedStoreConfig,
} from '@/services/catalogIntelligence'

// Busca configurações da loja
export async function getStoreSettings(): Promise<StoreSettings | null> {
  const ext = await getExtendedStoreConfig()
  if (!isSupabaseConfigured) {
    return { ...SHOWCASE_SETTINGS, ...ext }
  }

  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .limit(1)
    .single()

  if (error || !data) return { ...SHOWCASE_SETTINGS, ...ext }
  return { ...data, ...ext }
}

// Atualiza configurações da loja
export async function updateStoreSettings(
  id: string,
  formData: Partial<StoreSettingsFormData>
): Promise<StoreSettings> {
  const updates: Record<string, unknown> = {}

  if (formData.store_name !== undefined) updates.store_name = formData.store_name
  if (formData.store_description !== undefined)
    updates.store_description = formData.store_description || null
  if (formData.whatsapp_number !== undefined)
    updates.whatsapp_number = formData.whatsapp_number || null
  if (formData.primary_color !== undefined) updates.primary_color = formData.primary_color
  if (formData.hero_title !== undefined) updates.hero_title = formData.hero_title || null
  if (formData.hero_description !== undefined)
    updates.hero_description = formData.hero_description || null
  if (formData.contact_email !== undefined)
    updates.contact_email = formData.contact_email || null
  if (formData.contact_address !== undefined)
    updates.contact_address = formData.contact_address || null
  if (formData.footer_text !== undefined)
    updates.footer_text = formData.footer_text || null

  // Salva configurações estendidas (template WhatsApp e banner do Hero) no bucket store-assets
  await saveExtendedStoreConfig({
    whatsapp_message_template: formData.whatsapp_message_template || '',
    hero_image_url: formData.hero_image_url || '',
  })

  if (id === 'showcase-settings') {
    const { data: existing } = await supabase
      .from('store_settings')
      .select('id')
      .limit(1)
      .single()

    if (existing?.id) {
      const { data, error } = await supabase
        .from('store_settings')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return {
        ...data,
        whatsapp_message_template: formData.whatsapp_message_template || null,
        hero_image_url: formData.hero_image_url || null,
      }
    } else {
      const { data, error } = await supabase
        .from('store_settings')
        .insert(updates)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return {
        ...data,
        whatsapp_message_template: formData.whatsapp_message_template || null,
        hero_image_url: formData.hero_image_url || null,
      }
    }
  }

  const { data, error } = await supabase
    .from('store_settings')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return {
    ...data,
    whatsapp_message_template: formData.whatsapp_message_template || null,
    hero_image_url: formData.hero_image_url || null,
  }
}

// Upload de logo da loja
export async function uploadStoreLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `logo/store-logo.${ext}`

  const { error } = await supabase.storage
    .from('store-assets')
    .upload(path, file, { upsert: true })

  if (error) throw new Error(`Upload do logo falhou: ${error.message}`)
  return path
}

// Constrói URL pública do logo
export function getLogoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null
  const { data } = supabase.storage.from('store-assets').getPublicUrl(logoPath)
  return data.publicUrl
}
