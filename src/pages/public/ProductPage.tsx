import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  MessageCircle,
  Share2,
  Package,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import { getPublishedProductBySlug, getRelatedProducts } from '@/services/products'
import type { Product } from '@/types'
import { AVAILABILITY_LABELS } from '@/types'
import { formatBRL, buildWhatsAppLink } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useStore } from '@/hooks/useStore'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { ProductCard } from '@/components/catalog/ProductCard'
import { PageLoader } from '@/components/ui/StateComponents'
import {
  getAllProductMeta,
  recordWhatsAppClick,
  type ProductMetaItem,
} from '@/services/catalogIntelligence'
import { addToQuoteBag, openQuoteBagDrawer } from '@/lib/quoteBag'
import toast from 'react-hot-toast'

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const { settings } = useStore()

  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [copied, setCopied] = useState(false)
  const [variations, setVariations] = useState<string[]>([])
  const [selectedVariation, setSelectedVariation] = useState<string>('')
  const [prodMeta, setProdMeta] = useState<ProductMetaItem | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    setActiveImage(0)

    getPublishedProductBySlug(slug)
      .then(async (data) => {
        if (!data) {
          setNotFound(true)
          return
        }
        setProduct(data)

        const metaMap = await getAllProductMeta()
        const metaItem = metaMap[data.id] || null
        setProdMeta(metaItem)
        const prodVariations = metaItem?.variations || []
        setVariations(prodVariations)
        setSelectedVariation(prodVariations[0] || '')

        if (data.category_id) {
          const rel = await getRelatedProducts(data.id, data.category_id, 4)
          setRelated(rel)
        }
      })
      .catch(() => {
        setNotFound(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [slug])

  if (loading) {
    return (
      <>
        <PublicHeader />
        <PageLoader />
        <PublicFooter />
      </>
    )
  }

  if (notFound || !product) {
    return (
      <>
        <PublicHeader />
        <div className="flex flex-col items-center justify-center py-28 px-4 text-center">
          <Package size={48} className="text-[#DDDDDD] mb-5" strokeWidth={1} />
          <h1 className="text-lg font-bold text-[#111111] mb-2">
            Produto não encontrado
          </h1>
          <p className="text-sm text-[#777777] mb-8 max-w-xs leading-relaxed">
            Este produto pode ter sido removido ou seu link pode estar incorreto.
          </p>
          <Link
            to="/catalogo"
            className="flex items-center gap-2 text-sm font-semibold text-[#111111] border-2 border-[#111111] hover:bg-[#111111] hover:text-white px-5 py-2.5 rounded-full transition-all"
          >
            <ArrowLeft size={14} /> Voltar ao catálogo
          </Link>
        </div>
        <PublicFooter />
      </>
    )
  }

  const images = product.product_images || []
  const sortedImages = [...images].sort((a, b) => a.display_order - b.display_order)
  const currentImage = sortedImages[activeImage]
  const productUrl = `${window.location.origin}/produto/${product.slug}`
  const whatsappNumber = settings?.whatsapp_number || '5511999999999'
  const customTemplate = settings?.whatsapp_message_template
  const productLabelWithVariation = selectedVariation
    ? `${product.name} (${selectedVariation})`
    : product.name
  const whatsappLink = buildWhatsAppLink(
    whatsappNumber,
    productLabelWithVariation,
    productUrl,
    customTemplate
  )

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: product.name, url: productUrl })
    } else {
      await navigator.clipboard.writeText(productUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const prevImage = () => setActiveImage((a) => Math.max(0, a - 1))
  const nextImage = () => setActiveImage((a) => Math.min(sortedImages.length - 1, a + 1))

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8]">
      <PublicHeader />

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#EAEAEA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex items-center gap-2 text-xs text-[#AAAAAA]">
            <Link to="/" className="hover:text-[#111111] transition-colors">
              Início
            </Link>
            <span>/</span>
            <Link to="/catalogo" className="hover:text-[#111111] transition-colors">
              Catálogo
            </Link>
            {product.category && (
              <>
                <span>/</span>
                <Link
                  to={`/catalogo?categoria=${product.category.slug}`}
                  className="hover:text-[#111111] transition-colors"
                >
                  {product.category.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-[#777777] truncate max-w-[180px]">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* ── Detalhe do produto ──────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex-1">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Galeria ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {/* Imagem principal */}
            <div
              className="relative bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden shadow-card"
              style={{ aspectRatio: '1 / 1' }}
            >
              {currentImage ? (
                <img
                  src={currentImage.public_url || ''}
                  alt={`${product.name} — imagem ${activeImage + 1}`}
                  className="w-full h-full object-contain p-6"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-[#DDDDDD]">
                  <Package size={56} strokeWidth={1} />
                  <span className="text-sm text-[#CCCCCC]">Sem imagem</span>
                </div>
              )}

              {/* Setas navegação */}
              {sortedImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    disabled={activeImage === 0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white border border-[#EAEAEA] rounded-full flex items-center justify-center hover:border-[#111111] disabled:opacity-25 transition-all shadow-sm"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={nextImage}
                    disabled={activeImage === sortedImages.length - 1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white border border-[#EAEAEA] rounded-full flex items-center justify-center hover:border-[#111111] disabled:opacity-25 transition-all shadow-sm"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {sortedImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={cn(
                          'rounded-full transition-all duration-200',
                          i === activeImage
                            ? 'bg-[#111111] w-5 h-1.5'
                            : 'bg-[#CCCCCC] w-1.5 h-1.5 hover:bg-[#999999]'
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {sortedImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sortedImages.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      'w-16 h-16 shrink-0 border-2 rounded-xl overflow-hidden transition-all duration-150',
                      i === activeImage
                        ? 'border-[#111111]'
                        : 'border-transparent hover:border-[#CCCCCC]'
                    )}
                  >
                    <img
                      src={img.public_url || ''}
                      alt={`Thumbnail ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Informações ─────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Categoria + badge */}
            <div className="flex items-center gap-3">
              {product.category && (
                <Link
                  to={`/catalogo?categoria=${product.category.slug}`}
                  className="text-[10px] font-semibold text-[#999999] uppercase tracking-[0.12em] hover:text-[#111111] transition-colors"
                >
                  {product.category.name}
                </Link>
              )}
              {product.is_featured && (
                <span className="text-[10px] bg-[#111111] text-white font-semibold px-2.5 py-1 rounded-full">
                  Destaque
                </span>
              )}
            </div>

            {/* Nome */}
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] leading-tight tracking-tight">
              {product.name}
            </h1>

            {/* Disponibilidade + Gatilho de Escassez */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex w-fit items-center text-xs font-semibold px-3 py-1 rounded-full',
                  product.availability === 'available'   && 'text-[#166534] bg-[#F0FDF4]',
                  product.availability === 'unavailable' && 'text-[#991B1B] bg-[#FEF2F2]',
                  product.availability === 'on_request'  && 'text-[#92400E] bg-[#FFFBEB]',
                )}
              >
                {AVAILABILITY_LABELS[product.availability]}
              </span>

              {product.availability === 'available' &&
                prodMeta?.stock_quantity !== undefined &&
                prodMeta?.stock_quantity !== null &&
                prodMeta.stock_quantity > 0 &&
                prodMeta.stock_quantity <= (prodMeta.low_stock_threshold ?? 2) && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                    Última{prodMeta.stock_quantity === 1 ? '' : 's'} {prodMeta.stock_quantity} unidade{prodMeta.stock_quantity === 1 ? '' : 's'} a pronta entrega
                  </span>
                )}
            </div>

            {/* Preço Normal ou Promocional De / Por */}
            {product.show_price && product.price !== null && product.price > 0 && (
              <div className="py-4 border-t border-b border-[#EAEAEA] space-y-1">
                {prodMeta?.compare_at_price && prodMeta.compare_at_price > product.price && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#999999] line-through tabular-nums">
                      De {formatBRL(prodMeta.compare_at_price)}
                    </span>
                    <span className="text-[11px] font-bold text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-0.5 rounded-full">
                      -{Math.round(((prodMeta.compare_at_price - product.price) / prodMeta.compare_at_price) * 100)}% • Economize {formatBRL(prodMeta.compare_at_price - product.price)}
                    </span>
                  </div>
                )}
                <p className="text-3xl font-bold text-[#111111] tracking-tight tabular-nums">
                  {formatBRL(product.price)}
                </p>
              </div>
            )}

            {/* Descrição */}
            {(product.short_description || product.description) && (
              <div className="text-sm leading-relaxed space-y-3">
                {product.short_description && (
                  <p className="font-medium text-[#242424] text-base">
                    {product.short_description}
                  </p>
                )}
                {product.description && (
                  <p className="text-[#777777] whitespace-pre-wrap leading-7">
                    {product.description}
                  </p>
                )}
              </div>
            )}

            {/* Variações disponíveis */}
            {variations.length > 0 && (
              <div className="flex flex-col gap-2 py-2">
                <span className="text-xs font-semibold text-[#555555] uppercase tracking-wider">
                  Opções / Variações:
                </span>
                <div className="flex flex-wrap gap-2">
                  {variations.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVariation(v)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                        selectedVariation === v
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-white text-[#242424] border-[#DCDCDC] hover:border-[#111111]'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-col gap-3 pt-1">
              {whatsappLink ? (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordWhatsAppClick(product.id)}
                    className="flex-1 flex items-center justify-center gap-2.5 bg-[#24A850] hover:bg-[#1E8E42] text-white font-semibold text-sm px-6 py-4 rounded-xl transition-colors duration-150 shadow-sm"
                  >
                    <MessageCircle size={18} />
                    Falar no WhatsApp
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      addToQuoteBag(product, selectedVariation || undefined, 1)
                      toast.success('Adicionado à sacola de orçamento!')
                      openQuoteBagDrawer()
                    }}
                    className="flex items-center justify-center gap-2 bg-[#111111] hover:bg-[#242424] text-white font-semibold text-sm px-5 py-4 rounded-xl transition-colors duration-150"
                  >
                    <ShoppingBag size={17} />
                    + Sacola de Orçamento
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-sm text-[#777777] bg-[#F5F5F5] border border-[#EAEAEA] px-4 py-3 rounded-xl">
                  <AlertCircle size={15} />
                  WhatsApp não configurado.
                </div>
              )}

              {/* 3 Selos de Confiança Alfa Eletrônicos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-[#EAEAEA] text-xs text-[#242424]">
                  <ShieldCheck size={16} className="text-[#24A850] shrink-0" />
                  <span className="font-medium">Original e com Garantia</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-[#EAEAEA] text-xs text-[#242424]">
                  <Zap size={16} className="text-[#24A850] shrink-0" />
                  <span className="font-medium">Pronta Entrega Rápida</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-[#EAEAEA] text-xs text-[#242424]">
                  <CheckCircle2 size={16} className="text-[#24A850] shrink-0" />
                  <span className="font-medium">Atendimento Direto</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  to="/catalogo"
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-[#777777] border border-[#EAEAEA] hover:border-[#111111] hover:text-[#111111] px-4 py-3 rounded-xl transition-colors duration-150"
                >
                  <ArrowLeft size={14} /> Catálogo
                </Link>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 text-sm font-medium text-[#777777] border border-[#EAEAEA] hover:border-[#111111] hover:text-[#111111] px-4 py-3 rounded-xl transition-colors duration-150"
                >
                  <Share2 size={14} />
                  {copied ? 'Copiado!' : 'Compartilhar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Produtos relacionados ───────────────────────────────── */}
        {related.length > 0 && (
          <section className="mt-16 pt-10 border-t border-[#EAEAEA]">
            <h2 className="text-xl font-bold text-[#111111] mb-7">
              Outros produtos da categoria
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      <PublicFooter />

      {/* ── Barra fixa mobile de conversão via WhatsApp ─────────── */}
      {whatsappLink && (
        <div className="sm:hidden sticky bottom-0 z-40 bg-white/95 backdrop-blur border-t border-[#EAEAEA] px-4 py-3 flex items-center justify-between gap-3 shadow-modal">
          <div>
            <p className="text-[11px] text-[#767676] leading-none">Valor</p>
            {product.show_price && product.price !== null && product.price > 0 ? (
              <p className="text-base font-extrabold text-[#111111] tabular-nums mt-0.5">
                {formatBRL(product.price)}
              </p>
            ) : (
              <p className="text-xs font-bold text-[#111111] mt-0.5">Sob consulta</p>
            )}
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordWhatsAppClick(product.id)}
            className="flex-1 max-w-[220px] flex items-center justify-center gap-2 bg-[#24A850] hover:bg-[#1E8E42] text-white font-semibold text-xs py-3 px-4 rounded-full transition-colors shadow-sm"
          >
            <MessageCircle size={15} />
            Falar no WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
