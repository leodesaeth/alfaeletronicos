import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Package, ShoppingBag, Check } from 'lucide-react'
import type { Product } from '@/types'
import { AVAILABILITY_LABELS } from '@/types'
import { formatBRL, buildWhatsAppLink, truncate, cn } from '@/lib/utils'
import { useStore } from '@/hooks/useStore'
import {
  getAllProductMeta,
  recordWhatsAppClick,
  type ProductMetaItem,
} from '@/services/catalogIntelligence'
import { addToQuoteBag } from '@/lib/quoteBag'
import toast from 'react-hot-toast'

interface ProductCardProps {
  product: Product
  hideFeaturedBadge?: boolean
}

function getPrimaryImage(product: Product): string | null {
  const images = product.product_images || []
  const primary = images.find((img) => img.is_primary)
  return primary?.public_url || images[0]?.public_url || null
}

export function ProductCard({ product, hideFeaturedBadge = false }: ProductCardProps) {
  const { settings } = useStore()
  const [meta, setMeta] = useState<ProductMetaItem | null>(null)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    let mounted = true
    getAllProductMeta()
      .then((map) => {
        if (mounted && map[product.id]) {
          setMeta(map[product.id])
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [product.id])

  const primaryImage = getPrimaryImage(product)
  const productUrl = `${window.location.origin}/produto/${product.slug}`
  const whatsappNumber = settings?.whatsapp_number || '5511999999999'
  const customTemplate = settings?.whatsapp_message_template

  const whatsappLink = buildWhatsAppLink(
    whatsappNumber,
    product.name,
    productUrl,
    customTemplate
  )

  const price = product.price || 0
  const compareAt = meta?.compare_at_price || 0
  const hasDiscount = product.show_price && price > 0 && compareAt > price
  const discountPct = hasDiscount
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0

  const stock = meta?.stock_quantity
  const lowThreshold = meta?.low_stock_threshold ?? 2
  const isLowStock =
    product.availability === 'available' &&
    stock !== undefined &&
    stock !== null &&
    stock > 0 &&
    stock <= lowThreshold

  const handleAddToBag = () => {
    addToQuoteBag(product)
    setJustAdded(true)
    toast.success(`"${product.name}" adicionado à sacola de orçamento!`)
    setTimeout(() => setJustAdded(false), 1800)
  }

  return (
    <article className="group bg-[#FFFFFF] rounded-2xl border border-[#EAEAEA] hover:border-[#D5D5D5] shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.09)] transition-all duration-300 overflow-hidden flex flex-col p-3.5 sm:p-4">
      {/* ── Fotografia em Fundo Branco Puro (#FFFFFF) ───────────── */}
      <Link
        to={`/produto/${product.slug}`}
        className="relative block overflow-hidden bg-[#FFFFFF] rounded-xl mb-3"
        style={{ aspectRatio: '1 / 1' }}
        aria-label={`Ver ${product.name}`}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-contain p-1.5 bg-[#FFFFFF] group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#FFFFFF] border border-[#F0F0F0] rounded-xl">
            <Package size={32} className="text-[#CCCCCC]" strokeWidth={1.5} />
            <span className="text-xs text-[#999999]">Sem imagem</span>
          </div>
        )}

        {/* Badge destaque (oculto na seção de destaques para evitar redundância) */}
        {product.is_featured && !hideFeaturedBadge && (
          <div className="absolute top-2 left-2 bg-[#111111] text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
            Destaque
          </div>
        )}

        {/* Badge Promocional -X% OFF (Editorial Sóburio) */}
        {hasDiscount && discountPct > 0 && (
          <div className="absolute top-2 right-2 bg-[#166534] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
            -{discountPct}%
          </div>
        )}
      </Link>

      {/* ── Informações ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 gap-1">
        {/* Nome */}
        <Link
          to={`/produto/${product.slug}`}
          className="font-bold text-[#111111] text-sm leading-snug hover:text-[#444444] transition-colors line-clamp-1"
        >
          {product.name}
        </Link>

        {/* Descrição curta */}
        {product.short_description && (
          <p className="text-[11px] text-[#767676] line-clamp-1 leading-relaxed">
            {truncate(product.short_description, 60)}
          </p>
        )}

        <div className="flex-1" />

        {/* Indicador discreto de últimas unidades (sem emojis) */}
        {isLowStock && (
          <span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-semibold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-full mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
            Última{stock === 1 ? '' : 's'} {stock} un.
          </span>
        )}

        {/* Status discreto apenas se não estiver disponível imediatamente */}
        {product.availability !== 'available' && (
          <span
            className={cn(
              'inline-flex w-fit items-center text-[10px] font-medium px-2 py-0.5 rounded-full mt-1',
              product.availability === 'unavailable' && 'text-[#991B1B] bg-[#FEF2F2]',
              product.availability === 'on_request' && 'text-[#92400E] bg-[#FFFBEB]'
            )}
          >
            {AVAILABILITY_LABELS[product.availability]}
          </span>
        )}

        {/* Preço Normal ou Promocional De / Por */}
        {product.show_price && product.price !== null && product.price > 0 ? (
          <div className="mt-1.5">
            {hasDiscount && (
              <p className="text-[11px] text-[#999999] line-through tabular-nums leading-none mb-0.5">
                De {formatBRL(compareAt)}
              </p>
            )}
            <p className="text-base font-extrabold text-[#111111] tabular-nums leading-tight">
              {formatBRL(product.price)}
            </p>
          </div>
        ) : (
          <p className="text-xs font-semibold text-[#555555] mt-1.5">
            Consulte o preço
          </p>
        )}

        {/* ── Botão WhatsApp pílula + Botão Sacola de Orçamento ──── */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordWhatsAppClick(product.id)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#24A850] hover:bg-[#1E8E42] text-white text-xs font-semibold py-2.5 px-3 rounded-full transition-colors duration-150 shadow-sm"
          >
            <MessageCircle size={14} />
            Falar no WhatsApp
          </a>

          <button
            type="button"
            onClick={handleAddToBag}
            title="Adicionar à sacola para cotar vários produtos juntos"
            className={cn(
              'w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-all',
              justAdded
                ? 'bg-[#111111] text-white border-[#111111]'
                : 'bg-[#F8F8F8] hover:bg-[#111111] text-[#242424] hover:text-white border-[#EAEAEA]'
            )}
          >
            {justAdded ? <Check size={14} /> : <ShoppingBag size={14} />}
          </button>
        </div>
      </div>
    </article>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 overflow-hidden flex flex-col animate-pulse">
      <div className="aspect-[1/1] bg-[#F2F2F2] rounded-xl mb-3" />
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-3/4 bg-[#F2F2F2] rounded" />
        <div className="h-3 w-full bg-[#F2F2F2] rounded" />
        <div className="h-5 w-1/2 bg-[#F2F2F2] rounded mt-1" />
        <div className="h-9 w-full bg-[#F2F2F2] rounded-full mt-2" />
      </div>
    </div>
  )
}
