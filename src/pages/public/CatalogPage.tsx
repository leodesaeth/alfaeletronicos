import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, Package, SlidersHorizontal, Check, MessageCircle } from 'lucide-react'
import { getPublishedProducts } from '@/services/products'
import { getActiveCategories } from '@/services/categories'
import type { Product, Category, CatalogFilters } from '@/types'
import { ProductCard, ProductCardSkeleton } from '@/components/catalog/ProductCard'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { EmptyState } from '@/components/ui/StateComponents'
import { cn, normalizeWhatsAppNumber } from '@/lib/utils'
import { useStore } from '@/hooks/useStore'

const SORT_OPTIONS = [
  { value: 'default', label: 'Relevância' },
  { value: 'name_asc', label: 'Nome A–Z' },
  { value: 'name_desc', label: 'Nome Z–A' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
]

export function CatalogPage() {
  const { settings } = useStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filters: CatalogFilters = {
    search: searchParams.get('busca') || '',
    category_slug: searchParams.get('categoria') || null,
    sort: (searchParams.get('ordem') as CatalogFilters['sort']) || 'default',
  }

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPublishedProducts(filters)
      setProducts(data)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [searchParams.toString()])

  useEffect(() => {
    getActiveCategories().then(setCategories)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const updateFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams({}, { replace: true })

  const hasActiveFilters =
    filters.search || filters.category_slug || filters.sort !== 'default'

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = searchInputRef.current?.value?.trim() || ''
    updateFilter('busca', val || null)
  }

  const selectedCategory = categories.find((c) => c.slug === filters.category_slug)
  const visibleProducts = onlyAvailable
    ? products.filter((p) => p.availability === 'available')
    : products
  const whatsappNumber = normalizeWhatsAppNumber(settings?.whatsapp_number || '5511999999999')

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8]">
      <PublicHeader />

      {/* ── Barra de filtros sticky ──────────────────────────────── */}
      <div className="bg-white border-b border-[#EAEAEA] sticky top-[72px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">

            {/* Busca */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex-1 flex items-center bg-[#FAFAF8] border border-[#EAEAEA] hover:border-[#CCCCCC] focus-within:border-[#111111] rounded-full px-4 py-2 gap-2 transition-colors duration-150"
            >
              <Search size={14} className="text-[#999999] shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                defaultValue={filters.search}
                placeholder="Buscar produtos..."
                className="flex-1 bg-transparent text-sm text-[#111111] placeholder-[#BBBBBB] outline-none"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => {
                    if (searchInputRef.current) searchInputRef.current.value = ''
                    updateFilter('busca', null)
                  }}
                  className="text-[#AAAAAA] hover:text-[#555555] transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </form>

            {/* Ordenação — desktop */}
            <button
              type="button"
              onClick={() => setOnlyAvailable((v) => !v)}
              className={cn(
                'hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border rounded-full transition-colors',
                onlyAvailable
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#242424] border-[#EAEAEA] hover:border-[#CCCCCC]'
              )}
            >
              {onlyAvailable && <Check size={12} />}
              Pronta entrega
            </button>

            <select
              value={filters.sort}
              onChange={(e) =>
                updateFilter('ordem', e.target.value === 'default' ? null : e.target.value)
              }
              className="hidden sm:block border border-[#EAEAEA] hover:border-[#CCCCCC] px-3 py-2 text-sm text-[#242424] bg-white rounded-full outline-none cursor-pointer transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Mobile: botão filtros */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                'sm:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-full transition-colors duration-150',
                hasActiveFilters
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white border-[#EAEAEA] text-[#242424] hover:border-[#CCCCCC]'
              )}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>

          {/* Mobile: filtros dropdown */}
          {filtersOpen && (
            <div className="sm:hidden mt-3 pb-2 animate-slide-up">
              <select
                value={filters.sort}
                onChange={(e) =>
                  updateFilter('ordem', e.target.value === 'default' ? null : e.target.value)
                }
                className="w-full border border-[#EAEAEA] px-3 py-2 text-sm text-[#242424] bg-white rounded-full outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <div className="flex gap-8">

          {/* ── Sidebar — categorias (desktop) ──────────────────── */}
          <aside className="hidden lg:flex flex-col w-48 xl:w-52 shrink-0">
            <div className="sticky top-[136px]">
              <h2 className="text-[10px] font-semibold text-[#999999] uppercase tracking-[0.12em] mb-3 px-3">
                Categorias
              </h2>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => updateFilter('categoria', null)}
                  className={cn(
                    'text-left px-3 py-2 text-sm transition-colors duration-150 font-medium rounded-lg',
                    !filters.category_slug
                      ? 'bg-[#111111] text-white'
                      : 'text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0]'
                  )}
                >
                  Todos os produtos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => updateFilter('categoria', cat.slug)}
                    className={cn(
                      'text-left px-3 py-2 text-sm transition-colors duration-150 rounded-lg',
                      filters.category_slug === cat.slug
                        ? 'bg-[#111111] text-white font-medium'
                        : 'text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0]'
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Área de produtos ────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Mobile: scroll horizontal de categorias */}
            {categories.length > 0 && (
              <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-5 -mx-1 px-1 scrollbar-hide">
                <button
                  onClick={() => updateFilter('categoria', null)}
                  className={cn(
                    'shrink-0 px-4 py-1.5 text-xs font-medium border rounded-full transition-colors duration-150',
                    !filters.category_slug
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-[#777777] border-[#EAEAEA] hover:border-[#CCCCCC]'
                  )}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => updateFilter('categoria', cat.slug)}
                    className={cn(
                      'shrink-0 px-4 py-1.5 text-xs font-medium border rounded-full transition-colors duration-150',
                      filters.category_slug === cat.slug
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#777777] border-[#EAEAEA] hover:border-[#CCCCCC]'
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Status bar */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCategory ? (
                  <span className="text-base font-semibold text-[#111111]">
                    {selectedCategory.name}
                  </span>
                ) : (
                  <span className="text-base font-semibold text-[#111111]">
                    Todos os produtos
                  </span>
                )}
                {!loading && (
                  <span className="text-sm text-[#AAAAAA]">
                    ({visibleProducts.length} {visibleProducts.length !== 1 ? 'itens' : 'item'})
                  </span>
                )}
              </div>
              {(hasActiveFilters || onlyAvailable) && (
                <button
                  onClick={() => {
                    clearFilters()
                    setOnlyAvailable(false)
                  }}
                  className="flex items-center gap-1.5 text-xs text-[#777777] hover:text-[#111111] transition-colors border border-[#EAEAEA] hover:border-[#CCCCCC] px-3 py-1.5 rounded-full"
                >
                  <X size={11} />
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : visibleProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Package size={44} strokeWidth={1} />}
                title={
                  filters.search
                    ? 'Nenhum produto encontrado'
                    : 'Nenhum produto disponível'
                }
                description={
                  filters.search
                    ? `Nenhum resultado para "${filters.search}". Tente outros termos.`
                    : 'Esta categoria ainda não possui produtos publicados.'
                }
                action={
                  hasActiveFilters ? (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-[#111111] underline underline-offset-4 font-medium"
                    >
                      Limpar filtros e ver todos
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Botão flutuante de ajuda rápida no WhatsApp */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
          'Olá, Alfa Eletrônicos! Estou navegando no catálogo digital e gostaria de consultar um produto.'
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-[#24A850] hover:bg-[#1E8E42] text-white text-xs font-bold px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105"
      >
        <MessageCircle size={16} />
        <span className="hidden sm:inline">Dúvidas? Chame no WhatsApp</span>
      </a>

      <PublicFooter />
    </div>
  )
}
