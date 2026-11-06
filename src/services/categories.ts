import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Category, CategoryFormData } from '@/types'
import { slugify } from '@/lib/utils'
import { SHOWCASE_CATEGORIES } from '@/lib/showcaseData'

const BUCKET_STORE = 'store-assets'

// Constrói URL pública de imagem de categoria
export function getCategoryImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith('/') || imagePath.startsWith('http')) return imagePath
  const { data } = supabase.storage.from(BUCKET_STORE).getPublicUrl(imagePath)
  return data.publicUrl
}

// Lista todas as categorias ativas (uso público)
export async function getActiveCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return SHOWCASE_CATEGORIES

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return SHOWCASE_CATEGORIES
  return data || []
}

// Lista todas as categorias (uso admin)
export async function getAllCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return SHOWCASE_CATEGORIES

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return SHOWCASE_CATEGORIES
  return data || []
}

// Busca categoria por slug
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (!isSupabaseConfigured) {
    return SHOWCASE_CATEGORIES.find((c) => c.slug === slug) || null
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) return SHOWCASE_CATEGORIES.find((c) => c.slug === slug) || null
  return data
}

// Cria categoria
export async function createCategory(formData: CategoryFormData): Promise<Category> {
  const slug = slugify(formData.name)

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: formData.name,
      slug,
      description: formData.description || null,
      image_path: formData.image_path || null,
      parent_id: formData.parent_id || null,
      display_order: formData.display_order || 0,
      is_active: formData.is_active,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Atualiza categoria
export async function updateCategory(
  id: string,
  formData: Partial<CategoryFormData>
): Promise<Category> {
  const updates: Record<string, unknown> = { ...formData }
  if (formData.name) {
    updates.slug = slugify(formData.name)
  }
  // Limpeza de campos opcionais
  if ('description' in updates && !updates.description) updates.description = null
  if ('image_path' in updates && !updates.image_path) updates.image_path = null
  if ('parent_id' in updates && !updates.parent_id) updates.parent_id = null

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Verifica se categoria tem produtos vinculados
export async function getCategoryProductCount(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  if (error) return 0
  return count || 0
}

// Transfere todos os produtos de uma categoria para outra (antes de excluir)
export async function transferCategoryProducts(
  fromCategoryId: string,
  toCategoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ category_id: toCategoryId })
    .eq('category_id', fromCategoryId)

  if (error) throw new Error(error.message)
}

// Exclui categoria (apenas se não tiver produtos)
export async function deleteCategory(id: string): Promise<void> {
  const productCount = await getCategoryProductCount(id)
  if (productCount > 0) {
    throw new Error(
      `Esta categoria possui ${productCount} produto(s) vinculado(s). ` +
      'Reatribua os produtos antes de excluir.'
    )
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// Reordena categorias
export async function reorderCategories(
  orderedIds: string[]
): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    display_order: index,
  }))

  for (const update of updates) {
    await supabase
      .from('categories')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
  }
}

// Upload de imagem de categoria
export async function uploadCategoryImage(
  file: File,
  categoryId: string
): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `categories/${categoryId}/cover.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET_STORE)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(error.message)
  return path
}
