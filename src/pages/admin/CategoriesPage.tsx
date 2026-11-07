import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Edit,
  Trash2,
  Tag,
  Package,
  ArrowUp,
  ArrowDown,
  MessageCircle,
  Sparkles,
  Percent,
  Upload,
  Check,
  ExternalLink,
  AlertTriangle,
  Smartphone,
  Headphones,
  Watch,
  Laptop,
  Zap,
  Gift,
  Shield,
  ArrowRightLeft,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  uploadCategoryImage,
  getCategoryImageUrl,
  transferCategoryProducts,
} from '@/services/categories'
import { getAllProducts, updateProduct } from '@/services/products'
import {
  getAllProductMeta,
  updateProductMeta,
  type ProductMetaMap,
} from '@/services/catalogIntelligence'
import type { Category, CategoryFormData, Product } from '@/types'
import { Input, Textarea, Toggle } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, PageLoader } from '@/components/ui/StateComponents'
import { formatBRL, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const DEFAULT_FORM: CategoryFormData = {
  name: '',
  description: '',
  image_path: '',
  parent_id: '',
  display_order: 0,
  is_active: true,
}

const QUICK_CATEGORY_TEMPLATES = [
  {
    name: 'Smartwatches e Relógios',
    description: 'Relógios inteligentes, pulseiras e monitoramento esportivo de alta precisão.',
  },
  {
    name: 'Caixas de Som e JBL',
    description: 'Áudio portátil potente à prova d’água para festas, casa e viagens.',
  },
  {
    name: 'Games e Consoles',
    description: 'Controles sem fio, headsets gamer, consoles e acessórios de alta performance.',
  },
  {
    name: 'Tablets e iPads',
    description: 'Telas de alta resolução para estudo, trabalho e entretenimento em qualquer lugar.',
  },
  {
    name: 'Kits Presente e Importados',
    description: 'Opções exclusivas e sofisticadas prontas para presentear quem você ama.',
  },
]

function generateSmartCategoryDescription(categoryName: string): string {
  const lower = categoryName.toLowerCase()
  if (/celular|smartphone|iphone|samsung|xiaomi/.test(lower)) {
    return 'Smartphones originais de última geração com câmeras avançadas, garantia e pronta entrega.'
  }
  if (/capa|capinha|película|acessório|magsafe|proteção/.test(lower)) {
    return 'Capinhas anti-impacto, películas 3D de vidro temperado e acessórios para máxima proteção e estilo.'
  }
  if (/carregador|cabo|fonte|energia|power bank|bateria/.test(lower)) {
    return 'Carregadores turbo homologados, cabos reforçados e baterias portáteis de carregamento rápido.'
  }
  if (/fone|áudio|som|jbl|earbuds|headphone|bluetooth/.test(lower)) {
    return 'Fones sem fio Bluetooth, caixas de som potentes e áudio cristalino com isolamento acústico.'
  }
  if (/informática|pc|notebook|mouse|teclado|gamer/.test(lower)) {
    return 'Periféricos ergonômicos, mouses sem fio, teclados e acessórios para produtividade e setup.'
  }
  if (/perfume|fragrância|importado|colônia|aromas|edp/.test(lower)) {
    return 'Perfumes importados 100% originais com alta fixação, projeção marcante e frascos lacrados.'
  }
  if (/chocolate|doce|suíço|bombom|presente|cacau/.test(lower)) {
    return 'Seleção especial de chocolates importados, trufas e caixas luxuosas perfeitas para presentear.'
  }
  if (/watch|relógio|smartwatch|pulseira/.test(lower)) {
    return 'Smartwatches modernos com monitoramento de saúde, notificações no pulso e alta autonomia.'
  }
  return `Seleção exclusiva de ${categoryName.trim()} com procedência garantida e pronta entrega na Alfa Eletrônicos.`
}

function getCategoryThemeIcon(name: string) {
  const lower = name.toLowerCase()
  if (/celular|smartphone|iphone/.test(lower)) return Smartphone
  if (/fone|áudio|som/.test(lower)) return Headphones
  if (/watch|relógio|outros/.test(lower)) return Watch
  if (/informática|mouse|pc/.test(lower)) return Laptop
  if (/carregador|cabo|turbo/.test(lower)) return Zap
  if (/capinha|película|proteção/.test(lower)) return Shield
  if (/perfume|chocolate|presente/.test(lower)) return Gift
  return Package
}

export function CategoriesPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [metaMap, setMetaMap] = useState<ProductMetaMap>({})
  const [loading, setLoading] = useState(true)

  // Modal de Criar / Editar Categoria
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(DEFAULT_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Modal de Exclusão + Transferência de Produtos
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteLinkedCount, setDeleteLinkedCount] = useState(0)
  const [transferTargetCatId, setTransferTargetCatId] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Modal de Promoção / Reajuste de Preço por Categoria
  const [promoCategory, setPromoCategory] = useState<Category | null>(null)
  const [promoPct, setPromoPct] = useState('-10')
  const [promoLoading, setPromoLoading] = useState(false)

  // Feedback de cópia de lista para WhatsApp
  const [copiedCatId, setCopiedCatId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, prods, meta] = await Promise.all([
        getAllCategories(),
        getAllProducts(),
        getAllProductMeta(),
      ])
      setCategories(cats)
      setProducts(prods)
      setMetaMap(meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Estatísticas consolidadas por categoria
  const categoryStats = useMemo(() => {
    const map = new Map<
      string,
      {
        products: Product[]
        totalUnits: number
        totalSaleValue: number
        totalClicks: number
        sampleImages: string[]
      }
    >()

    for (const c of categories) {
      map.set(c.id, {
        products: [],
        totalUnits: 0,
        totalSaleValue: 0,
        totalClicks: 0,
        sampleImages: [],
      })
    }

    for (const p of products) {
      if (!p.category_id) continue
      const entry = map.get(p.category_id)
      if (!entry) continue

      entry.products.push(p)
      const meta = metaMap[p.id] || {}
      const stock = meta.stock_quantity ?? 10
      const price = p.price || 0
      entry.totalUnits += stock
      entry.totalSaleValue += stock * price
      entry.totalClicks += meta.whatsapp_clicks || 0

      const primaryImg =
        p.product_images?.find((i) => i.is_primary)?.public_url ||
        p.product_images?.[0]?.public_url
      if (primaryImg && entry.sampleImages.length < 4) {
        entry.sampleImages.push(primaryImg)
      }
    }

    return map
  }, [categories, products, metaMap])

  const openCreate = (preset?: { name: string; description: string }) => {
    setEditTarget(null)
    setFormData({
      ...DEFAULT_FORM,
      name: preset?.name || '',
      description: preset?.description || '',
      display_order: categories.length + 1,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditTarget(cat)
    setFormData({
      name: cat.name,
      description: cat.description || '',
      image_path: cat.image_path || '',
      parent_id: cat.parent_id || '',
      display_order: cat.display_order,
      is_active: cat.is_active,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const openDelete = (cat: Category) => {
    const count = categoryStats.get(cat.id)?.products.length || 0
    setDeleteLinkedCount(count)
    const fallbackOther = categories.find((c) => c.id !== cat.id)?.id || ''
    setTransferTargetCatId(fallbackOther)
    setDeleteTarget(cat)
  }

  // Gerar descrição inteligente com 1 clique no modal
  const handleGenerateSmartCopy = () => {
    if (!formData.name.trim()) {
      toast.error('Digite primeiro o nome da categoria para gerar a descrição.')
      return
    }
    const generated = generateSmartCategoryDescription(formData.name)
    setFormData((prev) => ({ ...prev, description: generated }))
    toast.success('Descrição comercial gerada!')
  }

  // Upload de capa da categoria
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const targetId = editTarget?.id || `temp-${Date.now()}`
      const storagePath = await uploadCategoryImage(file, targetId)
      const publicUrl = getCategoryImageUrl(storagePath) || storagePath
      setFormData((prev) => ({ ...prev, image_path: publicUrl }))
      toast.success('Imagem de capa enviada com sucesso!')
    } catch {
      toast.error('Erro ao enviar imagem de capa.')
    } finally {
      setUploadingCover(false)
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = 'Nome é obrigatório.'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setFormLoading(true)
    try {
      if (editTarget) {
        const updated = await updateCategory(editTarget.id, formData)
        setCategories((prev) =>
          prev.map((c) => (c.id === editTarget.id ? updated : c))
        )
        toast.success('Categoria atualizada!')
      } else {
        const created = await createCategory(formData)
        setCategories((prev) => [...prev, created])
        toast.success('Categoria criada com sucesso!')
      }
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setFormLoading(false)
    }
  }

  // Alternar status Ativa / Inativa direto na lista
  const handleQuickToggleActive = async (cat: Category) => {
    try {
      const updated = await updateCategory(cat.id, { is_active: !cat.is_active })
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)))
      toast.success(
        updated.is_active
          ? `Categoria "${cat.name}" ativada na vitrine!`
          : `Categoria "${cat.name}" ocultada da vitrine.`
      )
    } catch {
      toast.error('Erro ao alterar status da categoria.')
    }
  }

  // Reordenar categoria para cima ou para baixo
  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) return

    const reordered = [...categories]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    setCategories(reordered)
    try {
      await reorderCategories(reordered.map((c) => c.id))
      toast.success('Ordem das categorias atualizada na vitrine!')
    } catch {
      toast.error('Não foi possível salvar a nova ordem.')
    }
  }

  // Copiar tabela de preços da categoria inteira para o WhatsApp
  const handleCopyCategoryWhatsAppList = (cat: Category) => {
    const stat = categoryStats.get(cat.id)
    const catProducts = (stat?.products || []).filter((p) => p.is_published)

    if (catProducts.length === 0) {
      toast.error('Esta categoria ainda não possui produtos publicados para copiar.')
      return
    }

    const lines = catProducts.map((p) => {
      const priceText =
        p.show_price && p.price && p.price > 0 ? formatBRL(p.price) : 'Sob consulta'
      const statusEmoji = p.availability === 'available' ? '✅' : '⏳'
      return `${statusEmoji} *${p.name}* — ${priceText}`
    })

    const catUrl = `${window.location.origin}/catalogo?categoria=${cat.slug}`
    const fullMessage =
      `✨ *Tabela Atualizada — ${cat.name} (Alfa Eletrônicos)* ✨\n\n` +
      lines.join('\n') +
      `\n\n📲 *Veja as fotos de todos os itens aqui:*\n👉 ${catUrl}`

    navigator.clipboard.writeText(fullMessage)
    setCopiedCatId(cat.id)
    toast.success(`Lista de "${cat.name}" copiada! É só colar no WhatsApp do cliente.`)
    setTimeout(() => setCopiedCatId(null), 2500)
  }

  // Aplicar promoção ou reajuste percentual em todos os produtos de uma categoria
  const handleApplyCategoryPromo = async () => {
    if (!promoCategory) return
    const pct = parseFloat(promoPct.replace(',', '.'))
    if (isNaN(pct) || pct === 0) {
      toast.error('Informe um percentual válido (ex: -10 ou 5).')
      return
    }

    const catProducts = categoryStats.get(promoCategory.id)?.products || []
    if (catProducts.length === 0) {
      toast.error('Nenhum produto nesta categoria para reajustar.')
      return
    }

    setPromoLoading(true)
    try {
      const updatedList: Product[] = []
      const factor = 1 + pct / 100

      for (const prod of catProducts) {
        if (!prod.price || prod.price <= 0) continue
        const oldPrice = prod.price
        const newPrice = Math.max(1, Math.round(oldPrice * factor))

        const updatedProd = await updateProduct(prod.id, { price: newPrice })
        updatedList.push(updatedProd)

        // Se for desconto (pct < 0), salva o preço antigo em compare_at_price ("De R$")
        if (pct < 0) {
          await updateProductMeta(prod.id, { compare_at_price: oldPrice })
        }
      }

      setProducts((prev) =>
        prev.map((p) => updatedList.find((u) => u.id === p.id) || p)
      )
      const meta = await getAllProductMeta()
      setMetaMap(meta)

      toast.success(
        `Preços de "${promoCategory.name}" reajustados em ${pct > 0 ? `+${pct}%` : `${pct}%`}!`
      )
      setPromoCategory(null)
    } catch {
      toast.error('Erro ao reajustar preços da categoria.')
    } finally {
      setPromoLoading(false)
    }
  }

  // Excluir categoria (transferindo produtos automaticamente se necessário)
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      if (deleteLinkedCount > 0) {
        if (!transferTargetCatId) {
          toast.error('Selecione uma categoria de destino para transferir os produtos.')
          setDeleteLoading(false)
          return
        }
        await transferCategoryProducts(deleteTarget.id, transferTargetCatId)
        setProducts((prev) =>
          prev.map((p) =>
            p.category_id === deleteTarget.id
              ? { ...p, category_id: transferTargetCatId }
              : p
          )
        )
      }

      await deleteCategory(deleteTarget.id)
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.success(
        deleteLinkedCount > 0
          ? `Produtos transferidos e categoria "${deleteTarget.name}" excluída!`
          : 'Categoria excluída com sucesso.'
      )
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <PageLoader />
      </AdminLayout>
    )
  }

  const activeCount = categories.filter((c) => c.is_active).length
  const emptyCategoriesCount = categories.filter(
    (c) => (categoryStats.get(c.id)?.products.length || 0) === 0
  ).length

  // Sugestões que ainda não existem no banco
  const availableQuickTemplates = QUICK_CATEGORY_TEMPLATES.filter(
    (tpl) =>
      !categories.some((c) =>
        c.name.toLowerCase().includes(tpl.name.split(' ')[0].toLowerCase())
      )
  )

  return (
    <AdminLayout>
      <div className="w-full max-w-[1600px] space-y-6">
        {/* ── 1. CABEÇALHO & RESUMO DE CATEGORIAS ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
              Central de Categorias ({categories.length})
            </h1>
            <p className="text-sm text-[#767676] mt-0.5">
              Ordene as seções da loja, copie listas de preços para o WhatsApp e aplique promoções por categoria.
            </p>
          </div>
          <Button icon={<Plus size={16} />} onClick={() => openCreate()}>
            Nova categoria
          </Button>
        </div>

        {/* ── 2. CARTÕES DE DIAGNÓSTICO DAS CATEGORIAS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">
              Categorias Ativas na Vitrine
            </p>
            <p className="text-2xl font-extrabold text-[#111111] mt-1 tabular-nums">
              {activeCount}{' '}
              <span className="text-xs font-normal text-[#767676]">de {categories.length}</span>
            </p>
            <p className="text-xs text-[#166534] font-semibold mt-1">
              Visíveis no menu público da loja
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">
              Total de Produtos Distribuídos
            </p>
            <p className="text-2xl font-extrabold text-[#111111] mt-1 tabular-nums">
              {products.length} itens
            </p>
            <p className="text-xs text-[#767676] mt-1">
              Média de {(products.length / Math.max(1, categories.length)).toFixed(1)} produto(s) por seção
            </p>
          </div>

          <div
            className={cn(
              'rounded-2xl border p-4 shadow-card',
              emptyCategoriesCount > 0
                ? 'bg-[#FFFBEB] border-[#FDE68A]'
                : 'bg-white border-[#EAEAEA]'
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">
              Preenchimento de Vitrine
            </p>
            <p className="text-2xl font-extrabold text-[#111111] mt-1 tabular-nums">
              {emptyCategoriesCount === 0
                ? '100% Completas'
                : `${emptyCategoriesCount} Vazia(s)`}
            </p>
            <p className="text-xs font-semibold mt-1 text-[#767676]">
              {emptyCategoriesCount === 0
                ? 'Todas as categorias possuem produtos'
                : 'Adicione produtos nas categorias vazias'}
            </p>
          </div>
        </div>

        {/* ── 3. SUGESTÕES DE CRIAÇÃO EM 1 CLIQUE ── */}
        {availableQuickTemplates.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 shadow-card">
            <div className="flex items-center gap-2 text-xs font-bold text-[#111111] mb-2.5">
              <Sparkles size={14} className="text-[#767676]" />
              Sugestões de Categorias Prontas (Clique para criar em segundos):
            </div>
            <div className="flex flex-wrap gap-2">
              {availableQuickTemplates.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => openCreate(tpl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAFAF8] hover:bg-[#111111] text-[#242424] hover:text-white border border-[#EAEAEA] text-xs font-semibold transition-all"
                >
                  <Plus size={12} /> {tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. LISTA RICA DE CATEGORIAS ── */}
        {categories.length === 0 ? (
          <EmptyState
            icon={<Tag size={48} />}
            title="Nenhuma categoria cadastrada"
            description="Crie categorias para organizar seus produtos."
            action={
              <Button icon={<Plus size={16} />} onClick={() => openCreate()}>
                Criar categoria
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {categories.map((cat, idx) => {
              const stat = categoryStats.get(cat.id) || {
                products: [],
                totalUnits: 0,
                totalSaleValue: 0,
                totalClicks: 0,
                sampleImages: [],
              }
              const coverUrl =
                getCategoryImageUrl(cat.image_path) || stat.sampleImages[0] || null
              const ThemeIcon = getCategoryThemeIcon(cat.name)
              const isEmpty = stat.products.length === 0

              return (
                <div
                  key={cat.id}
                  className={cn(
                    'bg-white rounded-2xl border p-4 shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4',
                    !cat.is_active
                      ? 'border-gray-200 opacity-70 bg-gray-50/60'
                      : isEmpty
                        ? 'border-amber-200'
                        : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {/* Bloco Esquerdo: Ordem + Capa/Ícone + Nome + Métricas */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Botões de Ordem (Subir / Descer) */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, 'up')}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-25"
                        title="Mover categoria para cima"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <span className="text-[10px] font-extrabold text-gray-400 tabular-nums">
                        {idx + 1}º
                      </span>
                      <button
                        type="button"
                        disabled={idx === categories.length - 1}
                        onClick={() => handleMoveCategory(idx, 'down')}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-25"
                        title="Mover categoria para baixo"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>

                    {/* Miniatura de Capa ou Foto do 1º Produto */}
                    <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={cat.name}
                          className="w-full h-full object-contain p-1 bg-white"
                        />
                      ) : (
                        <ThemeIcon size={22} className="text-gray-400" />
                      )}
                    </div>

                    {/* Informações e Indicadores da Categoria */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          {cat.name}
                        </h3>

                        <button
                          type="button"
                          onClick={() => handleQuickToggleActive(cat)}
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-colors',
                            cat.is_active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          )}
                          title="Clique para ativar ou ocultar esta categoria na loja"
                        >
                          {cat.is_active ? 'Ativa na Vitrine' : 'Oculta'}
                        </button>

                        {isEmpty && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle size={10} /> Sem produtos
                          </span>
                        )}
                      </div>

                      {cat.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {cat.description}
                        </p>
                      )}

                      {/* Chips de Métricas da Categoria */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <span className="font-semibold text-[#111111]">
                          {stat.products.length} produto(s)
                        </span>
                        <span className="text-[#767676]">
                          · {stat.totalUnits} un. em estoque
                        </span>
                        <span className="font-semibold text-[#242424] tabular-nums">
                          · {formatBRL(stat.totalSaleValue)} em vitrine
                        </span>
                        {stat.totalClicks > 0 && (
                          <span className="inline-flex items-center gap-1 text-[#166534] font-semibold">
                            · <MessageCircle size={11} /> {stat.totalClicks} cliques Whats
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bloco Direito: Miniaturas dos Produtos + Ações Comerciais */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100 shrink-0">
                    {/* Miniaturas dos produtos vinculados */}
                    {stat.products.length > 0 && (
                      <div className="flex items-center -space-x-2 mr-2">
                        {stat.products.slice(0, 4).map((p) => {
                          const img =
                            p.product_images?.find((i) => i.is_primary)?.public_url ||
                            p.product_images?.[0]?.public_url
                          return (
                            <Link
                              key={p.id}
                              to={`/admin/produtos/${p.id}/editar`}
                              title={`Editar ${p.name}`}
                              className="w-8 h-8 rounded-full bg-white border-2 border-white ring-1 ring-gray-200 overflow-hidden flex items-center justify-center hover:z-10 hover:scale-110 transition-transform"
                            >
                              {img ? (
                                <img
                                  src={img}
                                  alt={p.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Package size={12} className="text-gray-400" />
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    )}

                    {/* Botão 1: Copiar Tabela da Categoria para WhatsApp */}
                    <button
                      type="button"
                      onClick={() => handleCopyCategoryWhatsAppList(cat)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0FDF4] hover:bg-[#24A850] text-[#166534] hover:text-white text-xs font-bold transition-colors"
                      title="Copiar tabela de produtos e preços desta categoria para enviar no WhatsApp"
                    >
                      {copiedCatId === cat.id ? (
                        <>
                          <Check size={13} /> Lista Copiada!
                        </>
                      ) : (
                        <>
                          <MessageCircle size={13} /> Lista Whats
                        </>
                      )}
                    </button>

                    {/* Botão 2: Reajuste / Promoção na Categoria */}
                    {stat.products.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPromoCategory(cat)
                          setPromoPct('-10')
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F4F4F4] hover:bg-[#111111] text-[#242424] hover:text-white text-xs font-bold transition-colors"
                        title="Aplicar desconto ou reajuste de preço nos produtos desta categoria"
                      >
                        <Percent size={13} /> Promo %
                      </button>
                    )}

                    {/* Botão 3: Adicionar Produto direto nesta Categoria */}
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/produtos/novo?categoria=${cat.id}`)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F4F4F4] hover:bg-[#111111] text-[#242424] hover:text-white text-xs font-bold transition-colors"
                      title={`Cadastrar novo produto dentro de ${cat.name}`}
                    >
                      <Plus size={13} /> Produto
                    </button>

                    {/* Ver na vitrine pública */}
                    <a
                      href={`/catalogo?categoria=${cat.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                      title="Abrir esta categoria no catálogo público"
                    >
                      <ExternalLink size={15} />
                    </a>

                    {/* Editar */}
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                      title="Editar categoria"
                    >
                      <Edit size={15} />
                    </button>

                    {/* Excluir */}
                    <button
                      type="button"
                      onClick={() => openDelete(cat)}
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="Excluir categoria"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL 1: CRIAR / EDITAR CATEGORIA TURBINADO (IA + CAPA)
           ══════════════════════════════════════════════════════════════════ */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editTarget ? `Editar categoria: ${editTarget.name}` : 'Nova categoria da vitrine'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={formLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={formLoading}>
                {editTarget ? 'Salvar alterações' : 'Criar categoria'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input
              label="Nome da categoria"
              required
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Smartwatches e Relógios"
              error={formErrors.name}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">
                  Descrição comercial da categoria
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSmartCopy}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#111111] hover:underline"
                >
                  <Sparkles size={12} /> Gerar descrição automática
                </button>
              </div>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ex: Smartphones de última geração com garantia e procedência..."
                rows={3}
              />
            </div>

            {/* Imagem de Capa Opcional da Categoria */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    Imagem / Foto de Capa da Categoria (Opcional)
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Se deixar em branco, o sistema usa automaticamente a foto do principal produto da categoria.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-900 text-xs font-bold text-gray-800 shrink-0"
                >
                  <Upload size={13} />
                  {uploadingCover ? 'Enviando...' : 'Enviar Foto'}
                </button>
              </div>

              {formData.image_path && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={getCategoryImageUrl(formData.image_path) || formData.image_path}
                    alt="Capa"
                    className="w-12 h-12 rounded-xl object-contain bg-white border border-gray-200 p-1"
                  />
                  <input
                    type="text"
                    value={formData.image_path}
                    onChange={(e) => setFormData((p) => ({ ...p, image_path: e.target.value }))}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
                    placeholder="URL da imagem"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, image_path: '' }))}
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>

            <Toggle
              label="Categoria ativa na vitrine"
              description="Categorias inativas ficam ocultas para os clientes no catálogo público"
              checked={formData.is_active}
              onChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
              id="cat_is_active"
            />
          </div>
        </Modal>

        {/* ══════════════════════════════════════════════════════════════════
            MODAL 2: PROMOÇÃO / REAJUSTE EM MASSA DA CATEGORIA
           ══════════════════════════════════════════════════════════════════ */}
        {promoCategory && (
          <Modal
            isOpen={!!promoCategory}
            onClose={() => setPromoCategory(null)}
            title={`Promoção / Reajuste: ${promoCategory.name}`}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setPromoCategory(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleApplyCategoryPromo} loading={promoLoading}>
                  Aplicar em {categoryStats.get(promoCategory.id)?.products.length || 0} produto(s)
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-600">
                Use valores negativos para <strong>desconto promocional</strong> (ex: <code>-10</code> para 10% OFF) ou positivos para <strong>reajuste de tabela</strong> (ex: <code>+5</code> para +5%).
              </p>

              <div className="flex flex-wrap gap-2">
                {['-15', '-10', '-5', '+5', '+10'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPromoPct(preset)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                      promoPct === preset
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>

              <Input
                label="Percentual de ajuste (%)"
                type="number"
                step="1"
                value={promoPct}
                onChange={(e) => setPromoPct(e.target.value)}
              />
            </div>
          </Modal>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL 3: EXCLUSÃO INTELIGENTE COM TRANSFERÊNCIA DE PRODUTOS
           ══════════════════════════════════════════════════════════════════ */}
        {deleteTarget && (
          <Modal
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title={`Excluir categoria "${deleteTarget.name}"`}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleteLoading}
                  disabled={deleteLinkedCount > 0 && !transferTargetCatId}
                >
                  {deleteLinkedCount > 0
                    ? 'Transferir Produtos e Excluir'
                    : 'Excluir Categoria'}
                </Button>
              </>
            }
          >
            {deleteLinkedCount > 0 ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                  <ArrowRightLeft size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">
                      Esta categoria possui {deleteLinkedCount} produto(s) vinculado(s).
                    </p>
                    <p className="mt-0.5">
                      Escolha abaixo para qual categoria deseja transferir esses produtos automaticamente antes de excluir:
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Transferir os {deleteLinkedCount} produto(s) para:
                  </label>
                  <select
                    value={transferTargetCatId}
                    onChange={(e) => setTransferTargetCatId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {categories
                      .filter((c) => c.id !== deleteTarget.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Tem certeza que deseja excluir a categoria <strong>"{deleteTarget.name}"</strong>? Esta ação não pode ser desfeita.
              </p>
            )}
          </Modal>
        )}
      </div>
    </AdminLayout>
  )
}
