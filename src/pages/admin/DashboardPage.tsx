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
  Edit3,
  Eye,
  Award,
  Activity,
  Info,
  Filter,
  Calendar,
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
  saveExtendedStoreConfig,
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

type ChartViewMode = 'columns' | 'area' | 'donut' | 'matrix' | 'payments' | 'intelligence'
type DashboardPeriod = 'today' | '7d' | 'month' | 'last_month' | 'all'

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  month: 'Mês atual',
  last_month: 'Mês anterior',
  all: 'Todo o histórico',
}

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

  // Filtro de período de referência para os indicadores realizados e matriz
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  // Filtro de categoria na Matriz de Desempenho e Rankings
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>('all')

  // Edição rápida da Meta Mensal diretamente no Dashboard
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('25000')
  const [savingGoal, setSavingGoal] = useState(false)

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
          setGoalDraft(String(extCfg.financial_config.monthly_revenue_goal || 25000))
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(goalDraft.replace(/\./g, '').replace(',', '.').trim())
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Informe um valor válido maior que zero para a meta.')
      return
    }
    setSavingGoal(true)
    try {
      const nextFin: FinancialConfig = {
        ...finConfig,
        monthly_revenue_goal: parsed,
      }
      await saveExtendedStoreConfig({ financial_config: nextFin })
      setFinConfig(nextFin)
      setEditingGoal(false)
      toast.success(`Meta mensal atualizada para ${formatBRL(parsed)}!`)
    } catch {
      toast.error('Erro ao salvar meta mensal.')
    } finally {
      setSavingGoal(false)
    }
  }

  const dashboardData = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const isCurrentMonth = (iso: string) => {
      const d = new Date(iso)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }

    const matchesPeriod = (iso: string, p: DashboardPeriod): boolean => {
      if (p === 'all') return true
      const d = new Date(iso)
      if (isNaN(d.getTime())) return false
      if (p === 'today') return d >= startOfToday
      if (p === '7d') {
        const sevenDaysAgo = new Date(startOfToday)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        return d >= sevenDaysAgo
      }
      if (p === 'month') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      if (p === 'last_month') {
        const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endLast = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        return d >= startLast && d <= endLast
      }
      return true
    }

    // Vendas realizadas no período selecionado
    const periodSales = movements.filter(
      (m) => m.type === 'out' && (m.reason === 'sale' || !m.reason) && matchesPeriod(m.created_at, period)
    )

    // Mapa de vendas por produto no período selecionado
    const soldByProductInPeriod: Record<string, { units: number; revenue: number; profit: number }> = {}
    for (const s of periodSales) {
      if (!soldByProductInPeriod[s.product_id]) {
        soldByProductInPeriod[s.product_id] = { units: 0, revenue: 0, profit: 0 }
      }
      const rev = s.total_value ?? (s.unit_price || 0) * s.quantity
      soldByProductInPeriod[s.product_id].units += s.quantity
      soldByProductInPeriod[s.product_id].revenue += rev
      soldByProductInPeriod[s.product_id].profit += s.profit_value || 0
    }

    let totalUnitsInStock = 0
    let totalCostInvested = 0
    let totalSalePotential = 0
    let totalSalePotentialWithKnownCost = 0
    let lowStockCount = 0
    let zeroStockCount = 0
    let totalClicks = 0
    let totalViews = 0
    let productsWithCostCount = 0
    let productsWithoutCostCount = 0

    const enrichedProducts: Array<{
      product: Product
      sku: string | null
      views: number
      clicks: number
      soldTotal: number
      soldInPeriod: number
      revenueInPeriod: number
      stock: number
      lowThreshold: number
      hasCost: boolean
      cost: number | null
      price: number
      unitMarginValue: number | null
      marginPct: number | null
      stockSaleValue: number
      stockCostValue: number
      stockProfitValue: number
      imageUrl: string | null
    }> = []

    for (const p of products) {
      const m = metaMap[p.id] || {}
      const stock =
        typeof m.stock_quantity === 'number'
          ? Math.max(0, m.stock_quantity)
          : 0
      const lowThreshold = m.low_stock_threshold ?? 2
      const price = p.price && p.price > 0 ? p.price : 0

      // REGRA ESTRITA: Jamais inventar percentual fixo para margem individual!
      const hasCost = typeof m.cost_price === 'number' && m.cost_price > 0
      const cost = hasCost ? m.cost_price! : null

      if (hasCost) {
        productsWithCostCount++
      } else {
        productsWithoutCostCount++
      }

      const clicks = m.whatsapp_clicks || 0
      const views = m.views || 0
      const soldTotal = m.total_units_sold || 0
      const periodStat = soldByProductInPeriod[p.id] || { units: 0, revenue: 0, profit: 0 }

      totalUnitsInStock += stock
      totalSalePotential += stock * price
      if (hasCost && cost !== null) {
        totalCostInvested += stock * cost
        totalSalePotentialWithKnownCost += stock * price
      }
      totalClicks += clicks
      totalViews += views

      if (stock <= 0) zeroStockCount++
      else if (stock <= lowThreshold) lowStockCount++

      const unitMarginValue = hasCost && cost !== null && price > 0 ? price - cost : null
      const marginPct =
        hasCost && cost !== null && price > 0
          ? Math.round(((price - cost) / price) * 100)
          : null

      const primaryImg =
        p.product_images?.find((i) => i.is_primary)?.public_url ||
        p.product_images?.[0]?.public_url ||
        null

      const stockCostValue = hasCost && cost !== null ? stock * cost : 0
      const stockProfitValue =
        hasCost && cost !== null && price > 0 ? Math.max(0, stock * (price - cost)) : 0

      enrichedProducts.push({
        product: p,
        sku: m.sku || null,
        views,
        clicks,
        soldTotal,
        soldInPeriod: periodStat.units,
        revenueInPeriod: periodStat.revenue,
        stock,
        lowThreshold,
        hasCost,
        cost,
        price,
        unitMarginValue,
        marginPct,
        stockSaleValue: stock * price,
        stockCostValue,
        stockProfitValue,
        imageUrl: primaryImg,
      })
    }

    // Lucro projetado do estoque (calculado estritamente sobre itens com custo e preço reais cadastrados)
    const projectedStockProfit = Math.max(0, totalSalePotentialWithKnownCost - totalCostInvested)
    const projectedStockMarginPct =
      totalSalePotentialWithKnownCost > 0
        ? Math.round((projectedStockProfit / totalSalePotentialWithKnownCost) * 100)
        : null

    // ── Cálculos Financeiros Realizados no Período Selecionado ──
    const periodExtra = extraIncomes.filter((inc) => matchesPeriod(inc.created_at, period))
    const periodLosses = movements.filter(
      (m) =>
        m.type === 'out' &&
        (m.reason === 'warranty' || m.reason === 'loss' || m.reason === 'gift') &&
        matchesPeriod(m.created_at, period)
    )
    const periodExpensesPaid = expenses
      .filter((e) => e.status !== 'pending' && matchesPeriod(e.due_date || e.date || e.created_at, period))
      .reduce((acc, e) => acc + e.amount, 0)

    let periodProductRevenue = 0
    let periodProductCmv = 0
    let salesWithoutCostCount = 0

    for (const s of periodSales) {
      const rev = s.total_value ?? (s.unit_price || 0) * s.quantity
      const unitCost = s.unit_cost && s.unit_cost > 0 ? s.unit_cost : metaMap[s.product_id]?.cost_price || 0
      periodProductRevenue += rev
      if (unitCost > 0) {
        periodProductCmv += unitCost * s.quantity
      } else {
        salesWithoutCostCount += 1
      }
    }

    const periodExtraRevenue = periodExtra.reduce((acc, i) => acc + i.amount, 0)
    const periodExtraCost = periodExtra.reduce((acc, i) => acc + (i.cost_amount || 0), 0)

    const periodGrossRevenue = periodProductRevenue + periodExtraRevenue
    const periodTotalCmv = periodProductCmv + periodExtraCost
    const periodGrossProfit = periodGrossRevenue - periodTotalCmv
    const periodGrossMarginPct =
      periodGrossRevenue > 0 ? Math.round((periodGrossProfit / periodGrossRevenue) * 100) : null

    const periodWarrantyLossCost = periodLosses.reduce(
      (acc, m) => acc + (m.unit_cost || 0) * m.quantity,
      0
    )
    const periodNetProfit = periodGrossProfit - periodExpensesPaid - periodWarrantyLossCost
    const periodNetMarginPct =
      periodGrossRevenue > 0 ? Math.round((periodNetProfit / periodGrossRevenue) * 100) : null

    // ── Meta Mensal (sempre referente ao Mês Atual) ──
    const monthSales = movements.filter(
      (m) => m.type === 'out' && (m.reason === 'sale' || !m.reason) && isCurrentMonth(m.created_at)
    )
    const monthExtra = extraIncomes.filter((inc) => isCurrentMonth(inc.created_at))
    const monthGrossRevenue =
      monthSales.reduce((acc, m) => acc + (m.total_value ?? (m.unit_price || 0) * m.quantity), 0) +
      monthExtra.reduce((acc, i) => acc + i.amount, 0)

    const goal = finConfig.monthly_revenue_goal || 25000
    const goalPct = goal > 0 ? Math.min(100, Math.round((monthGrossRevenue / goal) * 100)) : 0
    const goalRemaining = Math.max(0, goal - monthGrossRevenue)
    const goalSurplus = Math.max(0, monthGrossRevenue - goal)

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
        views: number
        soldUnits: number
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
        views: 0,
        soldUnits: 0,
      })
    }

    for (const item of enrichedProducts) {
      const catId = item.product.category_id || 'sem-cat'
      const existing = catMap.get(catId) || {
        id: catId,
        name: item.product.category?.name || 'Sem Categoria',
        productCount: 0,
        stockUnits: 0,
        costValue: 0,
        saleValue: 0,
        profitValue: 0,
        clicks: 0,
        views: 0,
        soldUnits: 0,
      }
      existing.productCount += 1
      existing.stockUnits += item.stock
      existing.costValue += item.stockCostValue
      existing.saleValue += item.stockSaleValue
      existing.profitValue += item.stockProfitValue
      existing.clicks += item.clicks
      existing.views += item.views
      existing.soldUnits += item.soldInPeriod
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

    for (const s of periodSales) {
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
    for (const inc of periodExtra) {
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

    // ── Classificação da Matriz de Desempenho (Etapa 3) ──
    const matrixFilteredList =
      matrixCategoryFilter === 'all'
        ? enrichedProducts
        : enrichedProducts.filter((item) => item.product.category_id === matrixCategoryFilter)

    // Produtos sem dados suficientes (sem custo de aquisição, sem preço ou sem estoque) não são classificados como baixo giro
    const insufficientDataProducts = matrixFilteredList.filter(
      (p) => !p.hasCost || p.price <= 0 || p.stock <= 0 || p.marginPct === null
    )
    const analyzableProducts = matrixFilteredList.filter(
      (p) => p.hasCost && p.price > 0 && p.stock > 0 && p.marginPct !== null
    )

    // Critério de giro real: teve pelo menos 1 venda no período OU soma ponderada (vendas*3 + cliques + views>=3) >= 2
    const hasHighActivity = (p: (typeof enrichedProducts)[0]) =>
      p.soldInPeriod >= 1 || p.soldTotal >= 1 || p.clicks >= 2 || p.views >= 4

    const champions = analyzableProducts.filter((p) => p.marginPct! >= 30 && hasHighActivity(p))
    const trafficGenerators = analyzableProducts.filter(
      (p) => p.marginPct! < 30 && hasHighActivity(p)
    )
    const luxuryGems = analyzableProducts.filter((p) => p.marginPct! >= 30 && !hasHighActivity(p))
    const slowMovers = analyzableProducts.filter((p) => p.marginPct! < 30 && !hasHighActivity(p))

    // Rankings de Inteligência Comercial (Etapa 9)
    const topSoldProducts = [...matrixFilteredList]
      .filter((p) => p.soldInPeriod > 0 || p.soldTotal > 0)
      .sort((a, b) => b.soldInPeriod - a.soldInPeriod || b.soldTotal - a.soldTotal)
      .slice(0, 5)

    const topClickedAndViewed = [...matrixFilteredList]
      .filter((p) => p.clicks > 0 || p.views > 0)
      .sort((a, b) => b.clicks * 2 + b.views - (a.clicks * 2 + a.views))
      .slice(0, 5)

    const topMarginProducts = [...matrixFilteredList]
      .filter((p) => p.hasCost && p.marginPct !== null && p.price > 0)
      .sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0))
      .slice(0, 5)

    const stagnantStockProducts = [...matrixFilteredList]
      .filter((p) => p.stock > 0 && p.soldTotal === 0 && p.clicks === 0)
      .sort((a, b) => b.stockSaleValue - a.stockSaleValue)
      .slice(0, 5)

    const totalProds = Math.max(1, products.length)
    const withImageCount = products.filter(
      (p) => p.product_images && p.product_images.length > 0
    ).length
    const withPriceCount = products.filter((p) => p.price && p.price > 0).length
    const publishedCount = products.filter((p) => p.is_published).length
    const hiddenCount = products.length - publishedCount
    const featuredCount = products.filter((p) => p.is_featured).length
    const healthyStockCount = products.length - zeroStockCount

    const healthScore = Math.round(
      (withImageCount / totalProds) * 25 +
      (withPriceCount / totalProds) * 25 +
      (productsWithCostCount / totalProds) * 25 +
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
      totalSalePotentialWithKnownCost,
      projectedStockProfit,
      projectedStockMarginPct,
      productsWithCostCount,
      productsWithoutCostCount,
      lowStockCount,
      zeroStockCount,
      totalClicks,
      totalViews,
      enrichedProducts,
      periodGrossRevenue,
      periodTotalCmv,
      periodGrossProfit,
      periodGrossMarginPct,
      periodExpensesPaid,
      periodWarrantyLossCost,
      periodNetProfit,
      periodNetMarginPct,
      salesWithoutCostCount,
      periodSalesCount: periodSales.length,
      monthGrossRevenue,
      goal,
      goalPct,
      goalRemaining,
      goalSurplus,
      categoryBreakdown,
      maxCatSaleValue,
      last7Days,
      hasRealDailySales,
      paymentStats,
      champions,
      trafficGenerators,
      luxuryGems,
      slowMovers,
      insufficientDataProducts,
      topSoldProducts,
      topClickedAndViewed,
      topMarginProducts,
      stagnantStockProducts,
      healthScore,
      withImageCount,
      withPriceCount,
      publishedCount,
      hiddenCount,
      featuredCount,
      pendingPayables,
      pendingReceivables,
      recentMovements: movements.slice(0, 6),
    }
  }, [
    products,
    categories,
    metaMap,
    movements,
    expenses,
    receivables,
    extraIncomes,
    finConfig,
    period,
    matrixCategoryFilter,
  ])

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
      ? `${primaryLinePath} L ${primaryCoords[primaryCoords.length - 1].x} ${padY + plotH
      } L ${primaryCoords[0].x} ${padY + plotH} Z`
      : ''

  return (
    <AdminLayout>
      <div className="w-full max-w-[1600px] space-y-5 sm:space-y-6">
        {/* ── 1. HEADER EXECUTIVO & META MENSAL CONFIGURÁVEL ── */}
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
                    year: 'numeric',
                  })}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
                {greeting}, {settings?.store_name || 'Alfa Eletrônicos'}
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-0.5">
                Centro de controle operacional: vendas reais, DRE, estoque auditado e inteligência comercial.
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

          {/* Barra de Meta Mensal com Edição Direta */}
          <div className="mt-4 sm:mt-5 pt-4 border-t border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
                <Target size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/90 font-semibold">
                      Meta de Faturamento Mensal ({dashboardData.goalPct}%)
                    </span>
                    {!editingGoal ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGoalDraft(String(dashboardData.goal))
                          setEditingGoal(true)
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[11px] text-white/80 transition-colors"
                        title="Editar meta mensal"
                      >
                        <Edit3 size={11} /> Editar meta
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 bg-white/10 p-1 rounded-lg">
                        <span className="text-[11px] text-white/70 pl-1.5">R$</span>
                        <input
                          type="number"
                          min="100"
                          step="100"
                          value={goalDraft}
                          onChange={(e) => setGoalDraft(e.target.value)}
                          className="w-28 bg-black/40 border border-white/20 rounded-md px-2 py-0.5 text-xs text-white focus:outline-none focus:border-white"
                          placeholder="Ex: 50000"
                        />
                        <button
                          type="button"
                          onClick={handleSaveGoal}
                          className="px-2 py-0.5 rounded-md bg-[#24A850] hover:bg-[#1E8E42] text-[11px] font-bold text-white"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGoal(false)}
                          className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[11px] text-white/70"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] sm:text-xs">
                    <span className="font-bold text-white tabular-nums">
                      Realizado no mês: {formatBRL(dashboardData.monthGrossRevenue)} / {formatBRL(dashboardData.goal)}
                    </span>
                    {dashboardData.goalRemaining > 0 ? (
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-medium tabular-nums">
                        Faltam {formatBRL(dashboardData.goalRemaining)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-[#24A850]/20 text-[#4ADE80] font-bold tabular-nums">
                        Meta superada em +{formatBRL(dashboardData.goalSurplus)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#24A850] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, dashboardData.goalPct)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <Link
                to="/admin/financeiro"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                <DollarSign size={14} /> Abrir Caixa / PDV
              </Link>
              <Link
                to="/admin/produtos/novo"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                <Plus size={14} /> Novo Produto
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2. RESULTADO FINANCEIRO REALIZADO (COM SELETOR DE PERÍODO E FÓRMULAS DOCUMENTADAS) ── */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#111111]">
                  Indicadores Financeiros Realizados ({dashboardData.periodLabel})
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F0FDF4] text-[#166534] text-[10px] font-bold uppercase tracking-wider">
                  Dados Reais de Vendas
                </span>
              </div>
              <p className="text-xs text-[#767676] mt-0.5">
                Calculado exclusivamente sobre vendas efetivadas no PDV/Estoque. Não inclui valor parado em estoque nem cliques no WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#F4F4F4] p-1 rounded-xl overflow-x-auto max-w-full">
              <Calendar size={13} className="text-[#767676] ml-2 mr-1 shrink-0" />
              {(
                [
                  { id: 'today', label: 'Hoje' },
                  { id: '7d', label: '7 dias' },
                  { id: 'month', label: 'Mês atual' },
                  { id: 'last_month', label: 'Mês anterior' },
                  { id: 'all', label: 'Histórico total' },
                ] as { id: DashboardPeriod; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
                    period === p.id
                      ? 'bg-[#111111] text-white shadow-2xs'
                      : 'text-[#555555] hover:text-[#111111]'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {dashboardData.salesWithoutCostCount > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
              <div className="flex items-center gap-2">
                <Info size={15} className="shrink-0" />
                <span>
                  <strong>Atenção contábil:</strong> {dashboardData.salesWithoutCostCount} venda(s) no período selecionado ocorreram em produtos sem preço de custo cadastrado. Cadastre o custo para apuração exata do CMV.
                </span>
              </div>
              <Link to="/admin/estoque" className="font-bold underline shrink-0">
                Revisar Custos →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* 1. Faturamento Bruto */}
            <div className="p-4 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8]">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#767676] mb-1">
                <span>1. Faturamento Bruto</span>
                <span className="text-[#111111]">{dashboardData.periodSalesCount} venda(s)</span>
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-[#111111] tabular-nums">
                {formatBRL(dashboardData.periodGrossRevenue)}
              </p>
              <p className="text-[11px] text-[#767676] mt-1">
                Soma bruta das vendas realizadas ({dashboardData.periodUnitsSold} un. vendidas)
              </p>
            </div>

            {/* 2. CMV (Custo das Mercadorias Vendidas) */}
            <div className="p-4 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8]">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#767676] mb-1">
                <span>2. Custo Mercadoria (CMV)</span>
                <span>Saídas</span>
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-[#111111] tabular-nums">
                {formatBRL(dashboardData.periodTotalCmv)}
              </p>
              <p className="text-[11px] text-[#767676] mt-1">
                Custo unitário real × unidades vendidas no período
              </p>
            </div>

            {/* 3. Lucro Bruto & Margem Bruta */}
            <div className="p-4 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8]">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#767676] mb-1">
                <span>3. Lucro Bruto Realizado</span>
                {dashboardData.periodGrossMarginPct !== null && (
                  <span className="px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#166534] font-bold">
                    Margem {dashboardData.periodGrossMarginPct}%
                  </span>
                )}
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-[#166534] tabular-nums">
                {formatBRL(dashboardData.periodGrossProfit)}
              </p>
              <p className="text-[11px] text-[#767676] mt-1">
                Fórmula: Faturamento Bruto − CMV ({formatBRL(dashboardData.periodCardFees)} em taxas)
              </p>
            </div>

            {/* 4. Despesas Operacionais */}
            <div className="p-4 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8]">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#767676] mb-1">
                <span>4. Despesas Operacionais</span>
                <span>Pagas</span>
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-[#991B1B] tabular-nums">
                {formatBRL(dashboardData.periodExpensesPaid)}
              </p>
              <p className="text-[11px] text-[#767676] mt-1">
                Despesas fixas/variáveis baixadas no período
              </p>
            </div>

            {/* 5. Lucro Líquido Realizado */}
            <div
              className={cn(
                'p-4 rounded-xl border',
                dashboardData.periodNetProfit >= 0
                  ? 'border-[#BBF7D0] bg-[#F0FDF4]/60'
                  : 'border-[#FECACA] bg-[#FEF2F2]/60'
              )}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#767676] mb-1">
                <span>5. Lucro Líquido Real</span>
                <Link to="/admin/financeiro" className="text-[#111111] underline font-bold">
                  Ver DRE
                </Link>
              </div>
              <p
                className={cn(
                  'text-lg sm:text-xl font-extrabold tabular-nums',
                  dashboardData.periodNetProfit >= 0 ? 'text-[#166534]' : 'text-[#991B1B]'
                )}
              >
                {formatBRL(dashboardData.periodNetProfit)}
              </p>
              <p className="text-[11px] text-[#767676] mt-1">
                Lucro Bruto − Taxas − Despesas{dashboardData.periodExtraIncomeTotal > 0 ? ` + Extras (${formatBRL(dashboardData.periodExtraIncomeTotal)})` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* ── 2.2 INDICADORES PATRIMONIAIS DE ESTOQUE, DEMANDA E VITRINE (PROJEÇÕES SEPARADAS DO REALIZADO) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {/* Card Patrimônio em Estoque */}
          <Link
            to="/admin/estoque"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-4 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
                  <Wallet size={15} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4F4F4] text-[#555555]">
                  Patrimônio / Estoque Atual
                </span>
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-[#111111] tabular-nums">
                {formatBRL(dashboardData.totalSalePotential)}
              </p>
              <p className="text-xs font-medium text-[#767676] mt-0.5">
                Potencial de Venda ({dashboardData.totalUnitsInStock} un. físicas)
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#F0F0F0] flex items-center justify-between text-[11px]">
              <span className="text-[#767676]">Custo investido:</span>
              <strong className="text-[#111111] tabular-nums">
                {formatBRL(dashboardData.totalCostInvested)}
              </strong>
            </div>
          </Link>

          {/* Card Margem Projetada do Estoque */}
          <Link
            to="/admin/estoque"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-4 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] text-[#166534] flex items-center justify-center">
                  <TrendingUp size={15} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F0FDF4] text-[#166534]">
                  Projeção de Estoque
                </span>
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-[#166534] tabular-nums">
                +{formatBRL(dashboardData.projectedStockProfit)}
              </p>
              <p className="text-xs font-medium text-[#767676] mt-0.5">
                Lucro Bruto Projetado {dashboardData.projectedStockMarginPct !== null ? `(Margem ${dashboardData.projectedStockMarginPct}%)` : ''}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#F0F0F0] flex items-center justify-between text-[11px]">
              <span className="text-[#767676]">Itens c/ custo definido:</span>
              <strong className="text-[#111111] tabular-nums">
                {dashboardData.withCostCount}/{products.length} produtos
              </strong>
            </div>
          </Link>

          {/* Card Demanda & Interesse (Cliques vs Visualizações vs Vendas) */}
          <Link
            to="/admin/produtos"
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-4 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
                  <MessageCircle size={15} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4F4F4] text-[#555555]">
                  Funil Comercial
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <div>
                  <p className="text-lg sm:text-xl font-extrabold text-[#111111] tabular-nums">
                    {dashboardData.totalClicks}
                  </p>
                  <p className="text-xs font-medium text-[#767676]">Cliques WhatsApp</p>
                </div>
                <div className="pl-3 border-l border-[#EAEAEA]">
                  <p className="text-lg sm:text-xl font-extrabold text-[#111111] tabular-nums">
                    {dashboardData.totalViews}
                  </p>
                  <p className="text-xs font-medium text-[#767676]">Visualizações</p>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#F0F0F0] flex items-center justify-between text-[11px]">
              <span className="text-[#767676]">Vendas efetivadas (total):</span>
              <strong className="text-[#166534] tabular-nums">
                {dashboardData.allTimeSalesCount} venda(s) ({dashboardData.allTimeUnitsSold} un.)
              </strong>
            </div>
          </Link>

          {/* Card Vitrine & Alertas de Estoque */}
          <Link
            to="/admin/estoque"
            className={cn(
              'rounded-2xl border p-4 transition-all flex flex-col justify-between',
              dashboardData.lowStockCount + dashboardData.zeroStockCount > 0
                ? 'bg-[#FFFBEB]/60 border-[#FDE68A] hover:border-[#F59E0B]'
                : 'bg-white border-[#EAEAEA] hover:border-[#111111]'
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] text-[#92400E] flex items-center justify-center">
                  <AlertTriangle size={15} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFFBEB] text-[#92400E]">
                  Vitrine & Reposição
                </span>
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-[#111111] tabular-nums">
                {dashboardData.lowStockCount + dashboardData.zeroStockCount} alerta(s)
              </p>
              <p className="text-xs font-medium text-[#92400E] mt-0.5">
                {dashboardData.zeroStockCount} sem estoque · {dashboardData.lowStockCount} estoque baixo
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#F0F0F0] flex items-center justify-between text-[11px]">
              <span className="text-[#767676]">Status da vitrine:</span>
              <strong className="text-[#111111] tabular-nums">
                {dashboardData.publishedCount} publ. · {dashboardData.hiddenCount} oculto(s)
              </strong>
            </div>
          </Link>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            3. PAINEL DE ANÁLISE GRÁFICA, MATRIZ DE DESEMPENHO E RANKINGS
           ══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 sm:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-[#F0F0F0]">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#111111]">
                Análise Financeira, Matriz de Desempenho & Inteligência Comercial
              </h2>
              <p className="text-xs text-[#767676] mt-0.5">
                Alterne entre as visões analíticas abaixo para inspecionar categorias, giro de produtos e rankings.
              </p>
            </div>

            {/* Seletor de Gráficos Deslizante */}
            <div className="flex items-center gap-1 bg-[#F4F4F4] p-1 rounded-xl overflow-x-auto max-w-full">
              {(
                [
                  { id: 'matrix', label: 'Matriz de Desempenho', icon: Grid },
                  { id: 'intelligence', label: 'Rankings & Giro', icon: Award },
                  { id: 'columns', label: 'Colunas', icon: BarChart3 },
                  { id: 'area', label: 'Curva', icon: LineChart },
                  { id: 'donut', label: 'Distribuição', icon: PieChart },
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
                    Custo Investido vs. Valor de Venda vs. Lucro Projetado por Categoria
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#767676]">
                    Comparativo patrimonial entre as categorias ativas do catálogo (considerando custos reais cadastrados).
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
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#24A850] inline-block" /> Lucro Projetado
                  </span>
                </div>
              </div>

              {/* VISÃO MOBILE (< 768px) */}
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
                            Lucro proj.: +{formatBRL(cat.profitValue)}
                          </p>
                        </div>
                      </div>

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

              {/* VISÃO DESKTOP (>= 768px) */}
              <div className="hidden md:block pt-6 pb-2">
                <div className="flex items-stretch gap-3">
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

                  <div className="flex-1 relative">
                    <div className="absolute inset-x-0 top-0 h-50 flex flex-col justify-between pointer-events-none">
                      {[1, 0.75, 0.5, 0.25, 0].map((_, idx) => (
                        <div
                          key={idx}
                          className="w-full border-t border-dashed border-[#EEEEEE]"
                        />
                      ))}
                    </div>

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
                                  Lucro proj.: +{formatBRL(cat.profitValue)}
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

          {/* MODELO 2: GRÁFICO DE ÁREA COM CURVA SUAVE */}
          {chartMode === 'area' && (
            <div className="pt-4 sm:pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#111111]">
                    {dashboardData.hasRealDailySales
                      ? 'Evolução Diária Realizada (Últimos 7 Dias: Receita vs. Lucro)'
                      : 'Curva de Valor de Estoque e Lucro Projetado por Produto'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#767676]">
                    Comparativo entre o valor bruto e a margem líquida.
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[11px] sm:text-xs font-medium text-[#555555]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#111111] inline-block" /> Receita Bruta
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#24A850] inline-block" /> Lucro
                  </span>
                </div>
              </div>

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
            </div>
          )}

          {/* MODELO 3: GRÁFICO DE ROSCA EDITORIAL */}
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
                          Lucro proj.: +{formatBRL(seg.profitValue)}
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

          {/* MODELO 4: MATRIZ DE DESEMPENHO EVOLUÍDA (ETAPA 3) */}
          {chartMode === 'matrix' && (
            <div className="pt-5 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FAFAF8] p-3.5 rounded-xl border border-[#EAEAEA]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-bold text-[#111111]">
                      Matriz de Desempenho Multicritério ({dashboardData.periodLabel})
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-[#111111] text-white text-[10px] font-semibold">
                      Margem Média de Corte: {dashboardData.avgMarginThreshold}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[#767676]">
                    <strong>Critério de classificação:</strong> Combina Vendas no período (peso 5) + Cliques WhatsApp (peso 2) + Visualizações (peso 1) × Margem Bruta Real calculada sobre o custo unitário cadastrado, apenas para itens com saldo em estoque.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Filter size={13} className="text-[#767676]" />
                  <select
                    value={matrixCategoryFilter}
                    onChange={(e) => setMatrixCategoryFilter(e.target.value)}
                    className="bg-white border border-[#EAEAEA] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#111111] focus:outline-none focus:border-[#111111]"
                  >
                    <option value="all">Todas as categorias ({products.length})</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: '1. Alta Margem & Alto Giro',
                    subtitle:
                      'Produtos com vendas/procura acima da média e margem bruta superior à média da loja. Prioridade máxima de reposição.',
                    items: dashboardData.champions,
                    badgeClass: 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]',
                  },
                  {
                    title: '2. Geradores de Tráfego',
                    subtitle:
                      'Alto volume de vendas, visualizações ou cliques no WhatsApp com margem moderada. Atraem clientes para o catálogo.',
                    items: dashboardData.trafficGenerators,
                    badgeClass: 'bg-[#F4F4F4] text-[#111111] border border-[#E5E5E5]',
                  },
                  {
                    title: '3. Alta Margem & Giro Seletivo',
                    subtitle:
                      'Excelente lucro unitário e percentual, mas menor frequência de saída. Recomendado destacar na página inicial.',
                    items: dashboardData.luxuryGems,
                    badgeClass: 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]',
                  },
                  {
                    title: '4. Baixo Giro (Candidatos a Oferta)',
                    subtitle:
                      'Produtos disponíveis em estoque e com custo cadastrado, porém sem saída ou procura recente no período analisado.',
                    items: dashboardData.slowMovers,
                    badgeClass: 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]',
                  },
                ].map((quad, qIdx) => (
                  <div
                    key={qIdx}
                    className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAF8] p-4 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-bold text-[#111111]">{quad.title}</p>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#EAEAEA] text-[#555555]">
                          {quad.items.length} item(ns)
                        </span>
                      </div>
                      <p className="text-[11px] text-[#767676] mt-0.5">{quad.subtitle}</p>

                      <div className="space-y-2 mt-3">
                        {quad.items.length === 0 ? (
                          <p className="text-xs text-[#999999] py-4 text-center bg-white rounded-xl border border-dashed border-[#EAEAEA]">
                            Nenhum produto classificado neste quadrante para o filtro/período atual.
                          </p>
                        ) : (
                          quad.items.map((item) => (
                            <Link
                              key={item.product.id}
                              to={`/admin/produtos/${item.product.id}/editar`}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EAEAEA] hover:border-[#111111] transition-colors gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.product.name}
                                    className="w-10 h-10 rounded-lg object-contain bg-white border border-[#F0F0F0] shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-[#F4F4F4] flex items-center justify-center text-[#999999] shrink-0">
                                    <Package size={16} />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#111111] truncate">
                                    {item.product.name}
                                  </p>
                                  <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-[#767676] mt-0.5">
                                    <span className="font-semibold text-[#111111]">
                                      {item.soldInPeriod} vend.
                                    </span>
                                    <span>• {item.clicks} cliques</span>
                                    <span>• {item.views} views</span>
                                    <span>• Est: {item.stock} un.</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={cn(
                                    'inline-block text-[10px] font-bold px-2 py-0.5 rounded-md',
                                    quad.badgeClass
                                  )}
                                >
                                  Margem {item.marginPct}%
                                </span>
                                {item.unitMarginValue !== null && (
                                  <p className="text-[10px] font-semibold text-[#166534] tabular-nums mt-0.5">
                                    +{formatBRL(item.unitMarginValue)}/un.
                                  </p>
                                )}
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 5º Grupo: Produtos Não Classificados por Dados Insuficientes (Sem Custo ou Sem Estoque) */}
              {dashboardData.insufficientDataProducts.length > 0 && (
                <div className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAF8] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                        <Info size={14} className="text-[#92400E]" />
                        Produtos Não Classificados na Matriz ({dashboardData.insufficientDataProducts.length})
                      </p>
                      <p className="text-[11px] text-[#767676]">
                        Estes produtos não foram incluídos nos quadrantes acima porque estão sem preço de custo cadastrado ou sem estoque disponível (evitando distorcer o grupo de Baixo Giro).
                      </p>
                    </div>
                    <Link
                      to="/admin/estoque"
                      className="text-xs font-bold text-[#111111] underline shrink-0"
                    >
                      Completar Custos e Estoque →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {dashboardData.insufficientDataProducts.slice(0, 8).map((item) => (
                      <Link
                        key={item.product.id}
                        to={`/admin/produtos/${item.product.id}/editar`}
                        className="p-2.5 rounded-xl bg-white border border-[#EAEAEA] hover:border-[#111111] flex items-center justify-between gap-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111111] truncate">
                            {item.product.name}
                          </p>
                          <p className="text-[10px] text-[#92400E] font-medium">
                            {!item.hasCost ? 'Sem custo cadastrado' : 'Estoque zerado (0 un.)'}
                          </p>
                        </div>
                        <ArrowRight size={13} className="text-[#999999] shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODELO 6: INTELIGÊNCIA COMERCIAL & RANKINGS (ETAPA 9) */}
          {chartMode === 'intelligence' && (
            <div className="pt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* 1. Mais Vendidos */}
                <div className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAF8] p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-[#111111]">Top Produtos Mais Vendidos</p>
                    <p className="text-[11px] text-[#767676]">Unidades vendidas no histórico</p>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.topSoldProducts.length === 0 ? (
                      <p className="text-xs text-[#999999] py-3">Nenhuma venda registrada ainda.</p>
                    ) : (
                      dashboardData.topSoldProducts.map((item, idx) => (
                        <Link
                          key={item.product.id}
                          to={`/admin/produtos/${item.product.id}/editar`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EAEAEA] hover:border-[#111111] text-xs"
                        >
                          <span className="font-semibold text-[#111111] truncate pr-2">
                            {idx + 1}. {item.product.name}
                          </span>
                          <span className="font-bold text-[#166534] shrink-0 tabular-nums">
                            {item.soldAllTime} un.
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Mais Clicados & Visualizados */}
                <div className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAF8] p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-[#111111]">Mais Clicados & Visualizados</p>
                    <p className="text-[11px] text-[#767676]">Interesse na vitrine e WhatsApp</p>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.topClickedAndViewed.length === 0 ? (
                      <p className="text-xs text-[#999999] py-3">Sem interações registradas ainda.</p>
                    ) : (
                      dashboardData.topClickedAndViewed.map((item, idx) => (
                        <Link
                          key={item.product.id}
                          to={`/admin/produtos/${item.product.id}/editar`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EAEAEA] hover:border-[#111111] text-xs"
                        >
                          <span className="font-semibold text-[#111111] truncate pr-2">
                            {idx + 1}. {item.product.name}
                          </span>
                          <span className="font-bold text-[#111111] shrink-0 tabular-nums text-[11px]">
                            {item.clicks} cliq · {item.views} views
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. Maior Margem Real */}
                <div className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAF8] p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-[#111111]">Maior Margem Bruta Real</p>
                    <p className="text-[11px] text-[#767676]">Apenas itens com custo cadastrado</p>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.topMarginProducts.length === 0 ? (
                      <p className="text-xs text-[#999999] py-3">Cadastre custos para ver o ranking.</p>
                    ) : (
                      dashboardData.topMarginProducts.map((item, idx) => (
                        <Link
                          key={item.product.id}
                          to={`/admin/produtos/${item.product.id}/editar`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EAEAEA] hover:border-[#111111] text-xs"
                        >
                          <span className="font-semibold text-[#111111] truncate pr-2">
                            {idx + 1}. {item.product.name}
                          </span>
                          <span className="font-bold text-[#166534] shrink-0 tabular-nums">
                            {item.marginPct}% (+{formatBRL(item.unitMarginValue || 0)})
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                {/* 4. Capital Parado / Sem Giro */}
                <div className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAF8] p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-[#111111]">Estoque Parado (Sem Vendas)</p>
                    <p className="text-[11px] text-[#767676]">Ordenado por maior capital em estoque</p>
                  </div>
                  <div className="space-y-2">
                    {dashboardData.stagnantStockProducts.length === 0 ? (
                      <p className="text-xs text-[#999999] py-3">Nenhum produto parado em estoque.</p>
                    ) : (
                      dashboardData.stagnantStockProducts.map((item, idx) => (
                        <Link
                          key={item.product.id}
                          to={`/admin/produtos/${item.product.id}/editar`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EAEAEA] hover:border-[#111111] text-xs"
                        >
                          <span className="font-semibold text-[#111111] truncate pr-2">
                            {idx + 1}. {item.product.name}
                          </span>
                          <span className="font-bold text-[#92400E] shrink-0 tabular-nums">
                            {item.stock} un. ({formatBRL(item.stockSaleValue)})
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODELO 5: MEIOS DE PAGAMENTO */}
          {chartMode === 'payments' && (
            <div className="pt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#111111]">
                    Receita por Meio de Pagamento e Desconto de Taxas ({dashboardData.periodLabel})
                  </h3>
                  <p className="text-xs text-[#767676]">
                    Valores consolidados a partir das vendas lançadas no PDV no período selecionado.
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

        {/* ── 4. INTEGRIDADE DO CATÁLOGO, MOVIMENTAÇÕES RECENTES & ACESSO RÁPIDO ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Integridade da Vitrine */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-[#EAEAEA] p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111111]">
                Integridade do Cadastro ({dashboardData.healthScore}%)
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
                  <CheckCircle2 size={14} className="text-[#166534]" /> Produtos com preço de venda
                </span>
                <strong className="text-[#111111] tabular-nums">
                  {dashboardData.withPriceCount}/{products.length}
                </strong>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA]">
                <span className="text-[#242424] font-medium flex items-center gap-2">
                  <CheckCircle2
                    size={14}
                    className={
                      dashboardData.withCostCount === products.length
                        ? 'text-[#166534]'
                        : 'text-[#D97706]'
                    }
                  />{' '}
                  Produtos com custo cadastrado
                </span>
                <strong className="text-[#111111] tabular-nums">
                  {dashboardData.withCostCount}/{products.length}
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

          {/* Movimentações Recentes de Estoque e Vendas */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-[#EAEAEA] p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#111111]">Movimentações Recentes</h2>
                <p className="text-xs text-[#767676] mt-0.5">
                  Últimas operações de estoque e vendas.
                </p>
              </div>
              <Link to="/admin/estoque" className="text-xs font-bold text-[#111111] hover:underline">
                Ver histórico →
              </Link>
            </div>

            <div className="space-y-2 flex-1">
              {dashboardData.recentMovements.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center py-8 text-xs text-[#999999] bg-[#FAFAF8] rounded-xl border border-dashed border-[#EAEAEA]">
                  Nenhuma movimentação registrada ainda.
                </div>
              ) : (
                dashboardData.recentMovements.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA] text-xs gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#111111] truncate">{mov.productName}</p>
                      <p className="text-[10px] text-[#767676] truncate">
                        {mov.type === 'sale'
                          ? 'Venda PDV'
                          : mov.type === 'in'
                            ? 'Entrada'
                            : mov.type === 'out'
                              ? 'Baixa/Saída'
                              : 'Ajuste'}{' '}
                        · {new Date(mov.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          'font-bold tabular-nums px-2 py-0.5 rounded-md text-[11px]',
                          mov.type === 'in'
                            ? 'bg-[#F0FDF4] text-[#166534]'
                            : mov.type === 'sale'
                              ? 'bg-[#111111] text-white'
                              : 'bg-[#FFFBEB] text-[#92400E]'
                        )}
                      >
                        {mov.type === 'in' ? `+${mov.quantity}` : `-${mov.quantity}`} un.
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Acesso Rápido aos Módulos */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-[#EAEAEA] p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-[#111111]">Acesso Rápido aos Módulos</h2>
              <p className="text-xs text-[#767676] mt-0.5 mb-4">
                Atalhos diretos para gestão diária da loja.
              </p>

              <div className="space-y-2.5">
                <Link
                  to="/admin/financeiro"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#111111] text-white flex items-center justify-center shrink-0">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">Financeiro, DRE & PDV</p>
                      <p className="text-[11px] text-[#767676]">
                        Fluxo de caixa, despesas e vendas
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-[#999999] group-hover:text-[#111111] transition-colors"
                  />
                </Link>

                <Link
                  to="/admin/estoque"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                      <Boxes size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">Controle de Estoque & Custos</p>
                      <p className="text-[11px] text-[#767676]">
                        Entradas, margem real e Curva ABC
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-[#999999] group-hover:text-[#111111] transition-colors"
                  />
                </Link>

                <Link
                  to="/admin/produtos"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                      <ShoppingBag size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">Catálogo de Produtos & SKU</p>
                      <p className="text-[11px] text-[#767676]">
                        Edição rápida, fotos e disponibilidade
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-[#999999] group-hover:text-[#111111] transition-colors"
                  />
                </Link>

                <Link
                  to="/admin/configuracoes"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAEAEA] hover:border-[#111111] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                      <Settings size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">Identidade Visual & WhatsApp</p>
                      <p className="text-[11px] text-[#767676]">
                        Banner principal, logotipo e atendimento
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-[#999999] group-hover:text-[#111111] transition-colors"
                  />
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
