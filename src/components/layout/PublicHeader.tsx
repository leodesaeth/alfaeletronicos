import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Menu, X, MessageCircle, ChevronDown } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import { getLogoUrl } from '@/services/storeSettings'
import { getActiveCategories } from '@/services/categories'
import { normalizeWhatsAppNumber } from '@/lib/utils'
import type { Category } from '@/types'

export function PublicHeader() {
  const { settings } = useStore()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  const logoUrl = getLogoUrl(settings?.logo_path ?? null)
  const storeName = settings?.store_name || 'Alfa Eletrônicos'
  const whatsapp = settings?.whatsapp_number || '5511999999999'

  useEffect(() => {
    getActiveCategories()
      .then((cats) => setCategories(cats.slice(0, 8)))
      .catch(() => {})
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/catalogo?busca=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setMenuOpen(false)
    }
  }

  const whatsappLink = whatsapp
    ? `https://wa.me/${normalizeWhatsAppNumber(whatsapp)}`
    : null

  return (
    <header className="sticky top-0 z-40 bg-[#111111] border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[68px] sm:h-[74px] gap-4 lg:gap-8">

          {/* ── Logo ──────────────────────────────────────────────── */}
          <Link to="/" className="flex-shrink-0" aria-label="Início">
            <img
              src={logoUrl || '/logo-alfa.png'}
              alt={storeName}
              className="h-9 sm:h-11 w-auto object-contain"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = '/logo-alfa.png'
              }}
            />
          </Link>

          {/* ── Desktop: busca centralizada ───────────────────────── */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-md lg:max-w-lg mx-auto items-center bg-white rounded-full px-4 py-2.5 gap-2.5 shadow-sm"
          >
            <Search size={16} className="text-[#242424] shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="flex-1 bg-transparent text-[#111111] text-sm outline-none placeholder-[#999999]"
            />
          </form>

          {/* ── Desktop: navegação ────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-6 shrink-0">
            <Link
              to="/"
              className="text-white/85 hover:text-white text-sm font-medium transition-colors"
            >
              Início
            </Link>

            {/* Dropdown de Categorias */}
            <div
              className="relative"
              onMouseEnter={() => setCatDropdownOpen(true)}
              onMouseLeave={() => setCatDropdownOpen(false)}
            >
              <Link
                to="/catalogo"
                className="flex items-center gap-1 text-white/85 hover:text-white text-sm font-medium transition-colors py-2"
              >
                Categorias <ChevronDown size={14} className="mt-0.5 opacity-80" />
              </Link>

              {catDropdownOpen && categories.length > 0 && (
                <div className="absolute left-0 top-full pt-1 w-56 z-50 animate-fade-in">
                  <div className="bg-[#181818] border border-white/10 rounded-xl shadow-modal py-2 overflow-hidden">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/catalogo?categoria=${cat.slug}`}
                        onClick={() => setCatDropdownOpen(false)}
                        className="block px-4 py-2 text-xs font-medium text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        {cat.name}
                      </Link>
                    ))}
                    <div className="border-t border-white/10 mt-1 pt-1">
                      <Link
                        to="/catalogo"
                        onClick={() => setCatDropdownOpen(false)}
                        className="block px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.06] transition-colors"
                      >
                        Ver todas →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/85 hover:text-white text-sm font-medium transition-colors"
              >
                Contato
              </a>
            ) : (
              <Link
                to="/catalogo"
                className="text-white/85 hover:text-white text-sm font-medium transition-colors"
              >
                Contato
              </Link>
            )}
          </nav>

          {/* ── Desktop: botão WhatsApp estilo referência ─────────── */}
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2.5 border border-white/35 bg-white/[0.04] hover:bg-white/[0.1] hover:border-white/60 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all duration-150 shrink-0 whitespace-nowrap"
            >
              <span className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                <MessageCircle size={12} className="text-white fill-white" />
              </span>
              Atendimento via WhatsApp
            </a>
          )}

          {/* ── Mobile: botão WhatsApp rápido + menu ──────────────── */}
          <div className="md:hidden flex items-center gap-2 ml-auto">
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Atendimento via WhatsApp"
                className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white"
              >
                <MessageCircle size={17} />
              </a>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-white/80 hover:text-white transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* ── Mobile: busca sempre visível ────────────────────────── */}
        <div className="md:hidden pb-3">
          <form
            onSubmit={handleSearch}
            className="flex items-center bg-white rounded-full px-4 py-2 gap-2"
          >
            <Search size={15} className="text-[#555555] shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="flex-1 bg-transparent text-[#111111] text-sm outline-none placeholder-[#888888]"
            />
          </form>
        </div>

        {/* ── Mobile: menu dropdown ───────────────────────────────── */}
        {menuOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-1 animate-slide-up border-t border-white/[0.1] pt-3">
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 text-white/85 hover:text-white hover:bg-white/[0.08] rounded-lg text-sm font-medium transition-colors"
            >
              Início
            </Link>
            <Link
              to="/catalogo"
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 text-white/85 hover:text-white hover:bg-white/[0.08] rounded-lg text-sm font-medium transition-colors"
            >
              Catálogo completo
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/catalogo?categoria=${cat.slug}`}
                onClick={() => setMenuOpen(false)}
                className="px-5 py-2 text-white/65 hover:text-white hover:bg-white/[0.06] rounded-lg text-xs font-medium transition-colors"
              >
                {cat.name}
              </Link>
            ))}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 text-[#25D366] hover:bg-white/[0.08] rounded-lg text-sm font-semibold transition-colors"
              >
                <MessageCircle size={16} />
                Atendimento via WhatsApp
              </a>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
