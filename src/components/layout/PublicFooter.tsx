import { useEffect, useState } from 'react'
import { MessageCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '@/hooks/useStore'
import { getLogoUrl } from '@/services/storeSettings'
import { normalizeWhatsAppNumber } from '@/lib/utils'
import { getActiveCategories } from '@/services/categories'
import type { Category } from '@/types'
import { QuoteBagWidget } from '@/components/catalog/QuoteBagWidget'

export function PublicFooter() {
  const { settings } = useStore()
  const [categories, setCategories] = useState<Category[]>([])

  const logoUrl = getLogoUrl(settings?.logo_path ?? null)
  const storeName = settings?.store_name || 'Alfa Eletrônicos'
  const whatsapp = settings?.whatsapp_number || '5511999999999'
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    getActiveCategories()
      .then((cats) => setCategories(cats.slice(0, 4)))
      .catch(() => {})
  }, [])

  const whatsappLink = whatsapp
    ? `https://wa.me/${normalizeWhatsAppNumber(whatsapp)}`
    : null

  return (
    <footer className="bg-[#111111] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6">

        {/* ── Grid principal estilo referência ────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 items-start">

          {/* Col 1 — Logo + tagline + ícones sociais (5 colunas) ──── */}
          <div className="md:col-span-5 flex flex-col sm:flex-row items-start gap-6">
            <Link to="/" className="shrink-0">
              <img
                src={logoUrl || '/logo-alfa.png'}
                alt={storeName}
                className="h-11 w-auto object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = '/logo-alfa.png'
                }}
              />
            </Link>

            <div className="flex flex-col gap-3.5">
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-[230px]">
                {settings?.store_description ||
                  'Tecnologia, estilo e conveniência para o seu dia a dia.'}
              </p>

              {/* Ícones sociais */}
              <div className="flex gap-2.5">
                {whatsappLink && (
                  <>
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                    >
                      <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                      </svg>
                    </a>
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="YouTube"
                      className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                    >
                      <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                      </svg>
                    </a>
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                    >
                      <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Col 2 — Categorias (2 colunas) ───────────────────────── */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-bold text-white mb-3">Categorias</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link to="/catalogo?categoria=celulares" className="text-xs text-white/70 hover:text-white transition-colors">
                  Celulares
                </Link>
              </li>
              <li>
                <Link to="/catalogo?categoria=capinhas-e-acessorios" className="text-xs text-white/70 hover:text-white transition-colors">
                  Acessórios
                </Link>
              </li>
              <li>
                <Link to="/catalogo?categoria=informatica" className="text-xs text-white/70 hover:text-white transition-colors">
                  Informática
                </Link>
              </li>
              <li>
                <Link to="/catalogo?categoria=perfumes" className="text-xs text-white/70 hover:text-white transition-colors">
                  Perfumes
                </Link>
              </li>
              {categories.length > 4 &&
                categories.slice(4).map((cat) => (
                  <li key={cat.id}>
                    <Link to={`/catalogo?categoria=${cat.slug}`} className="text-xs text-white/70 hover:text-white transition-colors">
                      {cat.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {/* Col 3 — Institucional (2 colunas) ────────────────────── */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-bold text-white mb-3">Institucional</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link to="/catalogo" className="text-xs text-white/70 hover:text-white transition-colors">
                  Sobre nós
                </Link>
              </li>
              <li>
                {whatsappLink ? (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-xs text-white/70 hover:text-white transition-colors">
                    Contato
                  </a>
                ) : (
                  <Link to="/catalogo" className="text-xs text-white/70 hover:text-white transition-colors">
                    Contato
                  </Link>
                )}
              </li>
              <li>
                <Link to="/catalogo" className="text-xs text-white/70 hover:text-white transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/catalogo" className="text-xs text-white/70 hover:text-white transition-colors">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4 — WhatsApp CTA (3 colunas) ─────────────────────── */}
          {whatsappLink && (
            <div className="md:col-span-3 flex items-center md:justify-end">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-full border-2 border-[#25D366] flex items-center justify-center shrink-0">
                  <MessageCircle size={19} className="text-[#25D366]" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white leading-tight">
                    Atendimento via WhatsApp
                  </p>
                  <p className="text-[11px] text-white/65 mt-0.5">
                    Fale conosco agora mesmo!
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center text-white/70 group-hover:border-white group-hover:text-white transition-colors shrink-0 ml-1">
                  <ArrowRight size={13} />
                </div>
              </a>
            </div>
          )}
        </div>

        {/* ── Linha divisória + copyright ─────────────────────────── */}
        <div className="border-t border-white/[0.1] pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-white/55">
            © {currentYear} {storeName}. Todos os direitos reservados.
          </p>
          <p className="text-[11px] text-white/55">
            Desenvolvido por{' '}
            <span className="text-white/80 font-semibold">NexaFlow</span>
          </p>
        </div>
      </div>
      <QuoteBagWidget />
    </footer>
  )
}
