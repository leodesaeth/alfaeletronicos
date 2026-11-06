import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Package,
  Smartphone,
  Headphones,
  BatteryCharging,
  Laptop,
  Sparkles,
  Grid3X3,
  Camera,
  Watch,
  Tv2,
} from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { getActiveCategories, getCategoryImageUrl } from '@/services/categories'
import { getFeaturedProducts, getPublishedProducts } from '@/services/products'
import type { Category, Product } from '@/types'
import { ProductCard, ProductCardSkeleton } from '@/components/catalog/ProductCard'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

// ── Ícones customizados fiéis à referência visual ────────────────
function PerfumeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="26" height="26">
      <rect x="9" y="2" width="6" height="2.5" rx="0.8" />
      <rect x="10.5" y="4.5" width="3" height="2" />
      <path d="M7 8.5C7 7.4 7.9 6.5 9 6.5h6c1.1 0 2 .9 2 2v10c0 1.4-1.1 2.5-2.5 2.5h-5C8.1 21 7 19.9 7 18.5v-10z" />
    </svg>
  )
}

function ChocolateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} width="26" height="26">
      <g transform="rotate(-35 12 12)">
        <rect x="6" y="3" width="12" height="18" rx="1.8" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="6" y1="9" x2="18" y2="9" />
        <line x1="6" y1="15" x2="18" y2="15" />
      </g>
    </svg>
  )
}

function renderCategoryIcon(name: string, slug: string) {
  const text = `${name} ${slug}`.toLowerCase()
  const cls = 'text-[#111111] group-hover:scale-110 transition-transform duration-200'

  if (/celular|smartphone|iphone|samsung|mobile/.test(text))
    return <Smartphone size={26} className={cls} strokeWidth={1.8} />
  if (/capinha|acessor|case|capa/.test(text))
    return <Headphones size={26} className={cls} strokeWidth={1.8} />
  if (/carregad|cabo|charging|power|bateria/.test(text))
    return <BatteryCharging size={26} className={cls} strokeWidth={1.8} />
  if (/fone|audio|headphone|earphone|airpod|bluetooth|áudio/.test(text))
    return <Headphones size={26} className={cls} strokeWidth={1.8} />
  if (/inform|computad|laptop|notebook|pc|mac/.test(text))
    return <Laptop size={26} className={cls} strokeWidth={1.8} />
  if (/perfume|fragran|colônia|cosmet/.test(text))
    return <PerfumeIcon className={cls} />
  if (/chocolat|doce|aliment|comida|snack/.test(text))
    return <ChocolateIcon className={cls} />
  if (/outro|geral|mais/.test(text))
    return <Grid3X3 size={26} className={cls} strokeWidth={2} />
  if (/câmera|camera|foto/.test(text))
    return <Camera size={26} className={cls} strokeWidth={1.8} />
  if (/tv|televisão|tela/.test(text))
    return <Tv2 size={26} className={cls} strokeWidth={1.8} />
  if (/relógio|relogio|watch/.test(text))
    return <Watch size={26} className={cls} strokeWidth={1.8} />
  return <Sparkles size={26} className={cls} strokeWidth={1.8} />
}

// ── Composição principal do Hero (estúdio escuro integrado) ──────
const HERO_SLIDES = [
  {
    id: 1,
    image: '/showcase/hero-devices.png?v=2',
    alt: 'Smartphones, perfumes importados e fones Bluetooth premium na Alfa Eletrônicos',
  },
]

