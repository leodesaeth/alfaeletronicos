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
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  getAllProducts,
  toggleProductPublished,
  deleteProduct,
  duplicateProduct,
  updateProduct,
  createProduct,
} from '@/services/products'
import { getAllCategories } from '@/services/categories'
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

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats] = await Promise.all([getAllProducts(), getAllCategories()])
      setProducts(prods)
      setCategories(cats)
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
      toast.success('Produto duplicado. Abrindo editor...')
      navigate(`/admin/produtos/${dup.id}/editar`)
    } catch {
      toast.error('Erro ao duplicar produto.')
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
      <div className="flex flex-col gap-5 max-w-6xl">
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
                              <button
                                onClick={() => handleToggleFeatured(product)}
                                className={cn(
                                  'inline-flex items-center gap-1 text-[11px] font-medium mt-0.5 transition-colors',
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
                              onClick={() => handleDuplicate(product)}
                              title="Duplicar"
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
    </AdminLayout>
  )
}
