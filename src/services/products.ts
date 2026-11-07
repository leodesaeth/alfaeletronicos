import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Product, ProductImage, ProductFormData, CatalogFilters } from '@/types'
import { slugify } from '@/lib/utils'
import { SHOWCASE_PRODUCTS, SHOWCASE_CATEGORIES } from '@/lib/showcaseData'
import { optimizeImageFile } from '@/lib/imageOptimizer'
import { getAllProductMeta } from '@/services/catalogIntelligence'

const BUCKET = 'product-images'
const MAX_FILE_SIZE = 8 * 1024 * 1024 // 8 MB tolerante para fotos de celular
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// Converte arquivo ou blob para Base64 Data URL (para fallback offline e resiliente)
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

// Constrói URL pública de imagem do produto
export function getProductImageUrl(storagePath: string): string {
  if (!storagePath) return '/showcase/placeholder.png'
  if (storagePath.startsWith('data:image/')) return storagePath
  if (storagePath.startsWith('/showcase/') && !storagePath.includes('?')) {
    return `${storagePath}?v=2`
  }
  if (storagePath.startsWith('/') || storagePath.startsWith('http')) return storagePath
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

function filterShowcaseProducts(filters: Partial<CatalogFilters> = {}): Product[] {
  let list = [...SHOWCASE_PRODUCTS]
  if (filters.category_slug) {
    const cat = SHOWCASE_CATEGORIES.find((c) => c.slug === filters.category_slug)
    if (cat) list = list.filter((p) => p.category_id === cat.id)
  }
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase()
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.short_description || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term)
    )
  }
  switch (filters.sort) {
    case 'name_asc':
      list.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'name_desc':
      list.sort((a, b) => b.name.localeCompare(a.name))
      break
    case 'price_asc':
      list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
      break
    case 'price_desc':
      list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
      break
  }
  return list
}

// Valida arquivo de imagem (tolerante a fotos tiradas diretamente de câmera de celular)
export function validateImageFile(file: File): string | null {
  const isTypeAllowed =
    ALLOWED_TYPES.includes(file.type.toLowerCase()) ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  if (!isTypeAllowed && file.type) {
    return 'Formato inválido. Use JPEG, PNG ou WebP.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Arquivo muito grande. O tamanho máximo é 8 MB.'
  }
  return null
}

// ---------------------------------------------------------------
// QUERIES PÚBLICAS
// ---------------------------------------------------------------