export function HomePage() {
  const { settings } = useStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const heroSlides = [
    {
      id: 1,
      image: settings?.hero_image_url || '/showcase/hero-devices.png?v=2',
      alt: 'Smartphones, perfumes importados e fones Bluetooth premium na Alfa Eletrônicos',
    },
  ]

  const rawTitle = settings?.hero_title || 'Tudo o que você precisa,\nem um só lugar.'
  const titleLines = rawTitle.includes('\n')
    ? rawTitle.split('\n')
    : rawTitle.includes(',')
      ? [rawTitle.split(',')[0] + ',', rawTitle.split(',').slice(1).join(',').trim()]
      : [rawTitle]

  const heroDesc =
    settings?.hero_description ||
    'Eletrônicos, acessórios, perfumes e muito mais, com qualidade e as melhores opções.'

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [cats, featured] = await Promise.all([
          getActiveCategories(),
          getFeaturedProducts(5),
        ])
        if (!active) return
        setCategories(cats.slice(0, 8))

        if (featured.length > 0) {
          setFeaturedProducts(featured.slice(0, 5))
        } else {
          const recent = await getPublishedProducts({ sort: 'default' })
          if (active) setFeaturedProducts(recent.slice(0, 5))
        }
      } catch (err) {
        console.error('Erro ao carregar página inicial:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const nextSlide = useCallback(() => {
    setCurrentSlide((s) => (s + 1) % heroSlides.length)
  }, [heroSlides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((s) => (s - 1 + heroSlides.length) % heroSlides.length)
  }, [heroSlides.length])

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(nextSlide, 6000)
    return () => clearInterval(timer)
  }, [nextSlide, isPaused])

  return (
    <div className="bg-white text-[#111111]">
      <PublicHeader />

      {/* ══════════════════════════════════════════════════════════
          HERO CARROSSEL
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative bg-[#111111] overflow-hidden select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Fundo com faixas diagonais de estúdio */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(125deg, #0D0D0D 0%, #17171A 38%, #101012 38.5%, #1D1E22 68%, #111113 68.5%, #18191D 100%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center min-h-[340px] sm:min-h-[380px] lg:min-h-[410px] py-8 sm:py-10 gap-6 lg:gap-8">

            {/* ── Coluna esquerda: texto comercial ────────────────── */}
            <div className="lg:col-span-6 flex flex-col gap-3.5 z-10 sm:pl-8 lg:pl-10">
              <span className="text-[11px] sm:text-xs font-semibold text-white/80 uppercase tracking-[0.2em]">
                TECNOLOGIA, ESTILO E CONVENIÊNCIA
              </span>

              <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold leading-[1.08] tracking-tight">
                <span className="text-white block">{titleLines[0]}</span>
                {titleLines[1] && (
                  <span className="text-[#C4CBD6] block mt-0.5">{titleLines[1]}</span>
                )}
              </h1>

              <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-md">
                {heroDesc}
              </p>

              <div className="mt-2">
                <Link
                  to="/catalogo"
                  className="inline-flex items-center gap-2.5 bg-[#24A850] hover:bg-[#1E8E42] text-white border border-white/25 font-bold text-xs sm:text-sm px-6 py-3 rounded-full transition-all duration-200 shadow-[0_6px_22px_rgba(36,168,80,0.35)] hover:shadow-[0_8px_28px_rgba(36,168,80,0.5)]"
                >
                  Explorar Catálogo <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            {/* ── Coluna direita: composição fotográfica integrada ── */}
            <div className="lg:col-span-6 flex items-center justify-center relative h-[280px] sm:h-[340px] lg:h-[400px]">
              {heroSlides.map((slide, i) => (
                <img
                  key={slide.id}
                  src={slide.image}
                  alt={slide.alt}
                  style={{
                    WebkitMaskImage:
                      'radial-gradient(ellipse 75% 75% at 50% 50%, #000 68%, transparent 100%)',
                    maskImage:
                      'radial-gradient(ellipse 75% 75% at 50% 50%, #000 68%, transparent 100%)',
                  }}
                  className={`absolute inset-0 w-full h-full object-contain object-center mix-blend-lighten transition-all duration-700 ${i === currentSlide ? 'opacity-100 scale-105' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              ))}
            </div>
          </div>

          {/* ── Indicadores (dots) se houver mais de 1 banner ─────── */}
          {heroSlides.length > 1 && (
            <div className="flex justify-center items-center gap-1 pb-4">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className="p-2 flex items-center justify-center"
                  aria-label={`Ir para banner ${i + 1}`}
                >
                  <span
                    className={`block rounded-full transition-all duration-300 ${i === currentSlide
                        ? 'w-2.5 h-2.5 bg-white'
                        : 'w-2 h-2 bg-white/30 hover:bg-white/60 border border-white/40'
                      }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Setas laterais (exibidas quando houver múltiplos slides) ── */}
        {heroSlides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] border border-white/20 flex items-center justify-center text-white/75 hover:bg-white/[0.15] hover:text-white transition-all z-10"
              aria-label="Banner anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] border border-white/20 flex items-center justify-center text-white/75 hover:bg-white/[0.15] hover:text-white transition-all z-10"
              aria-label="Próximo banner"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════
          CATEGORIAS — 8 Cards Individuais Estilo Referência
      ══════════════════════════════════════════════════════════ */}
      {categories.length > 0 && (
        <section className="bg-white pt-6 pb-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {categories.map((cat) => {
                const imgUrl = getCategoryImageUrl(cat.image_path)
                return (
                  <Link
                    key={cat.id}
                    to={`/catalogo?categoria=${cat.slug}`}
                    className="group flex flex-col items-center justify-center gap-2 bg-[#F7F7F7] hover:bg-[#EFEFEF] border border-[#EBEBEB] hover:border-[#DCDCDC] rounded-2xl py-4 px-2.5 text-center transition-all duration-150 min-h-[96px]"
                  >
                    <div className="w-8 h-8 flex items-center justify-center">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={cat.name}
                          className="w-7 h-7 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        renderCategoryIcon(cat.name, cat.slug)
                      )}
                    </div>
                    <span className="text-[11px] sm:text-xs font-medium text-[#242424] group-hover:text-[#111111] leading-tight">
                      {cat.name}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          PRODUTOS EM DESTAQUE
      ══════════════════════════════════════════════════════════ */}
      <section className="pt-6 pb-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Cabeçalho da seção */}
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-lg sm:text-2xl text-[#111111] tracking-tight">
              Produtos em <strong className="font-extrabold">destaque</strong>
            </h2>
            <Link
              to="/catalogo"
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#242424] hover:text-[#111111] transition-colors whitespace-nowrap"
            >
              Ver todos os produtos <ArrowRight size={14} />
            </Link>
          </div>

          {/* Grid responsivo de 5 colunas no desktop */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-fade-in">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  hideFeaturedBadge
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-14 border border-[#EAEAEA] rounded-2xl bg-[#FAFAF8]">
              <Package size={36} className="mx-auto mb-3 text-[#CCCCCC]" strokeWidth={1.2} />
              <p className="text-sm text-[#767676]">
                Nenhum produto disponível no momento.
              </p>
            </div>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
