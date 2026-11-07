import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  X,
  Star,
  StarOff,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  ExternalLink,
  Check,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  getProductById,
  createProduct,
  updateProduct,
  uploadProductImage,
  deleteProductImage,
  setPrimaryImage,
  reorderProductImages,
  validateImageFile,
} from '@/services/products'
import { getAllCategories, createCategory } from '@/services/categories'
import {
  generateSmartProductCopy,
  getAllProductMeta,
  updateProductMeta,
} from '@/services/catalogIntelligence'
import { slugify, formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Category, ProductImage, Availability } from '@/types'
import { Input, Textarea, Select, Toggle } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/StateComponents'
import toast from 'react-hot-toast'

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Disponível' },
  { value: 'unavailable', label: 'Indisponível' },
  { value: 'on_request', label: 'Sob consulta' },
]

interface FormState {
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

interface ImageItem {
  id?: string
  storage_path?: string
  public_url: string
  is_primary: boolean
  display_order: number
  file?: File
  uploading?: boolean
  error?: string
}

const DEFAULT_FORM: FormState = {
  name: '',
  slug: '',
  category_id: '',
  short_description: '',
  description: '',
  price: '',
  show_price: true,
  availability: 'available',
  is_published: false,
  is_featured: false,
  display_order: 0,
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [images, setImages] = useState<ImageItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [productId, setProductId] = useState<string | null>(id || null)

  // Metadados extras (SKU, Estoque, Custo, Promoção e Variações)
  const [sku, setSku] = useState<string>('')
  const [stockQuantity, setStockQuantity] = useState<string>('')
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('2')
  const [variationsText, setVariationsText] = useState<string>('')
  const [costPrice, setCostPrice] = useState<string>('')
  const [compareAtPrice, setCompareAtPrice] = useState<string>('')
  const [desiredMargin, setDesiredMargin] = useState<string>('35')
  const [supplier, setSupplier] = useState<string>('')

  // Modal de Criação Rápida de Categoria no Fluxo do Produto
  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false)
  const [quickCategoryName, setQuickCategoryName] = useState('')
  const [quickCategoryLoading, setQuickCategoryLoading] = useState(false)

