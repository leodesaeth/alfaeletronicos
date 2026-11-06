import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Boxes,
  DollarSign,
  Tag,
  Settings,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/auth'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, exact: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/estoque', label: 'Estoque & Alertas', icon: Boxes },
  { to: '/admin/financeiro', label: 'Financeiro & DRE', icon: DollarSign },
  { to: '/admin/categorias', label: 'Categorias', icon: Tag },
  { to: '/admin/configuracoes', label: 'Aparência e loja', icon: Settings },
]

interface AdminLayoutProps {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/admin/login')
    } catch {
      toast.error('Erro ao sair. Tente novamente.')
    } finally {
      setSigningOut(false)
    }
  }

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to
    return location.pathname.startsWith(to)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 flex items-center justify-center">
        <Link to="/admin" className="flex items-center justify-center w-full">
          <img
            src="/logo-alfa.png"
            alt="Alfa Eletrônicos"
            className="h-8 w-auto object-contain mx-auto"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              'group',
              isActive(item.to, item.exact)
                ? 'bg-brand text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            )}
          >
            <item.icon size={18} className="shrink-0" />
            <span className="flex-1">{item.label}</span>
            {isActive(item.to, item.exact) && (
              <ChevronRight size={14} className="opacity-60" />
            )}
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-white/10 flex flex-col gap-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ExternalLink size={18} />
          Ver catálogo
        </a>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-900/20 transition-colors w-full text-left"
        >
          <LogOut size={18} />
          {signingOut ? 'Saindo...' : 'Sair'}
        </button>

        {/* User info */}
        {user && (
          <div className="mt-3 px-3 py-2 bg-white/5 rounded-lg">
            <p className="text-xs text-white/40 truncate">{user.email}</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-graphite flex-col fixed top-0 bottom-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 w-64 bg-graphite flex flex-col lg:hidden',
          'transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <span className="font-bold text-white text-sm">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen pb-16 lg:pb-0">
        {/* Mobile topbar */}
        <header className="lg:hidden bg-[#111111] border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 -ml-1 text-white/80 hover:text-white rounded-lg"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <Link to="/admin" className="flex items-center gap-2">
              <img
                src="/logo-alfa.png"
                alt="Alfa Eletrônicos"
                className="h-6 w-auto object-contain"
              />
            </Link>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-[11px] font-semibold"
          >
            <ExternalLink size={12} /> Ver Loja
          </a>
        </header>

        {/* Page content */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (App-like quick switching on phone) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#EAEAEA] px-1 py-1.5 grid grid-cols-5 gap-0.5 shadow-lg">
          {[
            { to: '/admin', label: 'Início', icon: LayoutDashboard, exact: true },
            { to: '/admin/financeiro', label: 'Caixa/DRE', icon: DollarSign },
            { to: '/admin/estoque', label: 'Estoque', icon: Boxes },
            { to: '/admin/produtos', label: 'Produtos', icon: Package },
            { to: '/admin/categorias', label: 'Seções', icon: Tag },
          ].map((item) => {
            const active = isActive(item.to, item.exact)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-semibold transition-colors',
                  active
                    ? 'text-[#111111] bg-[#F4F4F4]'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                <item.icon size={16} className={cn('mb-0.5', active && 'text-[#111111]')} />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
