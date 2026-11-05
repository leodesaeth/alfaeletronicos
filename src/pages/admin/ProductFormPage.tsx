import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Upload, X, Star, StarOff, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { getAllCategories } from '@/services/categories'
import { slugify, formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Category, ProductImage, Availability } from '@/types'
import { Input, Textarea, Select, Toggle } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
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

  useEffect(() => {
    getAllCategories().then(setCategories)

    if (id) {
      getProductById(id).then((data) => {
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

    // Upload imediato se produto já existe
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i]
      if (item.error) continue

      setImages((prev) =>
        prev.map((img) =>
          img.file === item.file ? { ...img, uploading: true } : img
        )
      )

      try {
        const isPrimary = item.is_primary
        const order = images.length + i
        const uploaded = await uploadProductImage(item.file!, currentPid, order, isPrimary)

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
    }
  }

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  const handleRemoveImage = async (item: ImageItem, idx: number) => {
    if (item.id && item.storage_path) {
      try {
        await deleteProductImage(item.id, item.storage_path)
      } catch {
        toast.error('Erro ao remover imagem.')
        return
      }
    }
    URL.revokeObjectURL(item.public_url)
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      // Garantir que haja uma imagem primária
      if (item.is_primary && next.length > 0) {
        next[0].is_primary = true
      }
      return next
    })
  }

  const handleSetPrimary = async (item: ImageItem, idx: number) => {
    if (item.id && productId) {
      try {
        await setPrimaryImage(item.id, productId)
      } catch {
        toast.error('Erro ao definir imagem principal.')
        return
      }
    }
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, is_primary: i === idx }))
    )
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
      const formData = {
        ...form,
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

      // Upload de imagens pendentes (para novos produtos)
      const pendingImages = images.filter((img) => img.file && !img.id && !img.error)
      if (pendingImages.length > 0 && savedProduct.id) {
        for (let i = 0; i < pendingImages.length; i++) {
          const item = pendingImages[i]
          try {
            setImages((prev) =>
              prev.map((img) => img.file === item.file ? { ...img, uploading: true } : img)
            )
            const isPrimary = i === 0 && images.filter((img) => img.id).length === 0
            const uploaded = await uploadProductImage(item.file!, savedProduct.id, i, isPrimary)
            setImages((prev) =>
              prev.map((img) =>
                img.file === item.file
                  ? { id: uploaded.id, storage_path: uploaded.storage_path, public_url: uploaded.public_url || '', is_primary: uploaded.is_primary, display_order: uploaded.display_order, uploading: false }
                  : img
              )
            )
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Erro no upload.'
            setImages((prev) =>
              prev.map((img) => img.file === item.file ? { ...img, uploading: false, error: errMsg } : img)
            )
            toast.error(`Falha no upload de "${item.file?.name}": ${errMsg}`)
          }
        }
      }

      // Se for novo produto e imagens carregaram, redirecionar para edição
      if (!isEditing) {
        navigate(`/admin/produtos/${savedProduct.id}/editar`, { replace: true })
      }
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
      <div className="max-w-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
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

        <div className="flex flex-col gap-5">
          {/* SEÇÃO A: Informações principais */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-graphite">A — Informações principais</h2>

            <Input
              label="Nome do produto"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Ex: iPhone 15 Pro Max 256GB"
              error={errors.name}
            />

            <Select
              label="Categoria"
              required
              value={form.category_id}
              onChange={(e) => update('category_id', e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecione uma categoria..."
              error={errors.category_id}
            />

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
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'relative group rounded-xl overflow-hidden border-2 aspect-square bg-surface',
                      img.is_primary ? 'border-brand' : 'border-transparent',
                      img.error ? 'border-red-300' : ''
                    )}
                  >
                    <img
                      src={img.public_url}
                      alt={`Imagem ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Loading overlay */}
                    {img.uploading && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <Loader2 size={20} className="animate-spin text-brand" />
                      </div>
                    )}

                    {/* Error overlay */}
                    {img.error && (
                      <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-1">
                        <AlertCircle size={16} className="text-red-400 mb-1" />
                        <p className="text-xs text-red-500 text-center leading-tight">{img.error}</p>
                      </div>
                    )}

                    {/* Ações */}
                    {!img.uploading && !img.error && (
                      <div className="absolute inset-0 bg-[#111111]/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {/* Primária */}
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(img, idx)}
                            title={img.is_primary ? 'Imagem principal' : 'Definir como principal'}
                            className={cn(
                              'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                              img.is_primary
                                ? 'bg-[#111111] text-white'
                                : 'bg-white/95 text-[#767676] hover:text-[#111111]'
                            )}
                          >
                            {img.is_primary ? <Star size={12} fill="currentColor" /> : <StarOff size={12} />}
                          </button>

                          {/* Remover */}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(img, idx)}
                            title="Remover imagem"
                            className="w-7 h-7 rounded-full bg-white/95 flex items-center justify-center text-[#767676] hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {images.length > 1 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveImage(idx, 'left')}
                              title="Mover para esquerda"
                              className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-[#242424] disabled:opacity-40 hover:bg-white transition-colors"
                            >
                              <ChevronLeft size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === images.length - 1}
                              onClick={() => handleMoveImage(idx, 'right')}
                              title="Mover para direita"
                              className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-[#242424] disabled:opacity-40 hover:bg-white transition-colors"
                            >
                              <ChevronRight size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Badge primária */}
                    {img.is_primary && !img.uploading && !img.error && (
                      <div className="absolute bottom-1 left-1 bg-[#111111] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full shadow-sm">
                        Principal
                      </div>
                    )}

                    {/* Botão remover no canto (para erro) */}
                    {img.error && (
                      <button
                        onClick={() => handleRemoveImage(img, idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SEÇÃO C: Preço */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-graphite">C — Preço</h2>

            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <Input
                label="Preço (R$)"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="0,00"
                hint="Deixe em branco para não exibir preço."
                error={errors.price}
              />
              <Toggle
                label="Exibir preço no catálogo"
                description="Se desativado, o preço ficará oculto para visitantes"
                checked={form.show_price}
                onChange={(v) => update('show_price', v)}
                id="show_price"
              />
            </div>
          </section>

          {/* SEÇÃO D: Disponibilidade */}
          <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-graphite">D — Disponibilidade</h2>
            <Select
              label="Status de disponibilidade"
              value={form.availability}
              onChange={(e) => update('availability', e.target.value as Availability)}
              options={AVAILABILITY_OPTIONS}
            />
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
                {isEditing ? 'Atualizar' : 'Publicar'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