  const handleCreateQuickCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickCategoryName.trim()) {
      toast.error('Informe o nome da categoria.')
      return
    }

    setQuickCategoryLoading(true)
    try {
      const newCat = await createCategory({
        name: quickCategoryName.trim(),
        description: `Produtos e novidades em ${quickCategoryName.trim()}`,
        display_order: categories.length + 1,
        is_active: true,
      })
      setCategories((prev) => [...prev, newCat])
      update('category_id', newCat.id)
      toast.success(`Categoria "${newCat.name}" criada e selecionada!`)
      setShowQuickCategoryModal(false)
      setQuickCategoryName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar categoria.')
    } finally {
      setQuickCategoryLoading(false)
    }
  }

  useEffect(() => {
    getAllCategories().then(setCategories)
    const params = new URLSearchParams(window.location.search)
    const preselectedCat = params.get('categoria')
    if (!id && preselectedCat) {
      setForm((prev) => ({ ...prev, category_id: preselectedCat, is_published: true }))
    }

    if (id) {
      Promise.all([getProductById(id), getAllProductMeta()]).then(([data, metaMap]) => {
        if (!data) {
          toast.error('Produto não encontrado.')
          navigate('/admin/produtos')
          return
        }
        setForm({
          name: data.name,
          slug: data.slug,
          category_id: data.category_id || '',
          short_description: data.short_description || '',
          description: data.description || '',
          price: data.price?.toString() || '',
          show_price: data.show_price,
          availability: data.availability,
          is_published: data.is_published,
          is_featured: data.is_featured,
          display_order: data.display_order,
        })
        const meta = metaMap[id]
        if (meta) {
          if (meta.sku) {
            setSku(meta.sku)
          }
          if (meta.stock_quantity !== undefined && meta.stock_quantity !== null) {
            setStockQuantity(String(meta.stock_quantity))
          }
          if (meta.low_stock_threshold !== undefined) {
            setLowStockThreshold(String(meta.low_stock_threshold))
          }
          if (meta.variations && meta.variations.length > 0) {
            setVariationsText(meta.variations.join(', '))
          }
          if (meta.cost_price !== undefined && meta.cost_price !== null) {
            setCostPrice(String(meta.cost_price))
          }
          if (meta.compare_at_price !== undefined && meta.compare_at_price !== null) {
            setCompareAtPrice(String(meta.compare_at_price))
          }
          if (meta.supplier) {
            setSupplier(meta.supplier)
          }
        }
        // Carregar imagens existentes
        const existingImages: ImageItem[] = (data.product_images || [])
          .sort((a, b) => a.display_order - b.display_order)
          .map((img) => ({
            id: img.id,
            storage_path: img.storage_path,
            public_url: img.public_url || '',
            is_primary: img.is_primary,
            display_order: img.display_order,
          }))
        setImages(existingImages)
        setLoading(false)
      })
    }
  }, [id])

  const update = (field: keyof FormState, value: string | boolean | number) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'name' && !isEditing) {
        next.slug = slugify(value as string)
      }
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.'
    if (!form.category_id) errs.category_id = 'Categoria é obrigatória.'
    if (form.price && isNaN(parseFloat(form.price))) errs.price = 'Preço inválido.'
    if (form.price && parseFloat(form.price) < 0) errs.price = 'Preço não pode ser negativo.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const currentPid = productId

    // Adicionar previews
    const newItems: ImageItem[] = fileArray.map((file, i) => ({
      public_url: URL.createObjectURL(file),
      is_primary: images.length === 0 && i === 0,
      display_order: images.length + i,
      file,
      uploading: false,
      error: validateImageFile(file) || undefined,
    }))

    setImages((prev) => [...prev, ...newItems])

    // Se o produto ainda não foi salvo, apenas mantém para upload posterior
    if (!currentPid) return

    // Upload imediato em paralelo se produto já existe
    const uploadTasks = newItems.map(async (item, i) => {
      if (item.error || !item.file) return

      setImages((prev) =>
        prev.map((img) =>
          img.file === item.file ? { ...img, uploading: true } : img
        )
      )

      try {
        const isPrimary = images.length === 0 && i === 0
        const order = images.length + i
        const uploaded = await uploadProductImage(item.file, currentPid, order, isPrimary)

        setImages((prev) =>
          prev.map((img) =>
            img.file === item.file
              ? {
                  id: uploaded.id,
                  storage_path: uploaded.storage_path,
                  public_url: uploaded.public_url || '',
                  is_primary: uploaded.is_primary,
                  display_order: uploaded.display_order,
                  uploading: false,
                }
              : img
          )
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Upload falhou.'
        setImages((prev) =>
          prev.map((img) =>
            img.file === item.file ? { ...img, uploading: false, error: errMsg } : img
          )
        )
      }
    })

    await Promise.allSettled(uploadTasks)
  }

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  const handleRemoveImage = async (item: ImageItem, idx: number) => {
    // 1. Remove do estado imediatamente para resposta instantânea na tela
    if (item.public_url && item.public_url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(item.public_url)
      } catch {
        // ignore
      }
    }

    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      // Se removeu a principal e restam fotos, a primeira vira a principal
      if (item.is_primary && next.length > 0) {
        next[0].is_primary = true
      }
      return next
    })

    toast.success('Imagem removida.')

    // 2. Remove do storage e banco em background (não bloqueia a interface)
    if (item.id && item.storage_path) {
      try {
        await deleteProductImage(item.id, item.storage_path)
      } catch (err) {
        console.warn('Aviso ao remover imagem remota:', err)
      }
    }
  }

  const handleSetPrimary = async (item: ImageItem, idx: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, is_primary: i === idx }))
    )
    toast.success('Foto principal atualizada!')

    if (item.id && productId) {
      try {
        await setPrimaryImage(item.id, productId)
      } catch (err) {
        console.warn('Aviso ao sincronizar foto principal no servidor:', err)
      }
    }
  }

  const handleMoveImage = async (idx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= images.length) return

    const next = [...images]
    const temp = next[idx]
    next[idx] = next[targetIdx]
    next[targetIdx] = temp

    const updated = next.map((img, i) => ({ ...img, display_order: i }))
    setImages(updated)

    const savedPayload = updated
      .filter((img): img is ImageItem & { id: string } => Boolean(img.id))
      .map((img) => ({ id: img.id, display_order: img.display_order }))

    if (savedPayload.length > 1) {
      try {
        await reorderProductImages(savedPayload)
      } catch {
        toast.error('Erro ao reordenar imagens.')
      }
    }
  }

  const handleSave = async (publish?: boolean) => {
    if (!validate()) {
      toast.error('Corrija os erros antes de salvar.')
      return
    }

    setSaving(true)

    try {
      const parsedStock =
        stockQuantity.trim() !== '' ? Math.max(0, parseInt(stockQuantity, 10)) : null
      const autoAvailability: Availability =
        parsedStock === 0 && form.availability === 'available'
          ? 'unavailable'
          : form.availability

      const formData = {
        ...form,
        availability: autoAvailability,
        is_published: publish !== undefined ? publish : form.is_published,
      }

      let savedProduct
      if (isEditing && productId) {
        savedProduct = await updateProduct(productId, formData)
        toast.success('Produto atualizado com sucesso!')
      } else {
        savedProduct = await createProduct(formData)
        setProductId(savedProduct.id)
        toast.success('Produto criado! Agora você pode adicionar imagens.')
      }

      // Salvar metadados de estoque, custo, preço promocional e variações
      if (savedProduct?.id) {
        const variations = variationsText
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
        const parsedCost =
          costPrice.trim() !== ''
            ? parseFloat(costPrice.replace(',', '.'))
            : null
        const parsedCompare =
          compareAtPrice.trim() !== ''
            ? parseFloat(compareAtPrice.replace(',', '.'))
            : null

        await updateProductMeta(savedProduct.id, {
          sku: sku.trim() || undefined,
          stock_quantity: parsedStock,
          low_stock_threshold: parseInt(lowStockThreshold, 10) || 2,
          cost_price: parsedCost && !isNaN(parsedCost) ? parsedCost : null,
          compare_at_price: parsedCompare && !isNaN(parsedCompare) ? parsedCompare : null,
          supplier: supplier.trim() || undefined,
          variations,
        })
      }

      // Upload paralelo e rápido de imagens pendentes (para novos produtos)
      const pendingImages = images.filter((img) => img.file && !img.id && !img.error)
      if (pendingImages.length > 0 && savedProduct.id) {
        const existingCount = images.filter((img) => img.id).length
        const uploadTasks = pendingImages.map(async (item, i) => {
          setImages((prev) =>
            prev.map((img) => img.file === item.file ? { ...img, uploading: true } : img)
          )
          const isPrimary = i === 0 && existingCount === 0
          try {
            const uploaded = await uploadProductImage(item.file!, savedProduct.id, existingCount + i, isPrimary)
            setImages((prev) =>
              prev.map((img) =>
                img.file === item.file
                  ? { id: uploaded.id, storage_path: uploaded.storage_path, public_url: uploaded.public_url || '', is_primary: uploaded.is_primary, display_order: uploaded.display_order, uploading: false }
                  : img
              )
            )
            return uploaded
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Erro no upload.'
            setImages((prev) =>
              prev.map((img) => img.file === item.file ? { ...img, uploading: false, error: errMsg } : img)
            )
            throw err
          }
        })

        await Promise.allSettled(uploadTasks)
      }

      toast.success(
        isEditing
          ? 'Produto atualizado com sucesso!'
          : publish
          ? 'Produto cadastrado e publicado na vitrine!'
          : 'Produto cadastrado com sucesso!'
      )

      navigate('/admin/produtos', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>

  const uploadingCount = images.filter((img) => img.uploading).length
  const errorCount = images.filter((img) => img.error).length

  return (
    <AdminLayout>
      <div className="w-full max-w-[1600px]">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              to="/admin/produtos"
              className="flex items-center gap-1.5 text-sm text-muted hover:text-brand transition-colors"
            >
              <ArrowLeft size={16} />
              Produtos
            </Link>
            <span className="text-muted">/</span>
            <span className="text-sm font-medium text-graphite">
              {isEditing ? 'Editar produto' : 'Novo produto'}
            </span>
          </div>

          {isEditing && form.slug && (
            <a
              href={`/produto/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
            >
              <ExternalLink size={13} />
              Ver na loja
            </a>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {/* SEÇÃO A: Informações principais */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-graphite">A — Informações principais</h2>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Nome do produto"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Ex: iPhone 15 Pro Max 256GB"
                  error={errors.name}
                />
              </div>
              <Input
                label="Código / SKU (Opcional)"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex: ALFA-IP15PM-256"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-graphite">
                  Categoria <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickCategoryModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#111111] bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Plus size={13} /> Nova categoria
                </button>
              </div>
              <Select
                value={form.category_id}
                onChange={(e) => update('category_id', e.target.value)}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Selecione uma categoria..."
                error={errors.category_id}
              />
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted">
                Dica: digite o nome do produto acima e gere a descrição comercial em 1 clique.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!form.name.trim()) {
                    toast.error('Digite o nome do produto primeiro.')
                    return
                  }
                  const catName =
                    categories.find((c) => c.id === form.category_id)?.name || ''
                  const copy = generateSmartProductCopy(form.name, catName)
                  update('short_description', copy.shortDescription)
                  update('description', copy.fullDescription)
                  toast.success('Descrição comercial gerada!')
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#111111] text-white hover:bg-[#242424] px-3 py-1.5 rounded-lg transition-colors"
              >
                <Sparkles size={13} />
                Gerar descrição inteligente
              </button>
            </div>

            <Textarea
              label="Descrição curta"
              value={form.short_description}
              onChange={(e) => update('short_description', e.target.value)}
              placeholder="Resumo do produto (exibido no card do catálogo)"
              rows={2}
              hint="Máximo 200 caracteres recomendados."
            />

            <Textarea
              label="Descrição completa"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Detalhes completos sobre o produto..."
              rows={5}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <Toggle
                label="Produto em destaque"
                description="Exibir na seção de destaques da página inicial"
                checked={form.is_featured}
                onChange={(v) => update('is_featured', v)}
                id="is_featured"
              />
            </div>
          </section>

          {/* SEÇÃO B: Fotografias */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-graphite">B — Fotografias</h2>
              <span className="text-xs text-muted">Máx. 5 MB por imagem · JPEG, PNG, WebP</span>
            </div>

            {/* Avisos de status de upload */}
            {uploadingCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-brand bg-brand/5 border border-brand/20 rounded-lg px-3 py-2">
                <Loader2 size={14} className="animate-spin" />
                Enviando {uploadingCount} imagem(ns)...
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} />
                {errorCount} imagem(ns) com erro. Remova e tente novamente.
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropZone}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-200 hover:border-brand/40 hover:bg-surface'
              )}
            >
              <Upload size={28} className="mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-medium text-graphite">
                Clique ou arraste as imagens aqui
              </p>
              <p className="text-xs text-muted mt-1">
                Suporta JPEG, PNG e WebP · Máximo 5 MB por arquivo
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* Grid de imagens */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'relative group rounded-xl overflow-hidden border-2 aspect-square bg-surface shadow-sm transition-all',
                      img.is_primary ? 'border-brand ring-2 ring-brand/20' : 'border-gray-200',
                      img.error ? 'border-red-400 ring-2 ring-red-400/20' : ''
                    )}
                  >
                    <img
                      src={img.public_url}
                      alt={`Imagem ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Botão Remover (Sempre visível no canto superior direito para fácil toque no celular) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage(img, idx)
                      }}
                      title="Remover imagem"
                      className="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full bg-black/75 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-md active:scale-90"
                    >
                      <X size={13} />
                    </button>

                    {/* Badge / Botão de Imagem Principal no canto superior esquerdo */}
                    {!img.uploading && !img.error && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSetPrimary(img, idx)
                        }}
                        title={img.is_primary ? 'Foto principal' : 'Tocar para definir como principal'}
                        className={cn(
                          'absolute top-1.5 left-1.5 z-20 text-[10px] font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1 transition-all active:scale-95',
                          img.is_primary
                            ? 'bg-[#111111] text-amber-400 border border-amber-400/40'
                            : 'bg-black/65 text-white/90 hover:bg-black/90 hover:text-white'
                        )}
                      >
                        <Star size={11} fill={img.is_primary ? 'currentColor' : 'none'} />
                        <span>{img.is_primary ? 'Principal' : 'Principal?'}</span>
                      </button>
                    )}

                    {/* Reordenação no canto inferior */}
                    {images.length > 1 && !img.uploading && !img.error && (
                      <div className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 bg-black/70 p-0.5 rounded-full backdrop-blur-sm shadow-md">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMoveImage(idx, 'left')
                          }}
                          title="Mover foto para esquerda"
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/20 transition-colors"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === images.length - 1}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMoveImage(idx, 'right')
                          }}
                          title="Mover foto para direita"
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/20 transition-colors"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    )}

                    {/* Loading overlay */}
                    {img.uploading && (
                      <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center p-2">
                        <Loader2 size={22} className="animate-spin text-brand mb-1" />
                        <span className="text-[10px] font-medium text-graphite">Enviando foto...</span>
                      </div>
                    )}

                    {/* Error overlay */}
                    {img.error && (
                      <div className="absolute inset-0 z-10 bg-red-950/85 text-white flex flex-col items-center justify-center p-2.5 text-center">
                        <AlertCircle size={18} className="text-red-400 mb-1" />
                        <p className="text-[10px] font-semibold text-red-200 leading-tight mb-2 line-clamp-3">
                          {img.error}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img, idx)}
                          className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-full font-medium shadow"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SEÇÃO C: Preço, Custo e Calculadora de Lucro */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-graphite">
              C — Preço, Custo & Calculadora de Lucro
            </h2>

            {/* Linha 1: Custo + Calculadora de Margem */}
            <div className="grid sm:grid-cols-3 gap-4 items-end bg-[#FAFAF8] p-4 rounded-xl border border-[#EAEAEA]">
              <Input
                label="Preço de Custo (R$ - Invisível ao cliente)"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="Ex: 200,00"
              />
              <Input
                label="Margem desejada (%)"
                type="number"
                min="1"
                max="90"
                value={desiredMargin}
                onChange={(e) => setDesiredMargin(e.target.value)}
                placeholder="35"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const c = parseFloat(costPrice.replace(',', '.'))
                  const m = parseFloat(desiredMargin.replace(',', '.'))
                  if (isNaN(c) || c <= 0) {
                    toast.error('Digite o Preço de Custo primeiro.')
                    return
                  }
                  const targetMargin = isNaN(m) || m <= 0 || m >= 95 ? 35 : m
                  const suggested = Math.round((c / (1 - targetMargin / 100)) * 100) / 100
                  update('price', String(suggested))
                  toast.success(`Preço sugerido calculado para ${targetMargin}% de margem!`)
                }}
              >
                Calcular Preço Ideal
              </Button>
            </div>

            {/* Linha 2: Preço De (Promoção) e Preço Por (Venda) */}
            <div className="grid sm:grid-cols-2 gap-4 items-start">
              <Input
                label='Preço Antigo "De R$" (Opcional p/ Promoção)'
                type="number"
                min="0"
                step="0.01"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="Ex: 349,00"
                hint="Se maior que o preço atual, exibe o valor riscado e o selo % OFF."
              />
              <Input
                label='Preço de Venda Atual "Por R$"'
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="0,00"
                hint="Valor principal exibido na vitrine."
                error={errors.price}
              />
            </div>

            {/* Simulador em tempo real de Lucro PIX vs Cartão */}
            {(() => {
              const pVal = parseFloat(form.price)
              const cVal = parseFloat(costPrice)
              const compVal = parseFloat(compareAtPrice)
              if (isNaN(pVal) || pVal <= 0) return null

              const hasCost = !isNaN(cVal) && cVal > 0
              const pixProfit = hasCost ? pVal - cVal : 0
              const marginPct = hasCost ? (pixProfit / pVal) * 100 : 0
              const cardFee = pVal * 0.045 // ~4,5% taxa média maquininha
              const cardProfit = hasCost ? pVal - cVal - cardFee : 0
              const discountPct =
                !isNaN(compVal) && compVal > pVal
                  ? Math.round(((compVal - pVal) / compVal) * 100)
                  : 0

              return (
                <div className="grid sm:grid-cols-3 gap-3 bg-[#F7F7F7] rounded-xl p-3.5 text-xs">
                  <div>
                    <span className="text-[#767676] block">Lucro no PIX / Dinheiro:</span>
                    <strong
                      className={cn(
                        'text-sm',
                        pixProfit >= 0 ? 'text-[#166534]' : 'text-red-600'
                      )}
                    >
                      {hasCost
                        ? `R$ ${pixProfit.toFixed(2)} (${marginPct.toFixed(0)}%)`
                        : 'Informe o custo acima'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#767676] block">
                      Lucro no Cartão (~4,5% taxa):
                    </span>
                    <strong
                      className={cn(
                        'text-sm',
                        cardProfit >= 0 ? 'text-[#111111]' : 'text-red-600'
                      )}
                    >
                      {hasCost ? `R$ ${cardProfit.toFixed(2)}` : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#767676] block">Destaque Promocional:</span>
                    <strong className="text-sm text-[#111111]">
                      {discountPct > 0
                        ? `Selo -${discountPct}% OFF ativo!`
                        : 'Sem desconto "De/Por"'}
                    </strong>
                  </div>
                </div>
              )
            })()}

            <Toggle
              label="Exibir preço no catálogo"
              description="Se desativado, o preço ficará oculto para visitantes (Consulte o preço)"
              checked={form.show_price}
              onChange={(v) => update('show_price', v)}
              id="show_price"
            />
          </section>

          {/* SEÇÃO D: Disponibilidade, Estoque e Variações */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-graphite">
              D — Disponibilidade, Estoque e Variações
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <Select
                label="Status de disponibilidade"
                value={form.availability}
                onChange={(e) => update('availability', e.target.value as Availability)}
                options={AVAILABILITY_OPTIONS}
              />
              <Input
                label="Qtd. em Estoque (Opcional)"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="Ex: 10"
                hint="Se chegar a 0, muda para Indisponível."
              />
              <Input
                label="Alerta de estoque mínimo"
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="2"
                hint="Avisa no painel quando atingir."
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Variações disponíveis (Cores, Capacidades ou Tamanhos)"
                value={variationsText}
                onChange={(e) => setVariationsText(e.target.value)}
                placeholder="Ex: Preto, Branco, Titânio Natural, 256GB"
                hint="Separe por vírgula."
              />
              <Input
                label="Fornecedor Principal (Opcional - Interno)"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Importadora Oficial SP"
                hint="Visível apenas no controle de estoque."
              />
            </div>
          </section>

          {/* SEÇÃO E: Publicação */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-graphite">E — Publicação</h2>
            <Toggle
              label="Publicar produto"
              description="Produto visível no catálogo público. Se desativado, fica como rascunho."
              checked={form.is_published}
              onChange={(v) => update('is_published', v)}
              id="is_published"
            />
          </section>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 sticky bottom-0 bg-surface py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 border-t border-gray-100 sm:static sm:border-0 sm:bg-transparent sm:py-0">
            <Link to="/admin/produtos">
              <Button variant="ghost" disabled={saving}>Cancelar</Button>
            </Link>
            <div className="flex gap-3">
              {uploadingCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  Aguarde o upload...
                </span>
              )}
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                loading={saving && !form.is_published}
                disabled={saving || uploadingCount > 0}
              >
                Salvar rascunho
              </Button>
              <Button
                onClick={() => handleSave(true)}
                loading={saving && form.is_published}
                disabled={saving || uploadingCount > 0}
              >
                {isEditing ? 'Atualizar produto' : 'Salvar e Publicar'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Criação Rápida de Categoria no Fluxo do Produto */}
      <Modal
        isOpen={showQuickCategoryModal}
        onClose={() => {
          setShowQuickCategoryModal(false)
          setQuickCategoryName('')
        }}
        title="Criar nova categoria"
        size="sm"
      >
        <form onSubmit={handleCreateQuickCategory} className="flex flex-col gap-4">
          <p className="text-xs text-muted leading-relaxed">
            A categoria será salva imediatamente e selecionada neste produto sem perder seus dados.
          </p>
          <Input
            label="Nome da categoria"
            required
            value={quickCategoryName}
            onChange={(e) => setQuickCategoryName(e.target.value)}
            placeholder="Ex: Fones e Caixas JBL"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowQuickCategoryModal(false)}
              disabled={quickCategoryLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={quickCategoryLoading}>
              Criar e selecionar
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
