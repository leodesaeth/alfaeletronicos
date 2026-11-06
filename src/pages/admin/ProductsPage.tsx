import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Package,
  Upload,
  Download,
  Star,
  CheckSquare,
  Square,
  MessageCircle,
  Percent,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  getAllProducts,
  toggleProductPublished,
  deleteProduct,
  duplicateProduct,
  updateProduct,
  createProduct,
  batchUpdatePrices,
} from '@/services/products'
import { getAllCategories } from '@/services/categories'
import {
  getAllProductMeta,
  type ProductMetaMap,
} from '@/services/catalogIntelligence'
import type { Product, Category, Availability } from '@/types'
import { AVAILABILITY_LABELS } from '@/types'
import { formatBRL, slugify } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ConfirmDeleteModal } from '@/components/ui/Modal'
import { Badge, EmptyState, PageLoader } from '@/components/ui/StateComponents'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export function ProductsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const csvInputRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [metaMap, setMetaMap] = useState<ProductMetaMap>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'hidden'>(
    (searchParams.get('status') as 'published' | 'hidden') || 'all'
  )
  const [filterPending, setFilterPending] = useState<string>(
    searchParams.get('pendencia') || ''
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState<string>('')
  const [importingCsv, setImportingCsv] = useState(false)

  // Modal de Reajuste em Massa
  const [showBatchPriceModal, setShowBatchPriceModal] = useState(false)
  const [batchPriceType, setBatchPriceType] = useState<'percentage' | 'fixed'>('percentage')
  const [batchPriceValue, setBatchPriceValue] = useState('')
  const [batchPriceLoading, setBatchPriceLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats, metas] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
        getAllProductMeta(),
      ])
      setProducts(prods)
      setCategories(cats)
      setMetaMap(metas)
    } catch {
      toast.error('Erro ao carregar produtos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCategory || p.category_id === filterCategory
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'published' && p.is_published) ||
      (filterStatus === 'hidden' && !p.is_published)
    const matchPending =
      !filterPending ||
      (filterPending === 'sem-foto' && (!p.product_images || p.product_images.length === 0)) ||
      (filterPending === 'sem-preco' && (!p.price || p.price <= 0))
    return matchSearch && matchCat && matchStatus && matchPending
  })

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((p) => p.id))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedIds.length === 0) return
    try {
      await Promise.all(selectedIds.map((id) => toggleProductPublished(id, publish)))
      setProducts((prev) =>
        prev.map((p) => (selectedIds.includes(p.id) ? { ...p, is_published: publish } : p))
      )
      toast.success(
        `${selectedIds.length} produto(s) ${publish ? 'publicado(s)' : 'ocultado(s)'}!`
      )
      setSelectedIds([])
    } catch {
      toast.error('Erro ao atualizar em lote.')
    }
  }

  const handleToggle = async (product: Product) => {
    setTogglingId(product.id)
    try {
      await toggleProductPublished(product.id, !product.is_published)
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_published: !p.is_published } : p))
      )
      toast.success(product.is_published ? 'Produto ocultado.' : 'Produto publicado.')
    } catch {
      toast.error('Erro ao alterar status.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleToggleFeatured = async (product: Product) => {
    try {
      const nextVal = !product.is_featured
      await updateProduct(product.id, { is_featured: nextVal })
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_featured: nextVal } : p))
      )
      toast.success(nextVal ? 'Adicionado aos destaques!' : 'Removido dos destaques.')
    } catch {
      toast.error('Erro ao atualizar destaque.')
    }
  }

  const handleMoveProductOrder = async (product: Product, direction: 'up' | 'down') => {
    const idx = filtered.findIndex((p) => p.id === product.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= filtered.length) return

    const other = filtered[swapIdx]
    const currentOrder = product.display_order || idx + 1
    const otherOrder = other.display_order || swapIdx + 1
    const nextCurrentOrder = currentOrder === otherOrder ? (direction === 'up' ? otherOrder - 1 : otherOrder + 1) : otherOrder
    const nextOtherOrder = currentOrder

    try {
      await Promise.all([
        updateProduct(product.id, { display_order: nextCurrentOrder }),
        updateProduct(other.id, { display_order: nextOtherOrder }),
      ])
      setProducts((prev) => {
        const updated = prev.map((p) => {
          if (p.id === product.id) return { ...p, display_order: nextCurrentOrder }
          if (p.id === other.id) return { ...p, display_order: nextOtherOrder }
          return p
        })
        return [...updated].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      })
      toast.success('Ordem na vitrine atualizada!')
    } catch {
      toast.error('Erro ao reordenar produto.')
    }
  }

  const handleQuickPriceSave = async (product: Product) => {
    setEditingPriceId(null)
    const clean = priceDraft.replace(',', '.').trim()
    const num = clean ? parseFloat(clean) : null
    if (clean && (isNaN(num!) || num! < 0)) {
      toast.error('Preço inválido.')
      return
    }
    if (num === product.price) return

    try {
      await updateProduct(product.id, { price: num !== null ? String(num) : '' })
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, price: num } : p))
      )
      toast.success('Preço atualizado!')
    } catch {
      toast.error('Erro ao atualizar preço.')
    }
  }

  const handleQuickAvailability = async (product: Product, availability: Availability) => {
    try {
      await updateProduct(product.id, { availability })
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, availability } : p))
      )
      toast.success('Disponibilidade atualizada!')
    } catch {
      toast.error('Erro ao atualizar disponibilidade.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteProduct(deleteTarget.id)
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id))
      toast.success('Produto excluído com sucesso.')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDuplicate = async (product: Product) => {
    try {
      const dup = await duplicateProduct(product.id)
      toast.success('Produto duplicado com sucesso! Abrindo editor...')
      navigate(`/admin/produtos/${dup.id}/editar`)
    } catch {
      toast.error('Erro ao duplicar produto.')
    }
  }

  // Copia mensagem formatada pronta para vendedores mandarem no WhatsApp
  const handleCopyWhatsAppOffer = (product: Product) => {
    const origin = window.location.origin
    const productUrl = `${origin}/produto/${product.slug}`
    const priceText =
      product.show_price && product.price
        ? `🔥 *${formatBRL(product.price)}*`
        : '💬 *Consulte condições especiais*'

    const message = [
      `📱 *${product.name}*`,
      product.short_description ? `✨ ${product.short_description}` : '',
      priceText,
      `✅ Disponível na Alfa Eletrônicos`,
      `👉 Veja fotos e detalhes: ${productUrl}`,
    ]
      .filter(Boolean)
      .join('\n')

    navigator.clipboard.writeText(message)
    toast.success('Oferta copiada! Cole no WhatsApp.', { icon: '💬' })
  }

  // Reajuste em massa de preços
  const handleApplyBatchPrice = async () => {
    const val = parseFloat(batchPriceValue.replace(',', '.').trim())
    if (isNaN(val) || val === 0) {
      toast.error('Informe um valor de reajuste válido.')
      return
    }

    setBatchPriceLoading(true)
    try {
      const count = await batchUpdatePrices({
        productIds: selectedIds.length > 0 ? selectedIds : undefined,
        categoryId: filterCategory || undefined,
        type: batchPriceType,
        value: val,
      })

      toast.success(`Preço atualizado em ${count} produto(s)!`)
      setShowBatchPriceModal(false)
      setBatchPriceValue('')
      setSelectedIds([])
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reajustar preços.')
    } finally {
      setBatchPriceLoading(false)
    }
  }

  // Exportar catálogo em CSV
  const handleExportCsv = () => {
    const header = 'nome;categoria;preco;descricao_curta;disponibilidade;publicado;destaque\n'
    const rows = products
      .map((p) => {
        const catName = p.category?.name || ''
        const price = p.price !== null ? String(p.price).replace('.', ',') : ''
        const shortDesc = (p.short_description || '').replace(/;/g, ',')
        return `${p.name};${catName};${price};${shortDesc};${p.availability};${p.is_published ? 'sim' : 'nao'};${p.is_featured ? 'sim' : 'nao'}`
      })
      .join('\n')

    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `catalogo-alfa-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Importar produtos via CSV (separado por ; ou ,)
  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportingCsv(true)

    try {
      const text = await file.text()
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      if (lines.length < 2) {
        toast.error('Planilha vazia ou sem linhas de produtos.')
        return
      }

      const sep = lines[0].includes(';') ? ';' : ','
      const dataLines = lines.slice(1)
      let createdCount = 0

      for (const line of dataLines) {
        const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
        const [name, catName, rawPrice, shortDesc, availRaw, pubRaw, featRaw] = cols
        if (!name) continue

        const matchedCat = categories.find(
          (c) =>
            c.name.toLowerCase() === (catName || '').toLowerCase() ||
            c.slug === slugify(catName || '')
        )

        const normalizedPrice = (rawPrice || '').replace(/[R$\s]/g, '').replace(',', '.')
        const availability: Availability =
          availRaw === 'unavailable' || availRaw === 'indisponivel'
            ? 'unavailable'
            : availRaw === 'on_request' || availRaw === 'sob_consulta'
            ? 'on_request'
            : 'available'

        const isPublished = !pubRaw || /^(sim|true|1|s)$/i.test(pubRaw)
        const isFeatured = /^(sim|true|1|s)$/i.test(featRaw || '')

        await createProduct({
          name,
          slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 5)}`,
          category_id: matchedCat?.id || categories[0]?.id || '',
          short_description: shortDesc || '',
          description: shortDesc || '',
          price: normalizedPrice && !isNaN(parseFloat(normalizedPrice)) ? normalizedPrice : '',
          show_price: true,
          availability,
          is_published: isPublished,
          is_featured: isFeatured,
          display_order: createdCount,
        })
        createdCount++
      }

      toast.success(`${createdCount} produto(s) importado(s) com sucesso!`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar CSV.')
    } finally {
      setImportingCsv(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex flex-col gap-5 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">Produtos</h1>
            <p className="text-sm text-[#767676] mt-0.5">
              {products.length} produto(s) · Clique no preço na tabela para edição rápida
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportCsv}
            />
            <Button
              variant="secondary"
              icon={<Upload size={15} />}
              loading={importingCsv}
              onClick={() => csvInputRef.current?.click()}
            >
              Importar CSV
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={15} />}
              onClick={handleExportCsv}
            >
              Exportar CSV
            </Button>
            <Button
              variant="secondary"
              icon={<Percent size={15} />}
              onClick={() => setShowBatchPriceModal(true)}
              title="Ajustar preços em massa de produtos selecionados ou categorias"
            >
              Reajustar Preços
            </Button>
            <Link to="/admin/produtos/novo">
              <Button icon={<Plus size={16} />}>Novo produto</Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 flex flex-wrap gap-3 items-center">
          {/* Busca */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-52 focus-within:border-[#111111] transition-all">
            <Search size={15} className="text-muted shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="flex-1 text-sm text-graphite outline-none placeholder-gray-400"
            />
          </div>

          {/* Categoria */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-graphite bg-white outline-none"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Pendências */}
          <select
            value={filterPending}
            onChange={(e) => setFilterPending(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-graphite bg-white outline-none"
          >
            <option value="">Todas as situações</option>
            <option value="sem-foto">Sem fotografia</option>
            <option value="sem-preco">Sem preço</option>
          </select>

          {/* Status */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(['all', 'published', 'hidden'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-2 text-xs font-medium transition-colors',
                  filterStatus === s
                    ? 'bg-[#111111] text-white'
                    : 'text-muted hover:bg-surface'
                )}
              >
                {s === 'all' ? 'Todos' : s === 'published' ? 'Publicados' : 'Ocultos'}
              </button>
            ))}
          </div>
        </div>

        {/* Barra de ações em lote */}
        {selectedIds.length > 0 && (
          <div className="bg-[#111111] text-white rounded-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-3 animate-fade-in">
            <span className="text-xs font-semibold">
              {selectedIds.length} produto(s) selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBatchPriceModal(true)}
                className="text-xs font-semibold bg-[#24A850] hover:bg-[#1E8E42] text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Percent size={13} />
                Reajustar Preços
              </button>
              <button
                onClick={() => handleBulkPublish(true)}
                className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
              >
                Publicar selecionados
              </button>
              <button
                onClick={() => handleBulkPublish(false)}
                className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
              >
                Ocultar selecionados
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-white/70 hover:text-white px-2 py-1.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de produtos */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Package size={48} />}
            title="Nenhum produto encontrado"
            description={search ? `Não há resultados para "${search}".` : 'Comece cadastrando seu primeiro produto.'}
            action={
              <Link to="/admin/produtos/novo">
                <Button icon={<Plus size={16} />}>Cadastrar produto</Button>
              </Link>
            }
          />
        ) : (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-100 bg-[#FAFAF8]">
                    <th className="pl-4 pr-2 py-3 w-8">
                      <button
                        onClick={toggleSelectAll}
                        className="text-muted hover:text-[#111111] flex items-center"
                        aria-label="Selecionar todos"
                      >
                        {selectedIds.length === filtered.length && filtered.length > 0 ? (
                          <CheckSquare size={16} className="text-[#111111]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Produto</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">Categoria</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">Preço (clique p/ editar)</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">Disponibilidade</th>
                    <th className="px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((product) => {
                    const primaryImg =
                      product.product_images?.find((i) => i.is_primary) ||
                      product.product_images?.[0]
                    const isSelected = selectedIds.includes(product.id)

                    return (
                      <tr key={product.id} className="hover:bg-surface/60 transition-colors">
                        {/* Checkbox */}
                        <td className="pl-4 pr-2 py-3">
                          <button
                            onClick={() => toggleSelectOne(product.id)}
                            className="text-muted hover:text-[#111111] flex items-center"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-[#111111]" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>

                        {/* Produto */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#F8F8F8] border border-[#EAEAEA] overflow-hidden shrink-0">
                              {primaryImg?.public_url ? (
                                <img
                                  src={primaryImg.public_url}
                                  alt={product.name}
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package size={16} className="text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/admin/produtos/${product.id}/editar`}
                                className="text-sm font-semibold text-[#111111] hover:underline truncate block max-w-[200px]"
                              >
                                {product.name}
                              </Link>
                              <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
                                <button
                                  onClick={() => handleToggleFeatured(product)}
                                  className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-medium transition-colors',
                                    product.is_featured
                                      ? 'text-amber-600'
                                      : 'text-[#AAAAAA] hover:text-[#555555]'
                                  )}
                                >
                                  <Star
                                    size={11}
                                    fill={product.is_featured ? 'currentColor' : 'none'}
                                  />
                                  {product.is_featured ? 'Em destaque' : 'Destacar'}
                                </button>

                                {metaMap[product.id]?.stock_quantity !== undefined &&
                                  metaMap[product.id]?.stock_quantity !== null && (
                                    <span
                                      className={cn(
                                        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                        (metaMap[product.id]?.stock_quantity ?? 0) <=
                                          (metaMap[product.id]?.low_stock_threshold ?? 2)
                                          ? 'bg-red-50 text-red-700'
                                          : 'bg-gray-100 text-gray-600'
                                      )}
                                    >
                                      Est: {metaMap[product.id]?.stock_quantity}
                                    </span>
                                  )}

                                {(metaMap[product.id]?.whatsapp_clicks || 0) > 0 && (
                                  <span
                                    title="Cliques no botão de WhatsApp"
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#24A850] bg-[#24A850]/10 px-1.5 py-0.5 rounded"
                                  >
                                    <MessageCircle size={10} />
                                    {metaMap[product.id]?.whatsapp_clicks}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Categoria */}
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className="text-xs font-medium text-[#555555]">
                            {product.category?.name || '—'}
                          </span>
                        </td>

                        {/* Preço com edição rápida */}
                        <td className="px-3 py-3 hidden md:table-cell">
                          {editingPriceId === product.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={priceDraft}
                              onChange={(e) => setPriceDraft(e.target.value)}
                              onBlur={() => handleQuickPriceSave(product)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleQuickPriceSave(product)
                                if (e.key === 'Escape') setEditingPriceId(null)
                              }}
                              className="w-28 px-2 py-1 text-sm border border-[#111111] rounded-lg outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingPriceId(product.id)
                                setPriceDraft(product.price ? String(product.price) : '')
                              }}
                              title="Clique para editar o preço rapidamente"
                              className="text-sm font-semibold text-[#111111] hover:bg-gray-100 px-2 py-1 -mx-2 rounded-lg transition-colors tabular-nums"
                            >
                              {product.show_price && product.price
                                ? formatBRL(product.price)
                                : product.price && !product.show_price
                                ? 'Oculto'
                                : 'Definir R$'}
                            </button>
                          )}
                        </td>

                        {/* Disponibilidade com troca rápida */}
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <select
                            value={product.availability}
                            onChange={(e) =>
                              handleQuickAvailability(product, e.target.value as Availability)
                            }
                            className="text-xs font-medium text-[#242424] bg-[#F7F7F7] border border-[#E5E5E5] rounded-lg px-2 py-1 outline-none cursor-pointer"
                          >
                            {Object.entries(AVAILABILITY_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <Badge variant={product.is_published ? 'green' : 'gray'}>
                            {product.is_published ? 'Publicado' : 'Oculto'}
                          </Badge>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveProductOrder(product, 'up')}
                              title="Subir posição na vitrine"
                              className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-[#111111] transition-colors"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveProductOrder(product, 'down')}
                              title="Descer posição na vitrine"
                              className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-[#111111] transition-colors"
                            >
                              <ArrowDown size={15} />
                            </button>

                            <button
                              onClick={() => handleToggle(product)}
                              disabled={togglingId === product.id}
                              title={product.is_published ? 'Ocultar' : 'Publicar'}
                              className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-graphite transition-colors disabled:opacity-50"
                            >
                              {product.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>

                            <Link
                              to={`/admin/produtos/${product.id}/editar`}
                              className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-brand transition-colors"
                              title="Editar completo"
                            >
                              <Edit size={16} />
                            </Link>

                            {product.is_published && (
                              <a
                                href={`/produto/${product.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-graphite transition-colors"
                                title="Ver página pública"
                              >
                                <ExternalLink size={16} />
                              </a>
                            )}

                            <button
                              onClick={() => handleCopyWhatsAppOffer(product)}
                              title="Copiar oferta formatada para o WhatsApp"
                              className="p-1.5 rounded-lg hover:bg-[#24A850]/10 text-muted hover:text-[#24A850] transition-colors"
                            >
                              <MessageCircle size={16} />
                            </button>

                            <button
                              onClick={() => handleDuplicate(product)}
                              title="Duplicar produto"
                              className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-graphite transition-colors"
                            >
                              <Copy size={16} />
                            </button>

                            <button
                              onClick={() => setDeleteTarget(product)}
                              title="Excluir"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      />

      {/* Modal de Reajuste de Preços em Massa */}
      {showBatchPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">
                Reajustar Preços em Massa
              </h3>
              <p className="text-xs text-[#767676] mt-1">
                {selectedIds.length > 0
                  ? `Aplicar reajuste em ${selectedIds.length} produto(s) selecionado(s).`
                  : filterCategory
                  ? `Aplicar reajuste a todos os produtos da categoria selecionada.`
                  : `Aplicar reajuste a TODOS os produtos do catálogo.`}
              </p>
            </div>

            {/* Tipo de Reajuste */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5F5F5] rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBatchPriceType('percentage')}
                className={cn(
                  'py-2 rounded-lg transition-colors',
                  batchPriceType === 'percentage'
                    ? 'bg-white text-[#111111] shadow-sm'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Porcentagem (%)
              </button>
              <button
                type="button"
                onClick={() => setBatchPriceType('fixed')}
                className={cn(
                  'py-2 rounded-lg transition-colors',
                  batchPriceType === 'fixed'
                    ? 'bg-white text-[#111111] shadow-sm'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Valor Fixo (R$)
              </button>
            </div>

            {/* Campo de valor */}
            <div>
              <label className="text-xs font-semibold text-[#111111] block mb-1.5">
                {batchPriceType === 'percentage'
                  ? 'Variação percentual (+ para aumento, - para desconto)'
                  : 'Variação em Reais (+ para aumento, - para desconto)'}
              </label>
              <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2.5 focus-within:border-[#111111] transition-all">
                <span className="text-sm font-bold text-[#767676] mr-2">
                  {batchPriceType === 'percentage' ? '%' : 'R$'}
                </span>
                <input
                  type="text"
                  autoFocus
                  value={batchPriceValue}
                  onChange={(e) => setBatchPriceValue(e.target.value)}
                  placeholder={batchPriceType === 'percentage' ? 'Ex: 10 ou -5' : 'Ex: 50 ou -20'}
                  className="flex-1 text-sm font-semibold text-[#111111] outline-none"
                />
              </div>
              <p className="text-[11px] text-[#767676] mt-1.5">
                Exemplos: digite <strong>10</strong> para aumentar 10%, ou <strong>-15</strong> para dar 15% de desconto.
              </p>
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-2.5 mt-2">
              <Button
                variant="ghost"
                disabled={batchPriceLoading}
                onClick={() => {
                  setShowBatchPriceModal(false)
                  setBatchPriceValue('')
                }}
              >
                Cancelar
              </Button>
              <Button
                loading={batchPriceLoading}
                onClick={handleApplyBatchPrice}
              >
                Aplicar Reajuste
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
