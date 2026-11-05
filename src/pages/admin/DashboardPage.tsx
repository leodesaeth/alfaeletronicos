import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Tag,
  Eye,
  EyeOff,
  Plus,
  ExternalLink,
  AlertTriangle,
  ImageOff,
  DollarSign,
  Star,
  ArrowRight,
  Settings,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { getAllProducts } from '@/services/products'
import { getAllCategories } from '@/services/categories'
import { useStore } from '@/hooks/useStore'
import { Skeleton } from '@/components/ui/StateComponents'

interface Stats {
  total: number
  published: number
  hidden: number
  categories: number
  featured: number
  withoutImage: number
  withoutPrice: number
}

export function DashboardPage() {
  const { settings } = useStore()
  const [stats, setStats] = useState<Stats>({
    total: 0,
    published: 0,
    hidden: 0,
    categories: 0,
    featured: 0,
    withoutImage: 0,
    withoutPrice: 0,
  })
  const [loading, setLoading] = useState(true)

  const hasWhatsApp = !!settings?.whatsapp_number

  useEffect(() => {
    Promise.all([getAllProducts(), getAllCategories()])
      .then(([products, categories]) => {
        setStats({
          total: products.length,
          published: products.filter((p) => p.is_published).length,
          hidden: products.filter((p) => !p.is_published).length,
          categories: categories.length,
          featured: products.filter((p) => p.is_featured).length,
          withoutImage: products.filter((p) => !p.product_images || p.product_images.length === 0).length,
          withoutPrice: products.filter((p) => !p.price || p.price <= 0).length,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    {
      label: 'Total de produtos',
      value: stats.total,
      icon: Package,
      color: 'text-[#111111]',
      bg: 'bg-[#F2F2F2]',
      to: '/admin/produtos',
    },
    {
      label: 'Publicados na vitrine',
      value: stats.published,
      icon: Eye,
      color: 'text-[#166534]',
      bg: 'bg-[#F0FDF4]',
      to: '/admin/produtos?status=published',
    },
    {
      label: 'Em rascunho (ocultos)',
      value: stats.hidden,
      icon: EyeOff,
      color: 'text-[#92400E]',
      bg: 'bg-[#FFFBEB]',
      to: '/admin/produtos?status=hidden',
    },
    {
      label: 'Categorias ativas',
      value: stats.categories,
      icon: Tag,
      color: 'text-[#111111]',
      bg: 'bg-[#F2F2F2]',
      to: '/admin/categorias',
    },
  ]

  const pendingItems = [
    {
      show: stats.withoutImage > 0,
      icon: ImageOff,
      title: `${stats.withoutImage} produto(s) sem fotografia`,
      desc: 'Produtos com foto convertem muito mais no catálogo.',
      to: '/admin/produtos?pendencia=sem-foto',
      action: 'Revisar fotos',
    },
    {
      show: stats.withoutPrice > 0,
      icon: DollarSign,
      title: `${stats.withoutPrice} produto(s) sem preço definido`,
      desc: 'Itens sem valor aparecem como "Consulte o preço".',
      to: '/admin/produtos?pendencia=sem-preco',
      action: 'Definir preços',
    },
    {
      show: stats.featured === 0 && stats.total > 0,
      icon: Star,
      title: 'Nenhum produto marcado como destaque',
      desc: 'Destaque até 5 produtos para a vitrine principal.',
      to: '/admin/produtos',
      action: 'Escolher destaques',
    },
  ].filter((item) => item.show)

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
              Visão geral do catálogo
            </h1>
            <p className="text-sm text-[#767676] mt-0.5">
              Gerencie os produtos, categorias e atendimento da {settings?.store_name || 'Alfa Eletrônicos'}
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition-colors"
          >
            <ExternalLink size={14} />
            Abrir catálogo público
          </a>
        </div>

        {/* Alerta WhatsApp */}
        {!hasWhatsApp && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                WhatsApp comercial não configurado
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Configure o número de atendimento para ativar o botão verde de WhatsApp nos produtos.{' '}
                <Link to="/admin/configuracoes" className="underline font-semibold">
                  Configurar agora
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Indicadores principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#CCCCCC] shadow-card hover:shadow-card-hover p-5 flex flex-col gap-3 transition-all"
            >
              <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                <card.icon size={20} className={card.color} />
              </div>
              {loading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="text-2xl font-extrabold text-[#111111] tabular-nums">{card.value}</p>
              )}
              <p className="text-xs font-medium text-[#767676]">{card.label}</p>
            </Link>
          ))}
        </div>

        {/* Diagnóstico de pendências */}
        {!loading && pendingItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-5">
            <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider mb-3">
              Pontos de atenção no catálogo
            </h2>
            <div className="divide-y divide-[#F0F0F0]">
              {pendingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA] flex items-center justify-center shrink-0">
                      <item.icon size={16} className="text-[#242424]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">{item.title}</p>
                      <p className="text-xs text-[#767676]">{item.desc}</p>
                    </div>
                  </div>
                  <Link
                    to={item.to}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] hover:underline"
                  >
                    {item.action} <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações rápidas */}
        <div>
          <h2 className="text-xs font-bold text-[#767676] uppercase tracking-wider mb-3">
            Ações rápidas
          </h2>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Link to="/admin/produtos/novo">
              <div className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-5 flex items-center gap-4 hover:shadow-card-hover transition-all duration-200 group">
                <div className="w-11 h-11 bg-[#111111] text-white rounded-xl flex items-center justify-center shrink-0">
                  <Plus size={20} />
                </div>
                <div>
                  <p className="font-bold text-[#111111] text-sm">Cadastrar novo produto</p>
                  <p className="text-xs text-[#767676]">Adicionar item com foto e preço à vitrine</p>
                </div>
              </div>
            </Link>

            <Link to="/admin/produtos">
              <div className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-5 flex items-center gap-4 hover:shadow-card-hover transition-all duration-200 group">
                <div className="w-11 h-11 bg-[#F4F4F4] group-hover:bg-[#111111] text-[#111111] group-hover:text-white rounded-xl flex items-center justify-center shrink-0 transition-colors">
                  <Package size={20} />
                </div>
                <div>
                  <p className="font-bold text-[#111111] text-sm">Gerenciar produtos e importar CSV</p>
                  <p className="text-xs text-[#767676]">Edição rápida de preços, destaques e planilha</p>
                </div>
              </div>
            </Link>

            <Link to="/admin/categorias">
              <div className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-5 flex items-center gap-4 hover:shadow-card-hover transition-all duration-200 group">
                <div className="w-11 h-11 bg-[#F4F4F4] group-hover:bg-[#111111] text-[#111111] group-hover:text-white rounded-xl flex items-center justify-center shrink-0 transition-colors">
                  <Tag size={20} />
                </div>
                <div>
                  <p className="font-bold text-[#111111] text-sm">Organizar categorias</p>
                  <p className="text-xs text-[#767676]">Criar, ordenar ou enviar capas de categorias</p>
                </div>
              </div>
            </Link>

            <Link to="/admin/configuracoes">
              <div className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-5 flex items-center gap-4 hover:shadow-card-hover transition-all duration-200 group">
                <div className="w-11 h-11 bg-[#F4F4F4] group-hover:bg-[#111111] text-[#111111] group-hover:text-white rounded-xl flex items-center justify-center shrink-0 transition-colors">
                  <Settings size={20} />
                </div>
                <div>
                  <p className="font-bold text-[#111111] text-sm">Aparência e WhatsApp da loja</p>
                  <p className="text-xs text-[#767676]">Número de atendimento, textos do hero e rodapé</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