// Lista produtos publicados com filtros
export async function getPublishedProducts(
  filters: Partial<CatalogFilters> = {}
): Promise<Product[]> {
  if (!isSupabaseConfigured) return filterShowcaseProducts(filters)

  let query = supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      product_images(*)
    `)
    .eq('is_published', true)

  if (filters.category_slug) {
    // Join via categoria
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', filters.category_slug)
      .single()
    if (cat) query = query.eq('category_id', cat.id)
  }

  // Ordenação
  switch (filters.sort) {
    case 'name_asc':
      query = query.order('name', { ascending: true })
      break
    case 'name_desc':
      query = query.order('name', { ascending: false })
      break
    case 'price_asc':
      query = query.order('price', { ascending: true, nullsFirst: false })
      break
    case 'price_desc':
      query = query.order('price', { ascending: false, nullsFirst: false })
      break
    default:
      query = query
        .order('is_featured', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })
  }

  const { data, error } = await query
  if (error) return filterShowcaseProducts(filters)

  // Enriquecer com URLs públicas
  let results = (data || []).map(enrichProductImages)

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase()
    const metaMap = await getAllProductMeta()
    results = results.filter((p) => {
      const sku = metaMap[p.id]?.sku || ''
      const catName = p.category?.name || ''
      return (
        p.name.toLowerCase().includes(term) ||
        (p.short_description || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term) ||
        catName.toLowerCase().includes(term) ||
        sku.toLowerCase().includes(term)
      )
    })
  }

  return results
}

// Busca produto publicado por slug
export async function getPublishedProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured) {
    return SHOWCASE_PRODUCTS.find((p) => p.slug === slug) || null
  }

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*),
      product_images(*)
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error) return SHOWCASE_PRODUCTS.find((p) => p.slug === slug) || null
  return enrichProductImages(data)
}

// Busca produtos em destaque
export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  if (!isSupabaseConfigured) return SHOWCASE_PRODUCTS.slice(0, limit)

  const { data, error } = await supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)
    .eq('is_published', true)
    .eq('is_featured', true)
    .order('display_order', { ascending: true })
    .limit(limit)

  if (error) return SHOWCASE_PRODUCTS.slice(0, limit)
  return (data || []).map(enrichProductImages)
}

// Busca produtos relacionados (mesma categoria)
export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4
): Promise<Product[]> {
  if (!isSupabaseConfigured) {
    return SHOWCASE_PRODUCTS.filter((p) => p.id !== productId).slice(0, limit)
  }

  const { data, error } = await supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)
    .eq('is_published', true)
    .eq('category_id', categoryId)
    .neq('id', productId)
    .order('display_order', { ascending: true })
    .limit(limit)

  if (error) {
    return SHOWCASE_PRODUCTS.filter((p) => p.id !== productId).slice(0, limit)
  }
  return (data || []).map(enrichProductImages)
}

// ---------------------------------------------------------------
// QUERIES ADMIN
// ---------------------------------------------------------------

// Lista todos os produtos (admin)
export async function getAllProducts(filters: {
  search?: string
  category_id?: string
  is_published?: boolean | null
} = {}): Promise<Product[]> {
  if (!isSupabaseConfigured) {
    return SHOWCASE_PRODUCTS.filter((p) => {
      if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.category_id && p.category_id !== filters.category_id) return false
      if (filters.is_published !== undefined && filters.is_published !== null && p.is_published !== filters.is_published) return false
      return true
    })
  }

  let query = supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }
  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id)
  }
  if (filters.is_published !== undefined && filters.is_published !== null) {
    query = query.eq('is_published', filters.is_published)
  }

  query = query
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return SHOWCASE_PRODUCTS
  return (data || []).map(enrichProductImages)
}

// Busca produto por ID (admin)
export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured) {
    return SHOWCASE_PRODUCTS.find((p) => p.id === id) || null
  }

  const { data, error } = await supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)
    .eq('id', id)
    .single()

  if (error) return SHOWCASE_PRODUCTS.find((p) => p.id === id) || null
  return enrichProductImages(data)
}

// Cria produto
export async function createProduct(formData: ProductFormData): Promise<Product> {
  const price = formData.price ? parseFloat(formData.price) : null
  const baseSlug = formData.slug ? slugify(formData.slug) : slugify(formData.name || 'produto')

  // Garante slug único evitando erro de chave duplicada
  let slug = baseSlug
  if (isSupabaseConfigured) {
    let counter = 1
    while (true) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      counter++
      slug = `${baseSlug}-${counter}`
    }
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: formData.name,
      slug,
      category_id: formData.category_id || null,
      short_description: formData.short_description || null,
      description: formData.description || null,
      price,
      show_price: formData.show_price,
      availability: formData.availability,
      is_published: formData.is_published,
      is_featured: formData.is_featured,
      display_order: formData.display_order || 0,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Atualiza produto
export async function updateProduct(
  id: string,
  formData: Partial<ProductFormData>
): Promise<Product> {
  const updates: Record<string, unknown> = { ...formData }
  if (formData.price !== undefined) {
    updates.price = formData.price ? parseFloat(formData.price) : null
  }
  if (formData.name && !formData.slug) {
    const baseSlug = slugify(formData.name)
    let slug = baseSlug
    if (isSupabaseConfigured) {
      let counter = 1
      while (true) {
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('slug', slug)
          .neq('id', id)
          .maybeSingle()
        if (!existing) break
        counter++
        slug = `${baseSlug}-${counter}`
      }
    }
    updates.slug = slug
  }
  if ('category_id' in updates && !updates.category_id) {
    updates.category_id = null
  }

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Alterna publicação
export async function toggleProductPublished(
  id: string,
  isPublished: boolean
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ is_published: isPublished })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Exclui produto (e imagens associadas)
export async function deleteProduct(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { data: images } = await supabase
        .from('product_images')
        .select('storage_path')
        .eq('product_id', id)

      if (images && images.length > 0) {
        const paths = images
          .map((img) => img.storage_path)
          .filter((p) => p && !p.startsWith('/') && !p.startsWith('http') && !p.startsWith('data:'))
        if (paths.length > 0) {
          await supabase.storage.from(BUCKET).remove(paths)
        }
      }
    } catch (err) {
      console.warn('Aviso ao remover arquivos de imagem do storage:', err)
    }
  }

  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------
// GERENCIAMENTO DE IMAGENS
// ---------------------------------------------------------------

// Faz upload de imagem (com otimização WebP automática e fallback de resiliência) e registra no banco
export async function uploadProductImage(
  file: File,
  productId: string,
  displayOrder: number,
  isPrimary: boolean
): Promise<ProductImage> {
  const validationError = validateImageFile(file)
  if (validationError) throw new Error(validationError)

  const optimizedFile = await optimizeImageFile(file, 1200, 0.86)
  const ext = optimizedFile.name.split('.').pop()?.toLowerCase() || 'webp'
  const path = `products/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`

  let finalStoragePath = path
  let publicUrl: string | undefined

  // 1. Tentar upload no Supabase Storage
  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, optimizedFile, {
        upsert: true,
        contentType: optimizedFile.type || 'image/webp',
        cacheControl: '3600',
      })

    if (uploadError) {
      throw uploadError
    }
    publicUrl = getProductImageUrl(path)
  } catch (storageErr) {
    console.warn('[Storage] Falha no upload para o bucket. Utilizando fallback resiliente direto:', storageErr)
    // Se o storage falhar (ex: RLS restrito a authenticated ou bucket indisponível),
    // converte a imagem já otimizada (~80-120KB) em Data URL para não quebrar a experiência
    const dataUrl = await fileToDataUrl(optimizedFile)
    finalStoragePath = dataUrl
    publicUrl = dataUrl
  }

  // Se é primária, desmarca as demais
  if (isPrimary && isSupabaseConfigured) {
    try {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId)
    } catch {
      // ignore
    }
  }

  if (!isSupabaseConfigured) {
    return {
      id: `local-img-${Date.now()}`,
      product_id: productId,
      storage_path: finalStoragePath,
      public_url: publicUrl,
      display_order: displayOrder,
      is_primary: isPrimary,
      created_at: new Date().toISOString(),
    }
  }

  const { data, error: dbError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: finalStoragePath,
      display_order: displayOrder,
      is_primary: isPrimary,
    })
    .select()
    .single()

  if (dbError) {
    // Rollback: se foi salvo no bucket e falhou no banco, remove do storage
    if (!finalStoragePath.startsWith('data:')) {
      try {
        await supabase.storage.from(BUCKET).remove([finalStoragePath])
      } catch {
        // ignore
      }
    }
    console.error('[Database] Erro ao salvar imagem no banco:', dbError)
    throw new Error(
      `Permissão pendente no Supabase: execute o script SQL de estabilização para liberar inserções.`
    )
  }

  return { ...data, public_url: publicUrl || getProductImageUrl(data.storage_path) }
}

// Define imagem principal
export async function setPrimaryImage(
  imageId: string,
  productId: string
): Promise<void> {
  if (!isSupabaseConfigured) return

  // Remove flag de primária das demais
  await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)

  // Define a nova primária
  const { error } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId)

  if (error) {
    console.warn('Aviso ao definir imagem principal:', error)
  }
}

// Remove imagem
export async function deleteProductImage(
  imageId: string,
  storagePath: string
): Promise<void> {
  // 1. Remove do storage físico apenas se for arquivo real no bucket
  if (
    storagePath &&
    !storagePath.startsWith('/') &&
    !storagePath.startsWith('http') &&
    !storagePath.startsWith('data:')
  ) {
    try {
      await supabase.storage.from(BUCKET).remove([storagePath])
    } catch (err) {
      console.warn('Aviso não-bloqueante ao remover arquivo do storage:', err)
    }
  }

  // 2. Remove registro da tabela no banco
  if (
    isSupabaseConfigured &&
    imageId &&
    !imageId.startsWith('mock-') &&
    !imageId.startsWith('local-img-')
  ) {
    try {
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId)
      if (error) {
        console.warn('Aviso ao deletar registro de imagem do banco:', error)
      }
    } catch (err) {
      console.warn('Erro ao deletar imagem do banco:', err)
    }
  }
}

// Reordena imagens
export async function reorderProductImages(
  imageUpdates: Array<{ id: string; display_order: number }>
): Promise<void> {
  for (const update of imageUpdates) {
    await supabase
      .from('product_images')
      .update({ display_order: update.display_order })
      .eq('id', update.id)
  }
}

// Clona / duplica um produto existente com suas imagens
export async function duplicateProduct(productId: string): Promise<Product> {
  const original = await getProductById(productId)
  if (!original) throw new Error('Produto original não encontrado.')

  const timestamp = Date.now().toString().slice(-4)
  const baseName = original.name
  const newName = `${baseName} (Cópia)`
  const newSlug = slugify(`${baseName}-copia-${timestamp}`)

  const { data: newProd, error: prodErr } = await supabase
    .from('products')
    .insert({
      name: newName,
      slug: newSlug,
      category_id: original.category_id,
      short_description: original.short_description,
      description: original.description,
      price: original.price,
      show_price: original.show_price,
      availability: original.availability,
      is_published: false, // Inicia como rascunho por segurança
      is_featured: false,
      display_order: (original.display_order || 0) + 1,
    })
    .select(`*, category:categories(*), product_images(*)`)
    .single()

  if (prodErr || !newProd) throw new Error(prodErr?.message || 'Erro ao duplicar produto.')

  // Duplica referências de imagens se existirem
  if (original.product_images && original.product_images.length > 0) {
    const imagesToInsert = original.product_images.map((img) => ({
      product_id: newProd.id,
      storage_path: img.storage_path,
      display_order: img.display_order,
      is_primary: img.is_primary,
    }))

    await supabase.from('product_images').insert(imagesToInsert)
  }

  const enriched = await getProductById(newProd.id)
  return enriched || enrichProductImages(newProd)
}

// Reajuste de preços em lote (percentual ou fixo em R$)
export async function batchUpdatePrices(params: {
  productIds?: string[]
  categoryId?: string
  type: 'percentage' | 'fixed'
  value: number // ex: +10 para +10%, -5 para -5%, +50 para +R$ 50
}): Promise<number> {
  let query = supabase.from('products').select('id, price')
  if (params.productIds && params.productIds.length > 0) {
    query = query.in('id', params.productIds)
  } else if (params.categoryId) {
    query = query.eq('category_id', params.categoryId)
  } else {
    // Se nenhum filtro for passado, atualiza todos os produtos
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 0

  let updatedCount = 0
  for (const item of data) {
    const currentPrice = item.price ?? 0
    let newPrice = currentPrice

    if (params.type === 'percentage') {
      newPrice = currentPrice * (1 + params.value / 100)
    } else {
      newPrice = currentPrice + params.value
    }

    if (newPrice < 0) newPrice = 0
    newPrice = Math.round(newPrice * 100) / 100

    const { error: updErr } = await supabase
      .from('products')
      .update({ price: newPrice, updated_at: new Date().toISOString() })
      .eq('id', item.id)

    if (!updErr) updatedCount++
  }

  return updatedCount
}

// ---------------------------------------------------------------
// HELPERS INTERNOS
// ---------------------------------------------------------------

// Adiciona URLs públicas às imagens de um produto
function enrichProductImages(product: Product): Product {
  if (!product.product_images) return product
  const enriched = product.product_images
    .sort((a, b) => a.display_order - b.display_order)
    .map((img) => ({
      ...img,
      public_url: getProductImageUrl(img.storage_path),
    }))
  return { ...product, product_images: enriched }
}
