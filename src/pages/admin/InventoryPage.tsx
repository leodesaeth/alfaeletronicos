import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Boxes,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  History,
  Search,
  DollarSign,
  Package,
  TrendingUp,
  PieChart,
  Wallet,
  Download,
  Trash2,
  Tag,
  ShieldAlert,
  Gift,
  CheckCircle2,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { getAllProducts, updateProduct } from '@/services/products'
import {
  getAllProductMeta,
  getStockMovements,
  registerStockMovement,
  updateProductMeta,
  getStoreExpenses,
  addStoreExpense,
  deleteStoreExpense,
  type ProductMetaMap,
  type StockMovement,
  type StockMovementType,
  type StockMovementReason,
  type PaymentMethod,
  type StoreExpense,
} from '@/services/catalogIntelligence'
import type { Product } from '@/types'
import { formatBRL, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/StateComponents'
import toast from 'react-hot-toast'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  other: 'Outro',
}

const EXPENSE_CATEGORY_LABELS: Record<StoreExpense['category'], string> = {
  fixa: 'Custo Fixo (Aluguel, Luz, Internet)',
  fornecedor: 'Fornecedor / Boleto de Mercadoria',
  marketing: 'Marketing / Tráfego Pago',
  logistica: 'Motoboy / Frete / Embalagens',
  variavel: 'Despesa Variável / Comissão',
  impostos: 'Impostos / Taxas',
}

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [metaMap, setMetaMap] = useState<ProductMetaMap>({})
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [expenses, setExpenses] = useState<StoreExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inventory' | 'financial' | 'abc' | 'history'>(
    'inventory'
  )
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'critical' | 'zero' | 'unset'>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Edição inline de Preço de Custo na tabela
  const [editingCostId, setEditingCostId] = useState<string | null>(null)
  const [costDraft, setCostDraft] = useState('')

  // Modal de Movimentação Financeira e de Estoque
  const [modalProduct, setModalProduct] = useState<Product | null>(null)
  const [movType, setMovType] = useState<StockMovementType>('out')
  const [movReason, setMovReason] = useState<StockMovementReason>('sale')
  const [movPayment, setMovPayment] = useState<PaymentMethod>('pix')
  const [movQty, setMovQty] = useState('1')
  const [movUnitCost, setMovUnitCost] = useState('')
  const [movSupplier, setMovSupplier] = useState('')
  const [movResponsible, setMovResponsible] = useState('Admin Alfa')
  const [movNote, setMovNote] = useState('')
  const [movSaving, setMovSaving] = useState(false)

  // Formulário de Nova Despesa (Aba Financeiro / DRE)
  const [expDesc, setExpDesc] = useState('')
  const [expCategory, setExpCategory] = useState<StoreExpense['category']>('fixa')
  const [expAmount, setExpAmount] = useState('')
  const [expSaving, setExpSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, metas, movs, exps] = await Promise.all([
        getAllProducts(),
        getAllProductMeta(),
        getStockMovements(),
        getStoreExpenses(),
      ])
      setProducts(prods)
      setMetaMap({ ...metas })
      setMovements(movs)
      setExpenses(exps)
    } catch {
      toast.error('Erro ao carregar estoque e dados financeiros.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Salvar Preço de Custo inline na tabela
  const handleInlineCostSave = async (product: Product) => {
    setEditingCostId(null)
    const clean = costDraft.replace(',', '.').trim()
    const num = clean ? parseFloat(clean) : null
    if (clean && (isNaN(num!) || num! < 0)) {
      toast.error('Custo inválido.')
      return
    }
    try {
      const updated = await updateProductMeta(product.id, { cost_price: num })
      setMetaMap((prev) => ({ ...prev, [product.id]: updated }))
      toast.success(`Custo de "${product.name}" atualizado!`)
    } catch {
      toast.error('Erro ao salvar custo.')
    }
  }

  // Movimentação rápida (+1 Entrada ou -1 Venda) direto na linha
  const handleQuickMove = async (
    product: Product,
    type: 'in' | 'out',
    qty: number = 1,
    reason?: StockMovementReason,
    note?: string
  ) => {
    const currentMeta = metaMap[product.id] || {}
    const currentStock = currentMeta.stock_quantity ?? 0
    if (type === 'out' && qty > currentStock) {
      toast.error(`Estoque insuficiente (${currentStock} un. disponíveis).`)
      return
    }

    setProcessingId(product.id)
    try {
      const unitPrice = product.price ?? 0
      const unitCost =
        typeof currentMeta.cost_price === 'number' && currentMeta.cost_price > 0
          ? currentMeta.cost_price
          : 0

      const { newStock, movement, marginWarning } = await registerStockMovement({
        productId: product.id,
        productName: product.name,
        type,
        reason: reason || (type === 'out' ? 'sale' : 'restock'),
        paymentMethod: type === 'out' ? 'pix' : undefined,
        quantity: qty,
        unitPrice,
        unitCost,
        responsible: 'Admin Alfa',
        note:
          note ||
          (type === 'out' ? 'Venda rápida (-1 un. via PIX)' : 'Reposição rápida (+1 un.)'),
      })

      const freshMeta = await getAllProductMeta()
      setMetaMap({ ...freshMeta })
      setMovements((prev) => [movement, ...prev])

      if (marginWarning) {
        toast(marginWarning, { icon: '⚠️', duration: 6000 })
      }

      if (newStock === 0) {
        toast.error(`Estoque de "${product.name}" zerou! Marcado como Indisponível.`)
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, availability: 'unavailable' } : p))
        )
      } else {
        const profitMsg =
          type === 'out' && movement.profit_value !== undefined
            ? ` (Lucro: +${formatBRL(movement.profit_value)})`
            : ''
        toast.success(
          `${type === 'in' ? 'Entrada' : 'Venda'} registrada! Saldo: ${newStock} un.${profitMsg}`
        )
        if (product.availability === 'unavailable') {
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? { ...p, availability: 'available' } : p))
          )
        }
      }
    } catch {
      toast.error('Erro ao registrar movimentação.')
    } finally {
      setProcessingId(null)
    }
  }

  // Salvar movimentação detalhada pelo modal
  const handleSaveModalMovement = async () => {
    if (!modalProduct) return
    const qty = parseInt(movQty, 10)
    if (isNaN(qty) || qty < 0 || (movType !== 'adjustment' && qty === 0)) {
      toast.error('Informe uma quantidade válida.')
      return
    }

    const currentMeta = metaMap[modalProduct.id] || {}
    const currentStock = currentMeta.stock_quantity ?? 0
    if (movType === 'out' && qty > currentStock) {
      toast.error(
        `Operação bloqueada: saldo insuficiente (${currentStock} un. em estoque para retirar ${qty} un.).`
      )
      return
    }

    setMovSaving(true)
    try {
      const parsedCost = movUnitCost.replace(',', '.').trim()
        ? parseFloat(movUnitCost.replace(',', '.').trim())
        : currentMeta.cost_price ?? 0

      const { marginWarning } = await registerStockMovement({
        productId: modalProduct.id,
        productName: modalProduct.name,
        type: movType,
        reason: movReason,
        paymentMethod: movReason === 'sale' ? movPayment : undefined,
        quantity: qty,
        unitPrice: modalProduct.price ?? 0,
        unitCost: parsedCost > 0 ? parsedCost : 0,
        supplier: movSupplier,
        responsible: movResponsible.trim() || 'Admin Alfa',
        note: movNote,
      })

      if (marginWarning) {
        toast(marginWarning, { icon: '⚠️', duration: 6000 })
      }
      toast.success('Movimentação registrada com sucesso!')
      setModalProduct(null)
      setMovQty('1')
      setMovNote('')
      await loadData()
    } catch {
      toast.error('Erro ao salvar movimentação.')
    } finally {
      setMovSaving(false)
    }
  }

  // Adicionar despesa operacional (DRE)
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(expAmount.replace(',', '.').trim())
    if (!expDesc.trim() || isNaN(val) || val <= 0) {
      toast.error('Preencha a descrição e um valor válido.')
      return
    }
    setExpSaving(true)
    try {
      const next = await addStoreExpense({
        description: expDesc,
        category: expCategory,
        amount: val,
      })
      setExpenses(next)
      setExpDesc('')
      setExpAmount('')
      toast.success('Despesa lançada no DRE!')
    } catch {
      toast.error('Erro ao lançar despesa.')
    } finally {
      setExpSaving(false)
    }
  }

  const handleRemoveExpense = async (id: string) => {
    const next = await deleteStoreExpense(id)
    setExpenses(next)
    toast.success('Despesa removida.')
  }

  // Criar promoção automática (-10% OFF) para desencalhar Capital Parado
  const handleCreatePromoForStagnant = async (product: Product) => {
    if (!product.price || product.price <= 0) return
    const oldPrice = product.price
    const promoPrice = Math.round(oldPrice * 0.9 * 100) / 100
    try {
      await updateProduct(product.id, { price: String(promoPrice) })
      await updateProductMeta(product.id, { compare_at_price: oldPrice })
      toast.success(
        `Promoção aplicada em "${product.name}": De ${formatBRL(oldPrice)} por ${formatBRL(promoPrice)} (-10% OFF)!`
      )
      await loadData()
    } catch {
      toast.error('Erro ao aplicar promoção.')
    }
  }

  // Exportar Balanço Financeiro e Inventário Completo em CSV
  const handleExportFinancialCsv = () => {
    const header =
      'Produto;SKU;Categoria;Estoque Atual;Preco Custo (R$);Preco Venda (R$);Margem Unitaria (R$);Margem (%);Capital Investido (R$);Valor Venda Total (R$);Lucro Projetado (R$);Vendas Realizadas (Un);Cliques WhatsApp\n'
    const rows = products
      .map((p) => {
        const m = metaMap[p.id] || {}
        const stock = m.stock_quantity ?? 0
        const hasCost = typeof m.cost_price === 'number' && m.cost_price > 0
        const cost = hasCost ? m.cost_price! : 0
        const price = p.price ?? 0
        const unitProfit = hasCost && price > 0 ? price - cost : 0
        const marginPct =
          hasCost && price > 0 ? ((unitProfit / price) * 100).toFixed(1) + '%' : 'Sem custo'
        const totalCost = (cost * stock).toFixed(2).replace('.', ',')
        const totalSale = (price * stock).toFixed(2).replace('.', ',')
        const totalProfit = (unitProfit * stock).toFixed(2).replace('.', ',')

        return `${p.name};${m.sku || ''};${p.category?.name || ''};${stock};${hasCost ? cost.toFixed(2).replace('.', ',') : 'Nao informado'};${price.toFixed(2).replace('.', ',')};${hasCost ? unitProfit.toFixed(2).replace('.', ',') : '—'};${marginPct};${totalCost};${totalSale};${totalProfit};${m.total_units_sold || 0};${m.whatsapp_clicks || 0}`
      })
      .join('\n')

    const blob = new Blob(['\uFEFF' + header + rows], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balanco-estoque-financeiro-alfa-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <AdminLayout>
        <PageLoader />
      </AdminLayout>
    )
  }

  // ── Cálculos Financeiros, DRE, Curva ABC e Alertas (Sem custos fictícios) ───
  let totalUnits = 0
  let totalCostInvested = 0 // Capital imobilizado real a preço de custo cadastrado
  let totalSalePotential = 0 // Faturamento potencial do estoque atual
  let totalSalePotentialWithCost = 0
  let lowStockCount = 0
  let zeroStockCount = 0
  let withoutCostCount = 0

  interface SmartAlert {
    id: string
    level: 'critical' | 'warning' | 'demand' | 'margin'
    title: string
    description: string
    product: Product
  }

  const smartAlerts: SmartAlert[] = []

  for (const p of products) {
    const meta = metaMap[p.id] || {}
    const stock = meta.stock_quantity ?? 0
    const minAlert = meta.low_stock_threshold ?? 2
    const clicks = meta.whatsapp_clicks ?? 0
    const price = p.price ?? 0
    const hasCost = typeof meta.cost_price === 'number' && meta.cost_price > 0
    const cost = hasCost ? meta.cost_price! : null

    if (!hasCost) {
      withoutCostCount++
    }

    totalUnits += stock
    totalSalePotential += price * stock
    if (cost !== null) {
      totalCostInvested += cost * stock
      totalSalePotentialWithCost += price * stock
    }

    // Alerta de margem comprimida (< 20%) — apenas quando o custo foi cadastrado
    if (price > 0 && cost !== null) {
      const marginPct = ((price - cost) / price) * 100
      if (marginPct < 20) {
        smartAlerts.push({
          id: `margin-${p.id}`,
          level: 'margin',
          title: `Margem baixa (${marginPct.toFixed(0)}%): ${p.name}`,
          description: `Custo real: ${formatBRL(cost)} · Venda: ${formatBRL(price)}. Considere reajustar o preço.`,
          product: p,
        })
      }
    }

    if (stock === 0) {
      zeroStockCount++
      smartAlerts.push({
        id: `zero-${p.id}`,
        level: 'critical',
        title: `${p.name} está ESGOTADO (0 un.)`,
        description:
          clicks > 0
            ? `Teve ${clicks} procura(s) no WhatsApp. Reponha para não perder vendas!`
            : 'Produto marcado como Indisponível na vitrine.',
        product: p,
      })
    } else if (stock <= minAlert) {
      lowStockCount++
      if (clicks >= 2) {
        smartAlerts.push({
          id: `demand-${p.id}`,
          level: 'demand',
          title: `Alta procura e fim de estoque: ${p.name}`,
          description: `Restam apenas ${stock} un. e já recebeu ${clicks} cliques no WhatsApp!`,
          product: p,
        })
      } else {
        smartAlerts.push({
          id: `low-${p.id}`,
          level: 'warning',
          title: `Estoque baixo: ${p.name} (${stock} un.)`,
          description: `Atingiu o estoque mínimo de segurança (${minAlert} un.).`,
          product: p,
        })
      }
    }
  }

  const projectedStockProfit = Math.max(0, totalSalePotentialWithCost - totalCostInvested)
  const avgStockMarginPct =
    totalSalePotentialWithCost > 0
      ? (projectedStockProfit / totalSalePotentialWithCost) * 100
      : 0

  // Cálculo do DRE a partir das movimentações e despesas registradas
  let grossSalesRevenue = 0
  let totalCMV = 0
  let warrantyAndLossesCost = 0
  const salesByPayment: Record<PaymentMethod, number> = {
    pix: 0,
    credit_card: 0,
    debit_card: 0,
    cash: 0,
    other: 0,
  }

  for (const mov of movements) {
    if (mov.reason === 'sale' || (mov.type === 'out' && !mov.reason)) {
      const rev = mov.total_value ?? 0
      const cmv = (mov.unit_cost ?? 0) * mov.quantity
      grossSalesRevenue += rev
      totalCMV += cmv
      const pm = mov.payment_method || 'pix'
      salesByPayment[pm] = (salesByPayment[pm] || 0) + rev
    } else if (
      mov.reason === 'warranty' ||
      mov.reason === 'loss' ||
      mov.reason === 'gift'
    ) {
      warrantyAndLossesCost += (mov.unit_cost ?? 0) * mov.quantity
    }
  }

  const grossProfitFromSales = grossSalesRevenue - totalCMV
  const totalOperatingExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)
  const netRealProfit =
    grossProfitFromSales - warrantyAndLossesCost - totalOperatingExpenses

  // Curva ABC e Radar de Capital Parado
  const productsWithMetrics = products.map((p) => {
    const m = metaMap[p.id] || {}
    const stock = m.stock_quantity ?? 0
    const price = p.price ?? 0
    const cost = typeof m.cost_price === 'number' && m.cost_price > 0 ? m.cost_price : 0
    const sold = m.total_units_sold ?? 0
    const clicks = m.whatsapp_clicks ?? 0
    const capitalLocked = cost > 0 ? cost * stock : price * stock
    const score = sold * 10 + clicks * 3
    return {
      product: p,
      stock,
      price,
      cost,
      sold,
      clicks,
      capitalLocked,
      score,
    }
  })

  const curveA = [...productsWithMetrics]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  const stagnantItems = productsWithMetrics.filter(
    (item) => item.stock >= 5 && item.sold === 0 && item.clicks <= 1
  )
  const totalStagnantCapital = stagnantItems.reduce(
    (acc, item) => acc + item.capitalLocked,
    0
  )

  const filteredProducts = products.filter((p) => {
    const meta = metaMap[p.id]
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (meta?.sku && meta.sku.toLowerCase().includes(search.toLowerCase()))
    const stock = meta?.stock_quantity ?? 0
    const min = meta?.low_stock_threshold ?? 2
    const hasCost = typeof meta?.cost_price === 'number' && meta.cost_price > 0

    if (!matchSearch) return false
    if (stockFilter === 'zero') return stock === 0
    if (stockFilter === 'critical') return stock > 0 && stock <= min
    if (stockFilter === 'unset') return !hasCost
    return true
  })

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 w-full max-w-[1600px]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
              Estoque, Custos & Inteligência Financeira
            </h1>
            <p className="text-sm text-[#767676] mt-0.5">
              Controle de lotes, margem bruta real, ajustes de inventário, Curva ABC e histórico auditável.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {withoutCostCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('inventory')
                  setStockFilter(stockFilter === 'unset' ? 'all' : 'unset')
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs font-bold text-[#92400E] hover:border-[#F59E0B] transition-colors"
              >
                <AlertTriangle size={14} />
                {withoutCostCount} item(ns) sem custo cadastrado
              </button>
            )}
            <Button
              variant="secondary"
              icon={<Download size={15} />}
              onClick={handleExportFinancialCsv}
            >
              Exportar Balanço (Excel/CSV)
            </Button>
          </div>
        </div>

        {/* 6 KPIs Executivos (Estoque + Financeiro) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 flex flex-col gap-1.5 shadow-card">
            <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
              <Boxes size={16} />
            </div>
            <p className="text-lg font-extrabold text-[#111111] tabular-nums">
              {totalUnits} un.
            </p>
            <p className="text-[11px] font-medium text-[#767676]">Unidades no estoque</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 flex flex-col gap-1.5 shadow-card">
            <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
              <Wallet size={16} />
            </div>
            <p className="text-lg font-extrabold text-[#111111] tabular-nums">
              {formatBRL(totalCostInvested)}
            </p>
            <p className="text-[11px] font-medium text-[#767676]">
              Capital investido (Custo)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 flex flex-col gap-1.5 shadow-card">
            <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
              <DollarSign size={16} />
            </div>
            <p className="text-lg font-extrabold text-[#111111] tabular-nums">
              {formatBRL(totalSalePotential)}
            </p>
            <p className="text-[11px] font-medium text-[#767676]">
              Valor de venda em estoque
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 flex flex-col gap-1.5 shadow-card">
            <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] text-[#166534] flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <p className="text-lg font-extrabold text-[#166534] tabular-nums">
              +{formatBRL(projectedStockProfit)}
            </p>
            <p className="text-[11px] font-medium text-[#767676]">
              Lucro projetado ({avgStockMarginPct.toFixed(0)}%)
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('financial')}
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#111111] p-4 flex flex-col gap-1.5 text-left shadow-card transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center">
              <PieChart size={16} />
            </div>
            <p
              className={cn(
                'text-lg font-extrabold tabular-nums',
                netRealProfit >= 0 ? 'text-[#111111]' : 'text-[#991B1B]'
              )}
            >
              {formatBRL(netRealProfit)}
            </p>
            <p className="text-[11px] font-medium text-[#767676]">
              Lucro líquido real (DRE)
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('inventory')
              setStockFilter(stockFilter === 'critical' ? 'all' : 'critical')
            }}
            className={cn(
              'bg-white rounded-2xl border p-4 flex flex-col gap-1.5 text-left transition-all shadow-card',
              lowStockCount + zeroStockCount > 0
                ? 'border-[#FDE68A] bg-[#FFFBEB]/40'
                : 'border-[#EAEAEA]'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] text-[#92400E] flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
            <p className="text-lg font-extrabold text-[#111111] tabular-nums">
              {lowStockCount + zeroStockCount}
            </p>
            <p className="text-[11px] font-medium text-[#767676]">
              Em alerta / Esgotados
            </p>
          </button>
        </div>

        {/* Central de Alertas Inteligentes (Estoque, Demanda e Margem) */}
        {smartAlerts.length > 0 ? (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-5 shadow-card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-[#92400E]" />
                Alertas Inteligentes de Estoque & Margem ({smartAlerts.length})
              </h2>
              <span className="text-xs text-[#767676]">
                Monitoramento em tempo real de giro, margem e ruptura
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {smartAlerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'rounded-xl border p-3.5 flex items-center justify-between gap-3',
                    alert.level === 'critical' && 'bg-[#FEF2F2] border-[#FECACA]',
                    alert.level === 'demand' && 'bg-[#FFFBEB] border-[#FDE68A]',
                    alert.level === 'margin' && 'bg-[#FAFAF8] border-[#E5E5E5]',
                    alert.level === 'warning' && 'bg-[#FAFAF8] border-[#E5E5E5]'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#111111] truncate">{alert.title}</p>
                    <p className="text-[11px] text-[#555555] mt-0.5 leading-snug">
                      {alert.description}
                    </p>
                  </div>
                  {alert.level === 'margin' ? (
                    <Link
                      to={`/admin/produtos/${alert.product.id}/editar`}
                      className="shrink-0 text-xs font-bold bg-[#111111] hover:bg-[#242424] text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Ajustar
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickMove(
                          alert.product,
                          'in',
                          5,
                          'restock',
                          'Reposição rápida (+5 un.)'
                        )
                      }
                      className="shrink-0 text-xs font-bold bg-[#111111] hover:bg-[#242424] text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      +5 un.
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#166534]">
            <CheckCircle2 size={16} />
            Estoque e margens de lucro operando dentro dos parâmetros saudáveis!
          </div>
        )}

        {/* Navegação entre as 4 Abas (Deslizante no Mobile) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAEAEA] pb-3">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0',
                activeTab === 'inventory'
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
              )}
            >
              <Boxes size={14} />
              Estoque & Margem
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('financial')}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0',
                activeTab === 'financial'
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
              )}
            >
              <PieChart size={14} />
              DRE & Despesas
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('abc')}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0',
                activeTab === 'abc'
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
              )}
            >
              <TrendingUp size={14} />
              Curva ABC
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0',
                activeTab === 'history'
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
              )}
            >
              <History size={14} />
              Histórico ({movements.length})
            </button>
          </div>

          {activeTab === 'inventory' && (
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-[#EAEAEA] rounded-xl px-3 py-1.5">
                <Search size={14} className="text-[#767676] shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="text-xs text-[#111111] outline-none w-full sm:w-40"
                />
              </div>

              <select
                value={stockFilter}
                onChange={(e) =>
                  setStockFilter(e.target.value as 'all' | 'critical' | 'zero' | 'unset')
                }
                className="bg-white border border-[#EAEAEA] rounded-xl px-3 py-1.5 text-xs font-medium text-[#242424] outline-none"
              >
                <option value="all">Todos os níveis</option>
                <option value="critical">Estoque baixo / Crítico</option>
                <option value="zero">Esgotados (0 un.)</option>
                <option value="unset">Sem custo cadastrado</option>
              </select>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            ABA 1: POSIÇÃO DE ESTOQUE, CUSTOS E MARGEM
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-100 bg-[#FAFAF8]">
                    <th className="px-4 py-3 text-xs font-semibold text-[#767676]">Produto</th>
                    <th className="px-3 py-3 text-xs font-semibold text-[#767676]">
                      Custo Unit. (Clique p/ editar)
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[#767676] hidden sm:table-cell">
                      Venda Unit.
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[#767676] hidden md:table-cell">
                      Lucro / Margem Real
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-[#767676]">
                      Saldo Atual
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-[#767676] text-right">
                      Baixa de Venda / Lote
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredProducts.map((product) => {
                    const meta = metaMap[product.id] || {}
                    const stock = meta.stock_quantity ?? 0
                    const min = meta.low_stock_threshold ?? 2
                    const price = product.price ?? 0
                    const hasCost =
                      typeof meta.cost_price === 'number' && meta.cost_price > 0
                    const cost = hasCost ? meta.cost_price! : null
                    const unitProfit = hasCost && price > 0 ? price - cost! : null
                    const marginPct =
                      hasCost && price > 0 && unitProfit !== null
                        ? (unitProfit / price) * 100
                        : null

                    const primaryImg =
                      product.product_images?.find((i) => i.is_primary) ||
                      product.product_images?.[0]

                    const isZero = stock === 0
                    const isLow = stock > 0 && stock <= min

                    return (
                      <tr key={product.id} className="hover:bg-[#FAFAF8] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white border border-[#EAEAEA] overflow-hidden shrink-0">
                              {primaryImg?.public_url ? (
                                <img
                                  src={primaryImg.public_url}
                                  alt={product.name}
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package size={16} className="text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/admin/produtos/${product.id}/editar`}
                                className="text-sm font-semibold text-[#111111] hover:underline truncate block max-w-[240px]"
                              >
                                {product.name}
                              </Link>
                              <span className="text-[11px] text-[#767676]">
                                {meta.sku ? `SKU: ${meta.sku} · ` : ''}
                                {meta.supplier
                                  ? `Forn: ${meta.supplier}`
                                  : product.category?.name || 'Sem categoria'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Custo Editável Inline */}
                        <td className="px-3 py-3">
                          {editingCostId === product.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={costDraft}
                              onChange={(e) => setCostDraft(e.target.value)}
                              onBlur={() => handleInlineCostSave(product)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleInlineCostSave(product)
                                if (e.key === 'Escape') setEditingCostId(null)
                              }}
                              className="w-24 px-2 py-1 text-xs font-bold border border-[#111111] rounded-lg outline-none"
                              placeholder="Ex: 120,00"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCostId(product.id)
                                setCostDraft(cost !== null ? String(cost) : '')
                              }}
                              title="Clique para definir ou alterar o preço de custo"
                              className={cn(
                                'text-xs font-semibold px-2 py-1 -mx-2 rounded-lg transition-colors tabular-nums',
                                cost !== null
                                  ? 'text-[#555555] hover:text-[#111111] hover:bg-gray-100'
                                  : 'text-[#92400E] bg-[#FFFBEB] hover:bg-[#FEF3C7]'
                              )}
                            >
                              {cost !== null ? formatBRL(cost) : '+ Definir custo'}
                            </button>
                          )}
                        </td>

                        {/* Preço de Venda */}
                        <td className="px-3 py-3 hidden sm:table-cell text-xs font-bold text-[#111111] tabular-nums">
                          {price > 0 ? formatBRL(price) : '—'}
                        </td>

                        {/* Lucro Unitário e Margem % Real */}
                        <td className="px-3 py-3 hidden md:table-cell">
                          {price > 0 && unitProfit !== null && marginPct !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'text-xs font-bold tabular-nums',
                                  unitProfit >= 0 ? 'text-[#166534]' : 'text-red-600'
                                )}
                              >
                                {unitProfit >= 0 ? '+' : ''}
                                {formatBRL(unitProfit)}
                              </span>
                              <span
                                className={cn(
                                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
                                  marginPct >= 30 && 'bg-[#F0FDF4] text-[#166534]',
                                  marginPct >= 20 && marginPct < 30 && 'bg-amber-50 text-amber-800',
                                  marginPct < 20 && 'bg-red-50 text-red-700'
                                )}
                              >
                                {marginPct.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-[#999999]">
                              Sem custo
                            </span>
                          )}
                        </td>

                        {/* Saldo em Estoque */}
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full tabular-nums',
                              isZero && 'bg-red-100 text-red-700',
                              isLow && 'bg-amber-100 text-amber-800',
                              !isZero && !isLow && 'bg-[#F0FDF4] text-[#166534]'
                            )}
                          >
                            {stock} un.
                          </span>
                        </td>

                        {/* Ações Rápidas */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={processingId === product.id || stock <= 0}
                              onClick={() => handleQuickMove(product, 'out', 1, 'sale')}
                              title="Registrar 1 venda rápida (PIX)"
                              className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#24A850]/10 hover:bg-[#24A850] text-[#166534] hover:text-white px-2.5 py-1.5 rounded-lg disabled:opacity-35 transition-colors"
                            >
                              <Minus size={11} /> 1 Venda
                            </button>

                            <button
                              type="button"
                              disabled={processingId === product.id}
                              onClick={() => handleQuickMove(product, 'in', 1, 'restock')}
                              title="Adicionar 1 unidade ao estoque"
                              className="w-7 h-7 rounded-lg border border-[#E0E0E0] hover:border-[#111111] flex items-center justify-center text-[#242424] disabled:opacity-35 transition-colors"
                            >
                              <Plus size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setModalProduct(product)
                                setMovType('out')
                                setMovReason('sale')
                                setMovQty('1')
                                setMovUnitCost(cost !== null ? String(cost) : '')
                                setMovSupplier(meta.supplier || '')
                                setMovNote('')
                              }}
                              className="text-xs font-semibold bg-[#111111] hover:bg-[#242424] text-white px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Movimentar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            ABA 2: DRE SIMPLIFICADO & DESPESAS DA LOJA
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'financial' && (
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda: DRE Demonstrativo de Resultado */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-card flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-[#111111]">
                  DRE Simplificado — Resultado Financeiro
                </h2>
                <p className="text-xs text-[#767676] mt-0.5">
                  Apuração automática com base nas baixas de vendas, custos de produtos e despesas
                </p>
              </div>

              <div className="divide-y divide-[#F0F0F0] text-sm">
                <div className="py-3 flex items-center justify-between">
                  <span className="font-semibold text-[#242424]">
                    (+) Receita Bruta de Vendas
                  </span>
                  <span className="font-extrabold text-[#111111] tabular-nums">
                    {formatBRL(grossSalesRevenue)}
                  </span>
                </div>

                {/* Detalhamento por meio de pagamento */}
                <div className="py-2.5 pl-4 bg-[#FAFAF8] rounded-xl my-1 px-3 flex flex-wrap gap-4 text-xs text-[#555555]">
                  <span>PIX: <strong>{formatBRL(salesByPayment.pix)}</strong></span>
                  <span>Cartão: <strong>{formatBRL(salesByPayment.credit_card + salesByPayment.debit_card)}</strong></span>
                  <span>Dinheiro: <strong>{formatBRL(salesByPayment.cash)}</strong></span>
                </div>

                <div className="py-3 flex items-center justify-between text-red-600">
                  <span>(-) CMV (Custo das Mercadorias Vendidas)</span>
                  <span className="font-semibold tabular-nums">-{formatBRL(totalCMV)}</span>
                </div>

                <div className="py-3 flex items-center justify-between bg-[#F7F7F7] px-3 rounded-xl font-bold text-[#111111]">
                  <span>(=) Lucro Bruto nas Vendas</span>
                  <span className="tabular-nums text-[#166534]">
                    {formatBRL(grossProfitFromSales)}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between text-amber-700">
                  <span>(-) Custos com Garantias, Trocas, Perdas e Brindes</span>
                  <span className="font-semibold tabular-nums">
                    -{formatBRL(warrantyAndLossesCost)}
                  </span>
                </div>

                <div className="py-3 flex items-center justify-between text-red-600">
                  <span>(-) Despesas Operacionais da Loja ({expenses.length})</span>
                  <span className="font-semibold tabular-nums">
                    -{formatBRL(totalOperatingExpenses)}
                  </span>
                </div>

                <div className="pt-4 mt-2 border-t-2 border-[#111111] flex items-center justify-between">
                  <div>
                    <span className="text-base font-extrabold text-[#111111] block">
                      (=) LUCRO LÍQUIDO REAL
                    </span>
                    <span className="text-[11px] text-[#767676]">
                      O que efetivamente sobra no caixa após custos e despesas
                    </span>
                  </div>
                  <span
                    className={cn(
                      'text-xl font-extrabold tabular-nums px-3 py-1 rounded-xl',
                      netRealProfit >= 0
                        ? 'bg-[#F0FDF4] text-[#166534]'
                        : 'bg-red-50 text-red-700'
                    )}
                  >
                    {formatBRL(netRealProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Lançamento de Despesas da Loja */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-card flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-[#111111]">
                  Despesas Operacionais da Loja
                </h2>
                <p className="text-xs text-[#767676] mt-0.5">
                  Lance aluguel, tráfego pago, embalagens ou frete para descontar no DRE
                </p>
              </div>

              <form onSubmit={handleAddExpense} className="flex flex-col gap-3 bg-[#FAFAF8] p-4 rounded-xl border border-[#EAEAEA]">
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Descrição (Ex: Anúncios Instagram, Motoboy...)"
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-[#111111] outline-none focus:border-[#111111]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={expCategory}
                    onChange={(e) =>
                      setExpCategory(e.target.value as StoreExpense['category'])
                    }
                    className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-[#242424] outline-none"
                  >
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="Valor R$ (Ex: 150)"
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-[#111111] outline-none focus:border-[#111111]"
                  />
                </div>
                <Button type="submit" size="sm" loading={expSaving} icon={<Plus size={14} />}>
                  Adicionar Despesa
                </Button>
              </form>

              <div className="flex-1 divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {expenses.length === 0 ? (
                  <p className="text-xs text-[#999999] text-center py-6">
                    Nenhuma despesa operacional lançada.
                  </p>
                ) : (
                  expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#111111] truncate">
                          {exp.description}
                        </p>
                        <span className="text-[10px] text-[#767676]">
                          {EXPENSE_CATEGORY_LABELS[exp.category]} · {exp.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-red-600 tabular-nums">
                          -{formatBRL(exp.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExpense(exp.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            ABA 3: CURVA ABC & RADAR DE DINHEIRO PARADO
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'abc' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Curva A: Campeões de Giro e Procura */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-card flex flex-col gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F0FDF4] text-[#166534] px-2.5 py-1 rounded-full">
                  Curva A — Alta Performance
                </span>
                <h3 className="text-base font-bold text-[#111111] mt-2">
                  Produtos Campeões de Giro e Demanda
                </h3>
                <p className="text-xs text-[#767676]">
                  Itens que mais geram vendas e cliques no WhatsApp — nunca deixe faltar em estoque!
                </p>
              </div>

              <div className="divide-y divide-gray-100">
                {curveA.map((item, idx) => (
                  <div
                    key={item.product.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-[#111111] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}º
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#111111] truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-[#767676]">
                          {item.sold} vendido(s) · {item.clicks} clique(s) no WhatsApp
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-[#166534] bg-[#F0FDF4] px-2.5 py-1 rounded-full shrink-0">
                      Estoque: {item.stock} un.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar de Capital Parado (Estoque Encalhado) */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full">
                    Radar de Capital Imobilizado
                  </span>
                  <h3 className="text-base font-bold text-[#111111] mt-2">
                    Estoque com Baixo Giro (Dinheiro Parado)
                  </h3>
                  <p className="text-xs text-[#767676]">
                    Total parado nesses itens: <strong>{formatBRL(totalStagnantCapital)}</strong> a preço de custo.
                  </p>
                </div>
              </div>

              {stagnantItems.length === 0 ? (
                <p className="text-xs text-[#166534] bg-[#F0FDF4] p-4 rounded-xl font-medium">
                  Excelente! Nenhum produto apresenta estoque alto acumulado sem procura.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stagnantItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="py-3 flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#111111] truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-[#767676]">
                          {item.stock} un. paradas · Capital preso:{' '}
                          <strong>{formatBRL(item.capitalLocked)}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCreatePromoForStagnant(item.product)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#111111] hover:bg-[#242424] text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        <Tag size={12} />
                        Aplicar -10% OFF
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            ABA 4: HISTÓRICO DE MOVIMENTAÇÕES
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-card overflow-hidden">
            {movements.length === 0 ? (
              <div className="p-12 text-center">
                <History size={36} className="mx-auto text-[#CCCCCC] mb-2" />
                <p className="text-sm font-semibold text-[#111111]">
                  Nenhuma movimentação registrada ainda
                </p>
                <p className="text-xs text-[#767676] mt-1">
                  Use os botões "-1 Venda" ou "Movimentar" na aba de Estoque para registrar vendas, entradas e garantias.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-100 bg-[#FAFAF8]">
                      <th className="px-4 py-3 text-xs font-semibold text-[#767676]">Data / Hora</th>
                      <th className="px-3 py-3 text-xs font-semibold text-[#767676]">Produto</th>
                      <th className="px-3 py-3 text-xs font-semibold text-[#767676]">Operação</th>
                      <th className="px-3 py-3 text-xs font-semibold text-[#767676]">Qtd / Saldo</th>
                      <th className="px-3 py-3 text-xs font-semibold text-[#767676]">Impacto Financeiro</th>
                      <th className="px-3 py-3 text-xs font-semibold text-[#767676]">Responsável</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[#767676]">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {movements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-[#FAFAF8]">
                        <td className="px-4 py-3 text-xs text-[#767676] whitespace-nowrap tabular-nums">
                          {new Date(mov.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-[#111111]">
                          {mov.product_name}
                        </td>
                        <td className="px-3 py-3">
                          {mov.reason === 'sale' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#166534] bg-[#F0FDF4] px-2 py-0.5 rounded-full">
                              <ArrowDownRight size={12} /> Venda ({PAYMENT_LABELS[mov.payment_method || 'pix']})
                            </span>
                          )}
                          {mov.reason === 'restock' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#111111] bg-[#F4F4F4] px-2 py-0.5 rounded-full">
                              <ArrowUpRight size={12} /> Entrada Lote
                            </span>
                          )}
                          {mov.reason === 'warranty' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#92400E] bg-[#FFFBEB] px-2 py-0.5 rounded-full">
                              <ShieldAlert size={12} /> Garantia / Troca
                            </span>
                          )}
                          {mov.reason === 'loss' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#991B1B] bg-[#FEF2F2] px-2 py-0.5 rounded-full">
                              Avaria / Perda
                            </span>
                          )}
                          {mov.reason === 'gift' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#242424] bg-[#F4F4F4] px-2 py-0.5 rounded-full">
                              <Gift size={12} /> Brinde
                            </span>
                          )}
                          {(!mov.reason || mov.reason === 'adjustment') && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                              Ajuste de Inventário
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-[#555555] tabular-nums">
                          <strong>
                            {mov.type === 'in' ? `+${mov.quantity}` : mov.type === 'out' ? `-${mov.quantity}` : `= ${mov.new_stock}`}
                          </strong>{' '}
                          ({mov.previous_stock} → {mov.new_stock} un.)
                        </td>
                        <td className="px-3 py-3 text-xs tabular-nums">
                          {mov.reason === 'sale' && mov.total_value ? (
                            <div>
                              <span className="font-bold text-[#111111]">
                                {formatBRL(mov.total_value)}
                              </span>
                              {mov.profit_value !== undefined && (
                                <span className="block text-[10px] font-semibold text-[#166534]">
                                  Lucro: +{formatBRL(mov.profit_value)}
                                </span>
                              )}
                            </div>
                          ) : mov.total_value ? (
                            <span className="text-[#555555]">{formatBRL(mov.total_value)}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-[#242424]">
                          {mov.responsible || 'Admin Alfa'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#767676]">
                          {mov.supplier ? `[Forn: ${mov.supplier}] ` : ''}
                          {mov.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Completo de Movimentação (Venda, Entrada de Nota/Fornecedor, Ajuste Manual, Garantia, Perda, Brinde) */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#111111]">
                Registrar Operação de Estoque / Financeiro
              </h3>
              <p className="text-xs text-[#767676] mt-0.5">
                Produto: <strong>{modalProduct.name}</strong> (Saldo atual:{' '}
                {metaMap[modalProduct.id]?.stock_quantity ?? 0} un.)
              </p>
            </div>

            {/* Seleção do Tipo de Operação */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#F4F4F4] rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMovType('out')
                  setMovReason('sale')
                }}
                className={cn(
                  'py-2 rounded-lg transition-colors',
                  movType === 'out' && movReason === 'sale'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Venda
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovType('in')
                  setMovReason('restock')
                }}
                className={cn(
                  'py-2 rounded-lg transition-colors',
                  movType === 'in'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Entrada / Lote
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovType('adjustment')
                  setMovReason('adjustment')
                  setMovQty(String(metaMap[modalProduct.id]?.stock_quantity ?? 0))
                }}
                className={cn(
                  'py-2 rounded-lg transition-colors',
                  movType === 'adjustment'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Ajuste Saldo
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovType('out')
                  setMovReason('warranty')
                }}
                className={cn(
                  'py-2 rounded-lg transition-colors',
                  movType === 'out' && movReason !== 'sale'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Garantia / Perda
              </button>
            </div>

            {/* Sub-opções dependendo do tipo */}
            {movType === 'out' && movReason === 'sale' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#111111] block mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={movPayment}
                    onChange={(e) => setMovPayment(e.target.value as PaymentMethod)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-[#111111] outline-none"
                  >
                    {Object.entries(PAYMENT_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#111111] block mb-1">
                    Qtd. Vendida
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={metaMap[modalProduct.id]?.stock_quantity ?? 0}
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-[#111111] outline-none"
                  />
                </div>
              </div>
            )}

            {movType === 'in' && (
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#111111] block mb-1">
                    Qtd. Recebida
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-[#111111] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#111111] block mb-1">
                    Custo Unit. Pago (R$)
                  </label>
                  <input
                    type="text"
                    value={movUnitCost}
                    onChange={(e) => setMovUnitCost(e.target.value)}
                    placeholder="Ex: 120,00"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-[#111111] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#111111] block mb-1">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={movSupplier}
                    onChange={(e) => setMovSupplier(e.target.value)}
                    placeholder="Ex: Distribuidora SP"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-[#111111] outline-none"
                  />
                </div>
              </div>
            )}

            {movType === 'adjustment' && (
              <div>
                <label className="text-xs font-semibold text-[#111111] block mb-1">
                  Novo Saldo Físico em Estoque (Contagem de Inventário)
                </label>
                <input
                  type="number"
                  min="0"
                  value={movQty}
                  onChange={(e) => setMovQty(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-[#111111] outline-none"
                />
                <p className="text-[11px] text-[#767676] mt-1">
                  O estoque será ajustado de {metaMap[modalProduct.id]?.stock_quantity ?? 0} un. para {movQty || 0} un.
                </p>
              </div>
            )}

            {movType === 'out' && movReason !== 'sale' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#111111] block mb-1">
                    Motivo da Baixa Não-Comercial
                  </label>
                  <select
                    value={movReason}
                    onChange={(e) =>
                      setMovReason(e.target.value as StockMovementReason)
                    }
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-[#111111] outline-none"
                  >
                    <option value="warranty">Troca / Garantia de Cliente</option>
                    <option value="loss">Defeito / Avaria / Perda</option>
                    <option value="gift">Brinde / Cortesia Comercial</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#111111] block mb-1">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={metaMap[modalProduct.id]?.stock_quantity ?? 0}
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-[#111111] outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#111111] block mb-1">
                  Responsável pela Operação
                </label>
                <input
                  type="text"
                  value={movResponsible}
                  onChange={(e) => setMovResponsible(e.target.value)}
                  placeholder="Ex: Admin Alfa / Vendedor"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-[#111111] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#111111] block mb-1">
                  Observação (Opcional)
                </label>
                <input
                  type="text"
                  value={movNote}
                  onChange={(e) => setMovNote(e.target.value)}
                  placeholder="Ex: Cliente João / NF #402"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-[#111111] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="ghost"
                disabled={movSaving}
                onClick={() => setModalProduct(null)}
              >
                Cancelar
              </Button>
              <Button loading={movSaving} onClick={handleSaveModalMovement}>
                Confirmar Registro
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
