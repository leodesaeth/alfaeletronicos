import { Link } from 'react-router-dom'
import { MessageCircle, Package } from 'lucide-react'
import type { Product } from '@/types'
import { AVAILABILITY_LABELS } from '@/types'
import { formatBRL, buildWhatsAppLink, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useStore } from '@/hooks/useStore'

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
  const primaryImage = getPrimaryImage(product)
  const productUrl = `${window.location.origin}/produto/${product.slug}`
  const whatsappNumber = settings?.whatsapp_number || '5511999999999'

  const whatsappLink = buildWhatsAppLink(whatsappNumber, product.name, productUrl)

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

        {/* Preço */}
        {product.show_price && product.price !== null && product.price > 0 ? (
          <p className="text-base font-extrabold text-[#111111] tabular-nums mt-1.5">
            {formatBRL(product.price)}
          </p>
        ) : (
          <p className="text-xs font-semibold text-[#555555] mt-1.5">
            Consulte o preço
          </p>
        )}

        {/* ── Botão WhatsApp pílula ──────────────────────────────── */}
        <div className="mt-2.5">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#24A850] hover:bg-[#1E8E42] text-white text-xs font-semibold py-2.5 px-4 rounded-full transition-colors duration-150 shadow-sm"
          >
            <MessageCircle size={14} />
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </article>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 overflow-hidden flex flex-col animate-pulse">
      <div className="aspect-[4/3] bg-[#F2F2F2] rounded-xl mb-3" />
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-3/4 bg-[#F2F2F2] rounded" />
        <div className="h-3 w-full bg-[#F2F2F2] rounded" />
        <div className="h-5 w-1/2 bg-[#F2F2F2] rounded mt-1" />
        <div className="h-9 w-full bg-[#F2F2F2] rounded-full mt-2" />
      </div>
    </div>
  )
}
