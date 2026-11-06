import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  Plus,
  ExternalLink,
  AlertTriangle,
  DollarSign,
  ArrowRight,
  Settings,
  MessageCircle,
  TrendingUp,
  Wallet,
  Boxes,
  Share2,
  Copy,
  Check,
  BarChart3,
  PieChart,
  ShoppingBag,
  Target,
  Clock,
  Users,
  CreditCard,
  Grid,
  LineChart,
  QrCode,
  Printer,
  X,
  CheckCircle2,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { getAllProducts } from '@/services/products'
import { getAllCategories } from '@/services/categories'
import {
  getAllProductMeta,
  getStockMovements,
  getStoreExpenses,
  getCustomerReceivables,
  getExtraIncomes,
  getExtendedStoreConfig,
  type ProductMetaMap,
  type StockMovement,
  type StoreExpense,
  type CustomerReceivable,
  type ExtraIncome,
  type FinancialConfig,
  type PaymentMethod,
} from '@/services/catalogIntelligence'
import type { Product, Category } from '@/types'
import { useStore } from '@/hooks/useStore'
import { PageLoader } from '@/components/ui/StateComponents'
import { formatBRL, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type ChartViewMode = 'columns' | 'area' | 'donut' | 'matrix' | 'payments'

// Paleta editorial sóbria (Carbono, Grafite, Ardósia e Verde Alfa) — sem arco-íris artificial
const CHART_EDITORIAL_COLORS = [
  '#111111', // Carbon Black
  '#24A850', // Alfa Emerald
  '#3F3F46', // Zinc 700
  '#71717A', // Zinc 500
  '#166534', // Deep Forest
  '#A1A1AA', // Zinc 400
  '#52525B', // Zinc 600
  '#D4D4D8', // Zinc 300
]

export function DashboardPage() {
  const { settings } = useStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [metaMap, setMetaMap] = useState<ProductMetaMap>({})
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [expenses, setExpenses] = useState<StoreExpense[]>([])
  const [receivables, setReceivables] = useState<CustomerReceivable[]>([])
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([])
  const [finConfig, setFinConfig] = useState<FinancialConfig>({
    monthly_revenue_goal: 25000,
    credit_card_fee_pct: 4.5,
    debit_card_fee_pct: 1.5,
    pix_fee_pct: 0,
  })
  const [loading, setLoading] = useState(true)
  const [copiedCatalogUrl, setCopiedCatalogUrl] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)

  const [chartMode, setChartMode] = useState<ChartViewMode>(() => {
    const saved = localStorage.getItem('alfa_dashboard_chart_mode') as ChartViewMode | null
    return saved || 'columns'
  })
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  function handleSelectChartMode(mode: ChartViewMode) {
    setChartMode(mode)
    setHoveredIndex(null)
    try {
      localStorage.setItem('alfa_dashboard_chart_mode', mode)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    Promise.all([
      getAllProducts(),
      getAllCategories(),
      getAllProductMeta(),
      getStockMovements(),
      getStoreExpenses(),
      getCustomerReceivables(),
      getExtraIncomes(),
      getExtendedStoreConfig(),
    ])
      .then(([prods, cats, meta, movs, exps, recs, incs, extCfg]) => {
        setProducts(prods)
        setCategories(cats)
        setMetaMap(meta)
        setMovements(movs)
        setExpenses(exps)
        setReceivables(recs)
        setExtraIncomes(incs)
        if (extCfg.financial_config) {
          setFinConfig(extCfg.financial_config)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const dashboardData = useMemo(() => {
    const now = new Date()
    const isCurrentMonth = (iso: string) => {
      const d = new Date(iso)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }

    let totalUnitsInStock = 0
    let totalCostInvested = 0
    let totalSalePotential = 0
    let lowStockCount = 0
    let zeroStockCount = 0
    let totalClicks = 0

    const enrichedProducts: Array<{
      product: Product
      clicks: number
      sold: number
      stock: number
      lowThreshold: number
      cost: number
      price: number
      marginPct: number
      stockSaleValue: number
      stockCostValue: number
      stockProfitValue: number
      imageUrl: string | null
    }> = []

    for (const p of products) {
      const m = metaMap[p.id] || {}
      const stock = typeof m.stock_quantity === 'number' ? m.stock_quantity : (p.availability === 'unavailable' ? 0 : 0)
      const lowThreshold = m.low_stock_threshold ?? 2
      const price = p.price || 0
      const cost = m.cost_price && m.cost_price > 0 ? m.cost_price : Math.round(price * 0.65)
      const clicks = m.whatsapp_clicks || 0
      const sold = m.total_units_sold || 0

      totalUnitsInStock += stock
      totalCostInvested += stock * cost
      totalSalePotential += stock * price
      totalClicks += clicks

      if (stock <= 0) zeroStockCount++
      else if (stock <= lowThreshold) lowStockCount++

      const marginPct = price > 0 ? Math.round(((price - cost) / price) * 100) : 0
      const primaryImg =
        p.product_images?.find((i) => i.is_primary)?.public_url ||
        p.product_images?.[0]?.public_url ||
        null

      enrichedProducts.push({
        product: p,
        clicks,
        sold,
        stock,
        lowThreshold,
        cost,
        price,
        marginPct,
        stockSaleValue: stock * price,
        stockCostValue: stock * cost,
        stockProfitValue: Math.max(0, stock * (price - cost)),
        imageUrl: primaryImg,
      })
    }

    const projectedStockProfit = Math.max(0, totalSalePotential - totalCostInvested)

    const monthSales = movements.filter(
      (m) => m.type === 'out' && (m.reason === 'sale' || !m.reason) && isCurrentMonth(m.created_at)
    )
    const monthExtra = extraIncomes.filter((inc) => isCurrentMonth(inc.created_at))
    const monthExpensesPaid = expenses
      .filter((e) => e.status !== 'pending' && isCurrentMonth(e.due_date || e.date || e.created_at))
      .reduce((acc, e) => acc + e.amount, 0)

    const monthProductRev = monthSales.reduce(
      (acc, m) => acc + (m.total_value ?? (m.unit_price || 0) * m.quantity),
      0
    )
    const monthExtraRev = monthExtra.reduce((acc, i) => acc + i.amount, 0)
    const monthGrossRevenue = monthProductRev + monthExtraRev

    const monthProductProfit = monthSales.reduce((acc, m) => acc + (m.profit_value || 0), 0)
    const monthExtraProfit = monthExtra.reduce(
      (acc, i) => acc + (i.amount - (i.cost_amount || 0)),
      0
    )
    const monthNetProfit = monthProductProfit + monthExtraProfit - monthExpensesPaid

    const goal = finConfig.monthly_revenue_goal || 25000
    const goalPct = Math.min(100, Math.round((monthGrossRevenue / goal) * 100))

    const catMap = new Map<
      string,
      {
        id: string
        name: string
        productCount: number
        stockUnits: number
        costValue: number
        saleValue: number
        profitValue: number
        clicks: number
      }
    >()

    for (const c of categories) {
      catMap.set(c.id, {
        id: c.id,
        name: c.name,
        productCount: 0,
        stockUnits: 0,
        costValue: 0,
        saleValue: 0,
        profitValue: 0,
        clicks: 0,
      })
    }

    for (const item of enrichedProducts) {
      const catId = item.product.category_id || 'sem-cat'
      const existing = catMap.get(catId) || {
        id: catId,
        name: item.product.categories?.name || 'Outros',
        productCount: 0,
        stockUnits: 0,
        costValue: 0,
        saleValue: 0,
        profitValue: 0,
        clicks: 0,
      }
      existing.productCount += 1
      existing.stockUnits += item.stock
      existing.costValue += item.stockCostValue
      existing.saleValue += item.stockSaleValue
      existing.profitValue += item.stockProfitValue
      existing.clicks += item.clicks
      catMap.set(catId, existing)
    }

    const categoryBreakdown = Array.from(catMap.values())
      .filter((c) => c.saleValue > 0 || c.productCount > 0)
      .sort((a, b) => b.saleValue - a.saleValue)

    const maxCatSaleValue = Math.max(1, ...categoryBreakdown.map((c) => c.saleValue))

    const last7Days: Array<{
      label: string
      dateStr: string
      revenue: number
      profit: number
    }> = []

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const isoDay = d.toISOString().slice(0, 10)
      const label = `${dayNames[d.getDay()]} (${String(d.getDate()).padStart(2, '0')}/${String(
        d.getMonth() + 1
      ).padStart(2, '0')})`

      const daySales = movements.filter(
        (m) =>
          m.type === 'out' &&
          (m.reason === 'sale' || !m.reason) &&
          m.created_at.slice(0, 10) === isoDay
      )
      const dayExtra = extraIncomes.filter((inc) => inc.created_at.slice(0, 10) === isoDay)

      const rev =
        daySales.reduce(
          (acc, m) => acc + (m.total_value ?? (m.unit_price || 0) * m.quantity),
          0
        ) + dayExtra.reduce((acc, inc) => acc + inc.amount, 0)

      const prof =
        daySales.reduce((acc, m) => acc + (m.profit_value || 0), 0) +
        dayExtra.reduce((acc, inc) => acc + (inc.amount - (inc.cost_amount || 0)), 0)

      last7Days.push({
        label,
        dateStr: isoDay,
        revenue: rev,
        profit: prof,
      })
    }

    const hasRealDailySales = last7Days.some((d) => d.revenue > 0)

    const paymentStats: Record<
      PaymentMethod,
      { label: string; gross: number; net: number; count: number }
    > = {
      pix: { label: 'PIX Instantâneo', gross: 0, net: 0, count: 0 },
      credit_card: { label: 'Cartão de Crédito', gross: 0, net: 0, count: 0 },
      debit_card: { label: 'Cartão de Débito', gross: 0, net: 0, count: 0 },
      cash: { label: 'Dinheiro Físico', gross: 0, net: 0, count: 0 },
      other: { label: 'Outros', gross: 0, net: 0, count: 0 },
    }

    const allSales = movements.filter((m) => m.type === 'out' && (m.reason === 'sale' || !m.reason))
    for (const s of allSales) {
      const pm = s.payment_method || 'pix'
      const rev = s.total_value ?? (s.unit_price || 0) * s.quantity
      const feeRate =
        pm === 'credit_card'
          ? finConfig.credit_card_fee_pct / 100
          : pm === 'debit_card'
          ? finConfig.debit_card_fee_pct / 100
          : pm === 'pix'
          ? finConfig.pix_fee_pct / 100
          : 0
      paymentStats[pm].gross += rev
      paymentStats[pm].net += rev * (1 - feeRate)
      paymentStats[pm].count += 1
    }
    for (const inc of extraIncomes) {
      const pm = inc.payment_method || 'pix'
      const feeRate =
        pm === 'credit_card'
          ? finConfig.credit_card_fee_pct / 100
          : pm === 'debit_card'
          ? finConfig.debit_card_fee_pct / 100
          : pm === 'pix'
          ? finConfig.pix_fee_pct / 100
          : 0
      paymentStats[pm].gross += inc.amount
      paymentStats[pm].net += inc.amount * (1 - feeRate)
      paymentStats[pm].count += 1
    }

    const champions = enrichedProducts.filter((p) => p.marginPct >= 35 && p.clicks + p.sold >= 2)
    const trafficGenerators = enrichedProducts.filter(
      (p) => p.marginPct < 35 && p.clicks + p.sold >= 2
    )
    const luxuryGems = enrichedProducts.filter((p) => p.marginPct >= 35 && p.clicks + p.sold < 2)
    const slowMovers = enrichedProducts.filter((p) => p.marginPct < 35 && p.clicks + p.sold < 2)

    const totalProds = Math.max(1, products.length)
    const withImageCount = products.filter(
      (p) => p.product_images && p.product_images.length > 0
    ).length
    const withPriceCount = products.filter((p) => p.price && p.price > 0).length
    const publishedCount = products.filter((p) => p.is_published).length
    const featuredCount = products.filter((p) => p.is_featured).length
    const healthyStockCount = products.length - zeroStockCount

    const healthScore = Math.round(
      (withImageCount / totalProds) * 30 +
        (withPriceCount / totalProds) * 25 +
        (publishedCount / totalProds) * 20 +
        (healthyStockCount / totalProds) * 25
    )

    const pendingPayables = expenses
      .filter((e) => e.status === 'pending')
      .reduce((acc, e) => acc + e.amount, 0)
    const pendingReceivables = receivables
      .filter((r) => r.status === 'pending')
      .reduce((acc, r) => acc + r.amount, 0)

    return {
      totalUnitsInStock,
      totalCostInvested,
      totalSalePotential,
      projectedStockProfit,
      lowStockCount,
      zeroStockCount,
      totalClicks,
      enrichedProducts,
      monthGrossRevenue,
      monthNetProfit,
      goal,
      goalPct,
      categoryBreakdown,
      maxCatSaleValue,
      last7Days,
      hasRealDailySales,
      paymentStats,
      champions,
      trafficGenerators,
      luxuryGems,
      slowMovers,
      healthScore,
      withImageCount,
      withPriceCount,
      publishedCount,
      featuredCount,
      pendingPayables,
      pendingReceivables,
      totalSalesCount: allSales.length,
    }
  }, [products, categories, metaMap, movements, expenses, receivables, extraIncomes, finConfig])

  function handleCopyCatalogLink() {
    const url = window.location.origin
    navigator.clipboard.writeText(url)
    setCopiedCatalogUrl(true)
    toast.success('Link do catálogo copiado!')
    setTimeout(() => setCopiedCatalogUrl(false), 2500)
  }

  function handleShareCatalogWhatsApp() {
    const url = window.location.origin
    const text = `Confira o Catálogo Digital atualizado da *${settings?.store_name || 'Alfa Eletrônicos'}* com nossos produtos e ofertas a pronta entrega:\n\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  if (loading) {
    return (
      <AdminLayout>
        <PageLoader />
      </AdminLayout>
    )
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Cálculo do Donut Chart (Modelo 3)
  const donutRadius = 70
  const donutCircumference = 2 * Math.PI * donutRadius
  let accumulatedPct = 0
  const donutSegments = dashboardData.categoryBreakdown.map((cat, idx) => {
    const pct =
      dashboardData.totalSalePotential > 0
        ? cat.saleValue / dashboardData.totalSalePotential
        : 0
    const strokeDasharray = `${pct * donutCircumference} ${donutCircumference}`
    const strokeDashoffset = -accumulatedPct * donutCircumference
    accumulatedPct += pct
    return {
      ...cat,
      pct: Math.round(pct * 100),
      color: CHART_EDITORIAL_COLORS[idx % CHART_EDITORIAL_COLORS.length],
      strokeDasharray,
      strokeDashoffset,
    }
  })

  // Cálculo do Gráfico de Área Suave SVG (Modelo 2)
  const areaPoints = dashboardData.hasRealDailySales
    ? dashboardData.last7Days.map((d) => ({
        label: d.label,
        primaryVal: d.revenue,
        secondaryVal: d.profit,
      }))
    : dashboardData.enrichedProducts.slice(0, 7).map((item) => ({
        label: item.product.name.split(' ').slice(0, 2).join(' '),
        primaryVal: item.stockSaleValue,
        secondaryVal: item.stockProfitValue,
      }))

  const maxAreaVal = Math.max(100, ...areaPoints.map((p) => p.primaryVal))
  const svgW = 640
  const svgH = 220
  const padX = 36
  const padY = 24
  const plotW = svgW - padX * 2
  const plotH = svgH - padY * 2

  const primaryCoords = areaPoints.map((pt, idx) => {
    const x =
      padX + (areaPoints.length > 1 ? (idx / (areaPoints.length - 1)) * plotW : plotW / 2)
    const y = padY + plotH - (pt.primaryVal / maxAreaVal) * plotH
    return { x, y, ...pt }
  })

  const secondaryCoords = areaPoints.map((pt, idx) => {
    const x =
      padX + (areaPoints.length > 1 ? (idx / (areaPoints.length - 1)) * plotW : plotW / 2)
    const y = padY + plotH - (pt.secondaryVal / maxAreaVal) * plotH
    return { x, y }
  })

  const buildSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i]
      const next = pts[i + 1]
      const ctrlX = (curr.x + next.x) / 2
      d += ` C ${ctrlX} ${curr.y}, ${ctrlX} ${next.y}, ${next.x} ${next.y}`
    }
    return d
  }

  const primaryLinePath = buildSmoothPath(primaryCoords)
  const secondaryLinePath = buildSmoothPath(secondaryCoords)
  const primaryAreaPath =
    primaryCoords.length > 1
      ? `${primaryLinePath} L ${primaryCoords[primaryCoords.length - 1].x} ${
          padY + plotH
        } L ${primaryCoords[0].x} ${padY + plotH} Z`
      : ''

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* ── 1. HEADER EXECUTIVO SÓBRIO (OTIMIZADO PARA MOBILE E DESKTOP) ── */}
        <div className="bg-[#111111] rounded-2xl p-4 sm:p-6 text-white border border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#24A850]" />
                  Sistema Online
                </span>
                <span className="text-[11px] sm:text-xs text-white/50">
                  {new Date().toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
                {greeting}, {settings?.store_name || 'Alfa Eletrônicos'}
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-0.5">
                Resumo operacional de estoque, faturamento e atendimento.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQrModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
              >
                <QrCode size={14} /> QR Code
              </button>

              <button
                type="button"
                onClick={handleCopyCatalogLink}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
              >
                {copiedCatalogUrl ? <Check size={14} className="text-[#24A850]" /> : <Copy size={14} />}
                {copiedCatalogUrl ? 'Copiado' : 'Copiar Link'}
              </button>

              <button
                type="button"
                onClick={handleShareCatalogWhatsApp}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#24A850] hover:bg-[#1E8E42] text-xs font-semibold text-white transition-colors"
              >
                <Share2 size={14} /> WhatsApp
              </button>

              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white text-[#111111] hover:bg-gray-100 text-xs font-semibold transition-colors"
              >
                <ExternalLink size={14} /> Ver Loja
              </a>
            </div>
          </div>

          {/* Barra de Meta Mensal */}
          <div className="mt-4 sm:mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
                <Target size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <span className="text-white/70 font-medium truncate">
                    Meta Mensal ({dashboardData.goalPct}%)
                  </span>
                  <span className="font-bold text-white tabular-nums shrink-0 text-[11px] sm:text-xs">
                    {formatBRL(dashboardData.monthGrossRevenue)} / {formatBRL(dashboardData.goal)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#24A850] rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData.goalPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <Link
                to="/admin/financeiro"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                <DollarSign size={14} /> Abrir Caixa
              </Link>
              <Link
                to="/admin/produtos/novo"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                <Plus size={14} /> Novo Produto
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2. 6 INDICADORES EXECUTIVOS (GRADE 2x3 COMPACTA NO MOBILE) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
          <Link
            to="/admin/financeiro"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#CCCCCC] p-3.5 sm:p-4 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
                <DollarSign size={15} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#767676]">
                Mês
              </span>
            </div>
            <p className="text-base sm:text-lg font-extrabold text-[#111111] tabular-nums truncate">
              {formatBRL(dashboardData.monthGrossRevenue)}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#767676] mt-0.5 truncate">
              Faturamento Bruto
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#166534] font-semibold mt-1 tabular-nums truncate">
              Líq: {formatBRL(dashboardData.monthNetProfit)}
            </p>
          </Link>

          <Link
            to="/admin/estoque"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#CCCCCC] p-3.5 sm:p-4 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
                <Wallet size={15} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#767676]">
                Estoque
              </span>
            </div>
            <p className="text-base sm:text-lg font-extrabold text-[#111111] tabular-nums truncate">
              {formatBRL(dashboardData.totalSalePotential)}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#767676] mt-0.5 truncate">
              Valor de Venda
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#767676] mt-1 tabular-nums truncate">
              Custo: {formatBRL(dashboardData.totalCostInvested)}
            </p>
          </Link>

          <Link
            to="/admin/estoque"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#CCCCCC] p-3.5 sm:p-4 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F0FDF4] text-[#166534] flex items-center justify-center">
                <TrendingUp size={15} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#166534]">
                Margem
              </span>
            </div>
            <p className="text-base sm:text-lg font-extrabold text-[#166534] tabular-nums truncate">
              +{formatBRL(dashboardData.projectedStockProfit)}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#767676] mt-0.5 truncate">
              Lucro Projetado
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#767676] mt-1 truncate">
              {dashboardData.totalUnitsInStock} un. físicas
            </p>
          </Link>

          <Link
            to="/admin/produtos"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#CCCCCC] p-3.5 sm:p-4 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
                <MessageCircle size={15} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#767676]">
                Demanda
              </span>
            </div>
            <p className="text-base sm:text-lg font-extrabold text-[#111111] tabular-nums">
              {dashboardData.totalClicks}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#767676] mt-0.5 truncate">
              Cliques WhatsApp
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#767676] mt-1 truncate">
              {dashboardData.totalSalesCount} venda(s)
            </p>
          </Link>

          <Link
            to="/admin/produtos"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#CCCCCC] p-3.5 sm:p-4 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
                <Package size={15} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#767676]">
                Vitrine
              </span>
            </div>
            <p className="text-base sm:text-lg font-extrabold text-[#111111] tabular-nums">
              {dashboardData.publishedCount}{' '}
              <span className="text-xs font-normal text-[#767676]">/ {products.length}</span>
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#767676] mt-0.5 truncate">
              Itens Publicados
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#767676] mt-1 truncate">
              {dashboardData.featuredCount} em destaque
            </p>
          </Link>

          <Link
            to="/admin/estoque"
            className={cn(
              'rounded-2xl border p-3.5 sm:p-4 transition-all',
              dashboardData.lowStockCount + dashboardData.zeroStockCount > 0
                ? 'bg-[#FFFBEB]/60 border-[#FDE68A] hover:border-[#F59E0B]'
                : 'bg-white border-[#EAEAEA] hover:border-[#CCCCCC]'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#FFFBEB] text-[#92400E] flex items-center justify-center">
                <AlertTriangle size={15} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#92400E]">
                Atenção
              </span>
            </div>
            <p className="text-base sm:text-lg font-extrabold text-[#111111] tabular-nums">
              {dashboardData.lowStockCount + dashboardData.zeroStockCount}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#767676] mt-0.5 truncate">
              Alertas Estoque
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#92400E] font-medium mt-1 truncate">
              {dashboardData.zeroStockCount} zerado · {dashboardData.lowStockCount} baixo
            </p>
          </Link>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            3. PAINEL DE ANÁLISE GRÁFICA (RESPONSIVO MOBILE-FIRST + DESKTOP)
           ══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 sm:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-[#F0F0F0]">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#111111]">
                Análise Financeira e de Estoque
              </h2>
              <p className="text-xs text-[#767676] mt-0.5">
                Toque nos modos abaixo para alternar a visualização.
              </p>
            </div>

            {/* Seletor de Gráficos Deslizante no Mobile */}
            <div className="flex items-center gap-1 bg-[#F4F4F4] p-1 rounded-xl overflow-x-auto max-w-full">
              {(
                [
                  { id: 'columns', label: 'Colunas', icon: BarChart3 },
                  { id: 'area', label: 'Curva', icon: LineChart },
                  { id: 'donut', label: 'Distribuição', icon: PieChart },
                  { id: 'matrix', label: 'Quadrantes', icon: Grid },
                  { id: 'payments', label: 'Pagamentos', icon: CreditCard },
                ] as { id: ChartViewMode; label: string; icon: typeof BarChart3 }[]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectChartMode(option.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
                    chartMode === option.id
                      ? 'bg-[#111111] text-white shadow-2xs'
                      : 'text-[#555555] hover:text-[#111111]'
                  )}
                >
                  <option.icon size={13} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* MODELO 1: COLUNAS (BARRAS HORIZONTAIS NO MOBILE / COLUNAS VERTICAIS NO DESKTOP) */}
          {chartMode === 'columns' && (
            <div className="pt-4 sm:pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#111111]">
                    Custo Investido vs. Valor de Venda vs. Lucro Projetado
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#767676]">
                    Comparativo financeiro entre as categorias ativas do catálogo.
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-medium text-[#555555]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#D4D4D8] inline-block" /> Custo
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#111111] inline-block" /> Venda
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#24A850] inline-block" /> Lucro
                  </span>
                </div>
              </div>

              {/* VISÃO MOBILE (< 768px): Barras Horizontais Executivas — Zero Sobreposição */}
              <div className="md:hidden space-y-2.5 pt-1">
                {dashboardData.categoryBreakdown.map((cat) => {
                  const salePct = Math.max(
                    8,
                    Math.round((cat.saleValue / dashboardData.maxCatSaleValue) * 100)
                  )
                  const costPct = Math.max(
                    5,
                    Math.round((cat.costValue / dashboardData.maxCatSaleValue) * 100)
                  )
                  const profitPct = Math.max(
                    5,
                    Math.round((cat.profitValue / dashboardData.maxCatSaleValue) * 100)
                  )

                  return (
                    <div
                      key={cat.id}
                      className="p-3 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111111] truncate">{cat.name}</p>
                          <p className="text-[10px] text-[#767676]">
                            {cat.productCount} prod. · {cat.stockUnits} un. em estoque
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-[#111111] tabular-nums">
                            {formatBRL(cat.saleValue)}
                          </p>
                          <p className="text-[10px] font-bold text-[#166534] tabular-nums">
                            Lucro: +{formatBRL(cat.profitValue)}
                          </p>
                        </div>
                      </div>

                      {/* 3 Barras Horizontais Proporcionais (Venda, Custo e Lucro) */}
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-[#ECECEA] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#111111] rounded-full"
                            style={{ width: `${salePct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-[#ECECEA] rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-[#D4D4D8]"
                              style={{ width: `${costPct}%` }}
                            />
                            <div
                              className="h-full bg-[#24A850]"
                              style={{ width: `${profitPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#767676] tabular-nums shrink-0">
                            Custo: {formatBRL(cat.costValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* VISÃO DESKTOP (>= 768px): Colunas Verticais com Eixo Y Isolado */}
              <div className="hidden md:block pt-6 pb-2">
                <div className="flex items-stretch gap-3">
                  {/* Coluna Eixo Y */}
                  <div className="w-20 shrink-0 h-56 flex flex-col justify-between text-right pr-2 pb-6">
                    {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] text-[#999999] tabular-nums leading-none"
                      >
                        {formatBRL(Math.round(dashboardData.maxCatSaleValue * ratio))}
                      </span>
                    ))}
                  </div>

                  {/* Área de Plotagem das Colunas */}
                  <div className="flex-1 relative">
                    {/* Linhas de Grade Horizontais */}
                    <div className="absolute inset-x-0 top-0 h-50 flex flex-col justify-between pointer-events-none">
                      {[1, 0.75, 0.5, 0.25, 0].map((_, idx) => (
                        <div
                          key={idx}
                          className="w-full border-t border-dashed border-[#EEEEEE]"
                        />
                      ))}
                    </div>

                    {/* Colunas + Rótulos Integrados */}
                    <div
                      className="relative z-10 grid gap-3 items-end"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(
                          1,
                          dashboardData.categoryBreakdown.length
                        )}, minmax(0, 1fr))`,
                      }}
                    >
                      {dashboardData.categoryBreakdown.map((cat, idx) => {
                        const costH = Math.max(
                          6,
                          Math.round((cat.costValue / dashboardData.maxCatSaleValue) * 100)
                        )
                        const saleH = Math.max(
                          10,
                          Math.round((cat.saleValue / dashboardData.maxCatSaleValue) * 100)
                        )
                        const profitH = Math.max(
                          6,
                          Math.round((cat.profitValue / dashboardData.maxCatSaleValue) * 100)
                        )
                        const isHovered = hoveredIndex === idx

                        return (
                          <div
                            key={cat.id}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            className="relative flex flex-col items-center group cursor-pointer"
                          >
                            {isHovered && (
                              <div className="absolute -top-18 z-30 bg-[#111111] text-white text-[11px] rounded-xl px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none">
                                <p className="font-bold text-white">{cat.name}</p>
                                <p className="text-white/80">Venda: {formatBRL(cat.saleValue)}</p>
                                <p className="text-white/80">Custo: {formatBRL(cat.costValue)}</p>
                                <p className="font-semibold text-[#24A850]">
                                  Lucro: +{formatBRL(cat.profitValue)}
                                </p>
                              </div>
                            )}

                            <div className="flex items-end justify-center gap-1.5 w-full h-50 px-1 border-b border-[#EAEAEA]">
                              <div
                                className="w-3 bg-[#D4D4D8] rounded-t-xs transition-all duration-300"
                                style={{ height: `${costH}%` }}
                              />
                              <div
                                className="w-3 bg-[#111111] rounded-t-xs transition-all duration-300"
                                style={{ height: `${saleH}%` }}
                              />
                              <div
                                className="w-3 bg-[#24A850] rounded-t-xs transition-all duration-300"
                                style={{ height: `${profitH}%` }}
                              />
                            </div>

                            <div className="w-full text-center pt-2.5 px-0.5">
                              <p
                                className="text-[11px] font-semibold text-[#111111] truncate"
                                title={cat.name}
                              >
                                {cat.name}
                              </p>
                              <p className="text-[10px] font-semibold text-[#166534] tabular-nums">
                                +{formatBRL(cat.profitValue)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODELO 2: GRÁFICO DE ÁREA COM CURVA SUAVE (OTIMIZADO MOBILE & DESKTOP) */}
          {chartMode === 'area' && (
            <div className="pt-4 sm:pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#111111]">
                    {dashboardData.hasRealDailySales
                      ? 'Evolução Diária (Últimos 7 Dias: Receita vs. Lucro)'
                      : 'Curva de Receita e Lucro Projetado por Produto'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#767676]">
                    Comparativo entre o valor bruto de venda e a margem líquida.
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[11px] sm:text-xs font-medium text-[#555555]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#111111] inline-block" /> Receita Bruta
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#24A850] inline-block" /> Lucro Líquido
                  </span>
                </div>
              </div>

              {/* Curva SVG Responsiva (Toque ou Mouse) */}
              <div className="w-full bg-[#FAFAF8] sm:bg-transparent rounded-xl p-2 sm:p-0 border border-[#EAEAEA] sm:border-0">
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-44 sm:h-64 overflow-visible">
                  <defs>
                    <linearGradient id="alfaCarbonGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#111111" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#111111" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                    const y = padY + plotH * r
                    const val = Math.round(maxAreaVal * (1 - r))
                    return (
                      <g key={i}>
                        <line
                          x1={padX}
                          y1={y}
                          x2={svgW - padX}
                          y2={y}
                          stroke="#E5E5E5"
                          strokeDasharray="4 4"
                        />
                        <text x={2} y={y + 3} className="fill-[#767676] text-[10px]">
                          {formatBRL(val)}
                        </text>
                      </g>
                    )
                  })}

                  {primaryAreaPath && <path d={primaryAreaPath} fill="url(#alfaCarbonGrad)" />}

                  {secondaryLinePath && (
                    <path
                      d={secondaryLinePath}
                      fill="none"
                      stroke="#24A850"
                      strokeWidth="2.5"
                      strokeDasharray="5 5"
                    />
                  )}

                  {primaryLinePath && (
                    <path
                      d={primaryLinePath}
                      fill="none"
                      stroke="#111111"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  )}

                  {primaryCoords.map((pt, idx) => (
                    <g
                      key={idx}
                      onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredIndex === idx ? 7 : 5}
                        fill="#FFFFFF"
                        stroke="#111111"
                        strokeWidth="2.5"
                      />
                      <text
                        x={pt.x}
                        y={svgH - 4}
                        textAnchor="middle"
                        className="fill-[#555555] text-[9px] sm:text-[10px] font-medium hidden sm:block"
                      >
                        {pt.label}
                      </text>
                      {hoveredIndex === idx && (
                        <g>
                          <rect
                            x={Math.min(svgW - 155, Math.max(10, pt.x - 70))}
                            y={Math.max(4, pt.y - 54)}
                            width="140"
                            height="44"
                            rx="8"
                            fill="#111111"
                          />
                          <text
                            x={Math.min(svgW - 85, Math.max(80, pt.x))}
                            y={Math.max(20, pt.y - 36)}
                            textAnchor="middle"
                            className="fill-white text-[10px] font-bold"
                          >
                            Venda: {formatBRL(pt.primaryVal)}
                          </text>
                          <text
                            x={Math.min(svgW - 85, Math.max(80, pt.x))}
                            y={Math.max(36, pt.y - 20)}
                            textAnchor="middle"
                            className="fill-[#24A850] text-[10px] font-semibold"
                          >
                            Lucro: +{formatBRL(pt.secondaryVal)}
                          </text>
                        </g>
                      )}
                    </g>
                  ))}
                </svg>
              </div>

              {/* Lista Resumo de Pontos no Mobile (Para leitura perfeita sem cortar textos do eixo X) */}
              <div className="sm:hidden space-y-2">
                {areaPoints.map((pt, idx) => (
                  <div
                    key={idx}
                    onClick={() => setHoveredIndex(idx)}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors',
                      hoveredIndex === idx
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-[#FAFAF8] text-[#111111] border-[#EAEAEA]'
                    )}
                  >
                    <span className="font-semibold truncate pr-2">
                      {idx + 1}. {pt.label}
                    </span>
                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <span>{formatBRL(pt.primaryVal)}</span>
                      <span
                        className={cn(
                          'font-bold',
                          hoveredIndex === idx ? 'text-[#24A850]' : 'text-[#166534]'
                        )}
                      >
                        +{formatBRL(pt.secondaryVal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODELO 3: GRÁFICO DE ROSCA EDITORIAL (COM TOQUE NO MOBILE) */}
          {chartMode === 'donut' && (
            <div className="pt-4 sm:pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                  <svg className="w-48 h-48 sm:w-56 sm:h-56 -rotate-90" viewBox="0 0 180 180">
                    <circle
                      cx="90"
                      cy="90"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#F4F4F4"
                      strokeWidth="22"
                    />
                    {donutSegments.map((seg, idx) => (
                      <circle
                        key={seg.id}
                        cx="90"
                        cy="90"
                        r={donutRadius}
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth={hoveredIndex === idx ? '26' : '22'}
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                        onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="transition-all duration-300 cursor-pointer"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#767676] truncate max-w-[110px]">
                      {hoveredIndex !== null && donutSegments[hoveredIndex]
                        ? donutSegments[hoveredIndex].name
                        : 'Total em Estoque'}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-[#111111] tabular-nums mt-0.5">
                      {hoveredIndex !== null && donutSegments[hoveredIndex]
                        ? formatBRL(donutSegments[hoveredIndex].saleValue)
                        : formatBRL(dashboardData.totalSalePotential)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#166534]">
                      {hoveredIndex !== null && donutSegments[hoveredIndex]
                        ? `${donutSegments[hoveredIndex].pct}% do catálogo`
                        : `${dashboardData.totalUnitsInStock} unidades`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {donutSegments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={cn(
                      'p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between',
                      hoveredIndex === idx
                        ? 'border-[#111111] bg-[#FAFAF8]'
                        : 'border-[#EAEAEA] bg-white hover:border-[#CCCCCC]'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-2.5 h-9 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#111111] truncate">{seg.name}</p>
                        <p className="text-[11px] text-[#767676]">
                          {seg.productCount} prod. · {seg.stockUnits} un.
                        </p>
                        <p className="text-[11px] font-semibold text-[#166534] tabular-nums">
                          Lucro: +{formatBRL(seg.profitValue)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#F4F4F4] text-[#111111] tabular-nums">
                        {seg.pct}%
                      </span>
                      <p className="text-xs font-bold text-[#111111] tabular-nums mt-1">
                        {formatBRL(seg.saleValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODELO 4: MATRIZ 4 QUADRANTES SÓBRIA */}
          {chartMode === 'matrix' && (
            <div className="pt-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#111111]">
                  Matriz de Desempenho (Giro de Interesse vs. Margem Bruta)
                </h3>
                <p className="text-xs text-[#767676]">
                  Classificação técnica do catálogo em 4 quadrantes operacionais.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: '1. Alta Margem & Alto Giro',
                    subtitle: 'Produtos líderes de rentabilidade e procura. Prioridade de reposição.',
                    items: dashboardData.champions,
                    badgeClass: 'bg-[#F0FDF4] text-[#166534]',
                  },
                  {
                    title: '2. Geradores de Tráfego',
                    subtitle: 'Alta procura no WhatsApp com margem moderada.',
                    items: dashboardData.trafficGenerators,
                    badgeClass: 'bg-[#F4F4F4] text-[#111111]',
                  },
                  {
                    title: '3. Alta Margem & Giro Seletivo',
                    subtitle: 'Excelente retorno unitário. Recomendado destacar na vitrine.',
                    items: dashboardData.luxuryGems,
                    badgeClass: 'bg-[#F4F4F4] text-[#111111]',
                  },
                  {
                    title: '4. Baixo Giro (Candidatos a Oferta)',
                    subtitle: 'Menor procura recente. Avalie aplicar desconto promocional.',
                    items: dashboardData.slowMovers,
                    badgeClass: 'bg-[#FFFBEB] text-[#92400E]',
                  },
                ].map((quad, qIdx) => (
                  <div
                    key={qIdx}
                    className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAF8] p-4 space-y-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#111111]">{quad.title}</p>
                      <p className="text-[11px] text-[#767676] mt-0.5">{quad.subtitle}</p>
                    </div>
                    <div className="space-y-2">
                      {quad.items.length === 0 ? (
                        <p className="text-xs text-[#999999] py-2">
                          Nenhum produto classificado neste grupo.
                        </p>
                      ) : (
                        quad.items.map((item) => (
                          <Link
                            key={item.product.id}
                            to={`/admin/produtos/${item.product.id}/editar`}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EAEAEA] hover:border-[#111111] transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.product.name}
                                  className="w-9 h-9 rounded-lg object-contain bg-white border border-[#F0F0F0] shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#111111] truncate">
                                  {item.product.name}
                                </p>
                                <p className="text-[11px] text-[#767676]">
                                  {item.clicks} cliques • Estoque: {item.stock} un.
                                </p>
                              </div>
                            </div>
                            <span
                              className={cn(
                                'text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0',
                                quad.badgeClass
                              )}
                            >
                              Margem {item.marginPct}%
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODELO 5: MEIOS DE PAGAMENTO */}
          {chartMode === 'payments' && (
            <div className="pt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#111111]">
                    Receita por Meio de Pagamento e Desconto de Taxas
                  </h3>
                  <p className="text-xs text-[#767676]">
                    Valores consolidados a partir das vendas lançadas no PDV.
                  </p>
                </div>
                <Link
                  to="/admin/financeiro"
                  className="text-xs font-semibold text-[#111111] hover:underline"
                >
                  Ir para o Financeiro →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(['pix', 'credit_card', 'debit_card', 'cash'] as PaymentMethod[]).map((pm) => {
                  const item = dashboardData.paymentStats[pm]
                  const fees = Math.max(0, item.gross - item.net)
                  return (
                    <div
                      key={pm}
                      className="rounded-2xl border border-[#EAEAEA] p-4 bg-[#FAFAF8] flex flex-col justify-between space-y-3"
                    >
                      <span className="text-xs font-bold text-[#111111]">{item.label}</span>

                      <div>
                        <p className="text-xl font-extrabold text-[#111111] tabular-nums">
                          {formatBRL(item.gross)}
                        </p>
                        <p className="text-[11px] text-[#767676]">
                          {item.count} lançamento(s)
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#EAEAEA] text-[11px] space-y-1">
                        <div className="flex justify-between text-[#767676]">
                          <span>Taxas retidas:</span>
                          <span className="font-medium text-[#991B1B] tabular-nums">
                            - {formatBRL(fees)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#166534] font-bold">
                          <span>Valor líquido:</span>
                          <span className="tabular-nums">{formatBRL(item.net)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 4. INTEGRIDADE DO CATÁLOGO & ACESSO RÁPIDO ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111111]">
                Integridade da Vitrine ({dashboardData.healthScore}%)
              </h2>
              <p className="text-xs text-[#767676] mt-0.5">
                Checklist técnico de preenchimento dos produtos.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA]">
                <span className="text-[#242424] font-medium flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#166534]" /> Produtos com fotografia
                </span>
                <strong className="text-[#111111] tabular-nums">
                  {dashboardData.withImageCount}/{products.length}
                </strong>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA]">
                <span className="text-[#242424] font-medium flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#166534]" /> Produtos com preço definido
                </span>
                <strong className="text-[#111111] tabular-nums">
                  {dashboardData.withPriceCount}/{products.length}
                </strong>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA]">
                <span className="text-[#242424] font-medium flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#166534]" /> Produtos com saldo em estoque
                </span>
                <strong className="text-[#111111] tabular-nums">
                  {products.length - dashboardData.zeroStockCount}/{products.length}
                </strong>
              </div>
            </div>

            <div className="pt-2 border-t border-[#F0F0F0] grid grid-cols-2 gap-2.5">
              <Link
                to="/admin/financeiro"
                className="p-3 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA] hover:border-[#111111] transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[#767676] text-[11px] font-semibold">
                  <Clock size={12} /> Contas a Pagar
                </div>
                <p className="text-sm font-extrabold text-[#111111] tabular-nums mt-1">
                  {formatBRL(dashboardData.pendingPayables)}
                </p>
              </Link>

              <Link
                to="/admin/financeiro"
                className="p-3 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA] hover:border-[#111111] transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[#767676] text-[11px] font-semibold">
                  <Users size={12} /> Contas a Receber
                </div>
                <p className="text-sm font-extrabold text-[#111111] tabular-nums mt-1">
                  {formatBRL(dashboardData.pendingReceivables)}
                </p>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#EAEAEA] p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-[#111111]">
                Acesso Rápido aos Módulos
              </h2>
              <p className="text-xs text-[#767676] mt-0.5 mb-4">
                Atalhos diretos para gestão diária da loja.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Link
                  to="/admin/financeiro"
                  className="flex items-center justify-between p-4 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#111111] text-white flex items-center justify-center shrink-0">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">
                        Financeiro, DRE & PDV
                      </p>
                      <p className="text-[11px] text-[#767676]">
                        Fluxo de caixa, despesas e contas a receber
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={15} className="text-[#999999] group-hover:text-[#111111] transition-colors" />
                </Link>

                <Link
                  to="/admin/estoque"
                  className="flex items-center justify-between p-4 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                      <Boxes size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">
                        Controle de Estoque & Custos
                      </p>
                      <p className="text-[11px] text-[#767676]">
                        Entradas de fornecedor, margem e Curva ABC
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={15} className="text-[#999999] group-hover:text-[#111111] transition-colors" />
                </Link>

                <Link
                  to="/admin/produtos"
                  className="flex items-center justify-between p-4 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">
                        Catálogo de Produtos & Preços
                      </p>
                      <p className="text-[11px] text-[#767676]">
                        Edição rápida, ajuste em massa e duplicação
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={15} className="text-[#999999] group-hover:text-[#111111] transition-colors" />
                </Link>

                <Link
                  to="/admin/configuracoes"
                  className="flex items-center justify-between p-4 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                      <Settings size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">
                        Identidade Visual & WhatsApp
                      </p>
                      <p className="text-[11px] text-[#767676]">
                        Banner principal, logotipo e atendimento
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={15} className="text-[#999999] group-hover:text-[#111111] transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── MODAL DE QR CODE E CARTAZ DE BALCÃO DA LOJA ── */}
        {qrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-[#EAEAEA] shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  QR Code Oficial da Vitrine
                </span>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bg-[#111111] text-white rounded-2xl p-6 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#24A850]">
                  {settings?.store_name || 'Alfa Eletrônicos'}
                </p>
                <h3 className="text-base font-bold leading-snug">
                  Acesse nosso Catálogo Digital
                </h3>
                <div className="bg-white p-3 rounded-2xl inline-block mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
                      window.location.origin
                    )}`}
                    alt="QR Code Catálogo Alfa Eletrônicos"
                    className="w-44 h-44 mx-auto"
                  />
                </div>
                <p className="text-[11px] text-white/60">
                  Aponte a câmera do celular para ver produtos e preços
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-[#EAEAEA] hover:bg-gray-50 text-xs font-bold text-[#111111] transition-colors"
                >
                  <Printer size={14} /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={handleCopyCatalogLink}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#111111] hover:bg-[#242424] text-xs font-bold text-white transition-colors"
                >
                  <Copy size={14} /> Copiar Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
