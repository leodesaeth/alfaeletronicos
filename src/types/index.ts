// =============================================================
// Tipos centrais do Catálogo Digital Alfa
// =============================================================

export type Availability = 'available' | 'unavailable' | 'on_request'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image_path: string | null
  parent_id: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  storage_path: string
  display_order: number
  is_primary: boolean
  created_at: string
  // URL pública construída pelo frontend
  public_url?: string
}

export interface Product {
  id: string
  name: string
  slug: string
  short_description: string | null
  description: string | null
  category_id: string | null
  price: number | null
  show_price: boolean
  availability: Availability
  is_published: boolean
  is_featured: boolean
  display_order: number
  created_at: string
  updated_at: string
  // Relacionamentos carregados via join
  category?: Category | null
  product_images?: ProductImage[]
}

export interface StoreSettings {
  id: string
  store_name: string
  store_description: string | null
  logo_path: string | null
  whatsapp_number: string | null
  primary_color: string
  hero_title: string | null
  hero_description: string | null
  contact_email: string | null
  contact_address: string | null
  footer_text: string | null
  updated_at: string
}

// Formulários e DTOs
export interface CategoryFormData {
  name: string
  description: string
  image_path: string
  parent_id: string
  display_order: number
  is_active: boolean
}

export interface ProductFormData {
  name: string
  slug: string
  category_id: string
  short_description: string
  description: string
  price: string
  show_price: boolean
  availability: Availability
  is_published: boolean
  is_featured: boolean
  display_order: number
}

export interface StoreSettingsFormData {
  store_name: string
  store_description: string
  whatsapp_number: string
  primary_color: string
  hero_title: string
  hero_description: string
  contact_email: string
  contact_address: string
  footer_text: string
}

// Estado de carregamento genérico
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Filtros de catálogo público
export interface CatalogFilters {
  search: string
  category_slug: string | null
  sort: 'default' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'
}

// Labels de disponibilidade
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Disponível',
  unavailable: 'Indisponível',
  on_request: 'Sob consulta',
}

export const AVAILABILITY_COLORS: Record<Availability, string> = {
  available: 'text-green-600 bg-green-50',
  unavailable: 'text-red-600 bg-red-50',
  on_request: 'text-amber-600 bg-amber-50',
}
