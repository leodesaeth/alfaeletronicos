import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Receipt,
  Users,
  Settings2,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  MessageCircle,
  Target,
  ArrowUpRight,
  ShoppingBag,
  Wrench,
  Calendar,
} from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { getAllProducts } from '@/services/products'
import {
  getAllProductMeta,
  getStockMovements,
  registerStockMovement,
  getStoreExpenses,
  addStoreExpense,
  toggleStoreExpenseStatus,
  deleteStoreExpense,
  getCustomerReceivables,
  addCustomerReceivable,
  toggleCustomerReceivableStatus,
  deleteCustomerReceivable,
  getExtraIncomes,
  addExtraIncome,
  deleteExtraIncome,
  getExtendedStoreConfig,
  saveExtendedStoreConfig,
  type ProductMetaMap,
  type StockMovement,
  type StoreExpense,
  type CustomerReceivable,
  type ExtraIncome,
  type PaymentMethod,
  type FinancialConfig,
} from '@/services/catalogIntelligence'
import type { Product } from '@/types'
import { PageLoader } from '@/components/ui/StateComponents'
import { formatBRL, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type PeriodFilter = 'today' | '7d' | 'month' | 'last_month' | 'all'

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
  marketing: 'Marketing & Tráfego Pago',
  logistica: 'Embalagens, Motoboy & Frete',
  variavel: 'Despesa Variável / Manutenção',
  impostos: 'Impostos / Taxas Contábeis',
}

const DEFAULT_FINANCIAL_CONFIG: FinancialConfig = {
  monthly_revenue_goal: 25000,
  credit_card_fee_pct: 4.5,
  debit_card_fee_pct: 1.5,
  pix_fee_pct: 0,
}

export function FinancialPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [metaMap, setMetaMap] = useState<ProductMetaMap>({})
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [expenses, setExpenses] = useState<StoreExpense[]>([])
  const [receivables, setReceivables] = useState<CustomerReceivable[]>([])
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([])
  const [finConfig, setFinConfig] = useState<FinancialConfig>(DEFAULT_FINANCIAL_CONFIG)
  const [loading, setLoading] = useState(true)

  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [activeTab, setActiveTab] = useState<'dre' | 'payables' | 'receivables' | 'settings'>('dre')

  // Modal PDV Rápido (Lançar Venda de Produto ou Serviço/Receita Extra)
  const [pdvOpen, setPdvOpen] = useState(false)
  const [pdvMode, setPdvMode] = useState<'product' | 'service'>('product')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [pdvQty, setPdvQty] = useState('1')
  const [pdvUnitPrice, setPdvUnitPrice] = useState('')
  const [pdvPayment, setPdvPayment] = useState<PaymentMethod>('pix')
  const [pdvNote, setPdvNote] = useState('')
  // Campos Serviço Extra
  const [srvDesc, setSrvDesc] = useState('')
  const [srvCategory, setSrvCategory] = useState<ExtraIncome['category']>('service')
  const [srvAmount, setSrvAmount] = useState('')
  const [srvCost, setSrvCost] = useState('')
  const [savingPdv, setSavingPdv] = useState(false)

  // Formulário Contas a Pagar
  const [expDesc, setExpDesc] = useState('')
  const [expCategory, setExpCategory] = useState<StoreExpense['category']>('fixa')
  const [expAmount, setExpAmount] = useState('')
  const [expDueDate, setExpDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expStatus, setExpStatus] = useState<'paid' | 'pending'>('paid')
  const [savingExp, setSavingExp] = useState(false)

  // Formulário Contas a Receber (Fiado)
  const [recName, setRecName] = useState('')
  const [recPhone, setRecPhone] = useState('')
  const [recDesc, setRecDesc] = useState('')
  const [recAmount, setRecAmount] = useState('')
  const [recDueDate, setRecDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [savingRec, setSavingRec] = useState(false)

  // Configurações Financeiras
  const [goalInput, setGoalInput] = useState('25000')
  const [creditFeeInput, setCreditFeeInput] = useState('4.5')
  const [debitFeeInput, setDebitFeeInput] = useState('1.5')
  const [pixFeeInput, setPixFeeInput] = useState('0')
  const [savingConfig, setSavingConfig] = useState(false)

  async function loadAll() {
    setLoading(true)
    try {
      const [prods, meta, movs, exps, recs, incs, extCfg] = await Promise.all([
        getAllProducts(),
        getAllProductMeta(),
        getStockMovements(),
        getStoreExpenses(),
        getCustomerReceivables(),
        getExtraIncomes(),
        getExtendedStoreConfig(),
      ])
      setProducts(prods)
      setMetaMap(meta)
      setMovements(movs)
      setExpenses(exps)
      setReceivables(recs)
      setExtraIncomes(incs)

      const cfg = extCfg.financial_config || DEFAULT_FINANCIAL_CONFIG
      setFinConfig(cfg)
      setGoalInput(String(cfg.monthly_revenue_goal))
      setCreditFeeInput(String(cfg.credit_card_fee_pct))
      setDebitFeeInput(String(cfg.debit_card_fee_pct))
      setPixFeeInput(String(cfg.pix_fee_pct))
    } catch {
      toast.error('Erro ao carregar dados financeiros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Filtro de datas por período selecionado
  function isWithinPeriod(isoDateStr: string, targetPeriod: PeriodFilter): boolean {
    if (targetPeriod === 'all') return true
    const date = new Date(isoDateStr)
    if (isNaN(date.getTime())) return true

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (targetPeriod === 'today') {
      return date >= startOfToday
    }
    if (targetPeriod === '7d') {
      const sevenDaysAgo = new Date(startOfToday)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return date >= sevenDaysAgo
    }
    if (targetPeriod === 'month') {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      )
    }
    if (targetPeriod === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      return date >= lastMonth && date <= endOfLastMonth
    }
    return true
  }

  // Cálculo de taxa de maquininha conforme meio de pagamento
  function getCardFeeRate(method?: PaymentMethod): number {
    if (method === 'credit_card') return (finConfig.credit_card_fee_pct || 0) / 100
    if (method === 'debit_card') return (finConfig.debit_card_fee_pct || 0) / 100
    if (method === 'pix') return (finConfig.pix_fee_pct || 0) / 100
    return 0
  }

  // Consolidação do DRE no Período Selecionado + Meta do Mês Atual
  const summary = useMemo(() => {
    // 1. Vendas de produtos no período
    const salesMovements = movements.filter(
      (m) =>
        m.type === 'out' &&
        (m.reason === 'sale' || !m.reason) &&
        isWithinPeriod(m.created_at, period)
    )

    // 2. Baixas não-comerciais (Garantia / Perda / Brinde) no período
    const lossMovements = movements.filter(
      (m) =>
        m.type === 'out' &&
        (m.reason === 'warranty' || m.reason === 'loss' || m.reason === 'gift') &&
        isWithinPeriod(m.created_at, period)
    )

    // 3. Serviços e receitas extras no período
    const filteredIncomes = extraIncomes.filter((inc) =>
      isWithinPeriod(inc.created_at, period)
    )

    // 4. Despesas operacionais do período
    const filteredExpenses = expenses.filter((exp) =>
      isWithinPeriod(exp.due_date || exp.date || exp.created_at, period)
    )

    let productGrossRevenue = 0
    let productCmv = 0
    let totalCardFees = 0

    const byPayment: Record<PaymentMethod, { gross: number; fees: number; net: number }> = {
      pix: { gross: 0, fees: 0, net: 0 },
      credit_card: { gross: 0, fees: 0, net: 0 },
      debit_card: { gross: 0, fees: 0, net: 0 },
      cash: { gross: 0, fees: 0, net: 0 },
      other: { gross: 0, fees: 0, net: 0 },
    }

    for (const sale of salesMovements) {
      const rev = sale.total_value ?? (sale.unit_price || 0) * sale.quantity
      const cmv = (sale.unit_cost || 0) * sale.quantity
      const method: PaymentMethod = sale.payment_method || 'pix'
      const fee = rev * getCardFeeRate(method)

      productGrossRevenue += rev
      productCmv += cmv
      totalCardFees += fee

      byPayment[method].gross += rev
      byPayment[method].fees += fee
      byPayment[method].net += rev - fee
    }

    let extraGrossRevenue = 0
    let extraCosts = 0

    for (const inc of filteredIncomes) {
      const fee = inc.amount * getCardFeeRate(inc.payment_method)
      extraGrossRevenue += inc.amount
      extraCosts += inc.cost_amount || 0
      totalCardFees += fee

      const method = inc.payment_method || 'pix'
      byPayment[method].gross += inc.amount
      byPayment[method].fees += fee
      byPayment[method].net += inc.amount - fee
    }

    const totalGrossRevenue = productGrossRevenue + extraGrossRevenue
    const totalNetRevenueAfterFees = totalGrossRevenue - totalCardFees
    const totalDirectCosts = productCmv + extraCosts
    const grossProfit = totalNetRevenueAfterFees - totalDirectCosts

    const totalWarrantyAndLosses = lossMovements.reduce(
      (acc, m) => acc + Math.abs(m.profit_value || (m.unit_cost || 0) * m.quantity),
      0
    )

    const paidExpensesTotal = filteredExpenses
      .filter((e) => e.status !== 'pending')
      .reduce((acc, e) => acc + e.amount, 0)

    const pendingExpensesTotal = filteredExpenses
      .filter((e) => e.status === 'pending')
      .reduce((acc, e) => acc + e.amount, 0)

    const netRealProfit = grossProfit - totalWarrantyAndLosses - paidExpensesTotal
    const netMarginPct =
      totalGrossRevenue > 0 ? Math.round((netRealProfit / totalGrossRevenue) * 100) : 0

    // Faturamento do mês atual para a Meta Mensal
    const currentMonthSales = movements
      .filter(
        (m) =>
          m.type === 'out' &&
          (m.reason === 'sale' || !m.reason) &&
          isWithinPeriod(m.created_at, 'month')
      )
      .reduce((acc, m) => acc + (m.total_value ?? (m.unit_price || 0) * m.quantity), 0)

    const currentMonthExtra = extraIncomes
      .filter((inc) => isWithinPeriod(inc.created_at, 'month'))
      .reduce((acc, inc) => acc + inc.amount, 0)

    const currentMonthRevenue = currentMonthSales + currentMonthExtra
    const goal = finConfig.monthly_revenue_goal || 25000
    const goalProgressPct = Math.min(100, Math.round((currentMonthRevenue / goal) * 100))
    const remainingToGoal = Math.max(0, goal - currentMonthRevenue)

    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1)
    const dailyTargetNeeded = remainingToGoal / daysRemaining

    // Contas a receber (Fiado)
    const pendingReceivablesTotal = receivables
      .filter((r) => r.status === 'pending')
      .reduce((acc, r) => acc + r.amount, 0)

    const todayStr = new Date().toISOString().slice(0, 10)
    const overduePayablesCount = expenses.filter(
      (e) => e.status === 'pending' && (e.due_date || e.date) <= todayStr
    ).length
    const overdueReceivablesCount = receivables.filter(
      (r) => r.status === 'pending' && r.due_date < todayStr
    ).length

    return {
      salesMovements,
      lossMovements,
      filteredIncomes,
      filteredExpenses,
      productGrossRevenue,
      extraGrossRevenue,
      totalGrossRevenue,
      totalCardFees,
      totalNetRevenueAfterFees,
      productCmv,
      extraCosts,
      totalDirectCosts,
      grossProfit,
      totalWarrantyAndLosses,
      paidExpensesTotal,
      pendingExpensesTotal,
      netRealProfit,
      netMarginPct,
      byPayment,
      currentMonthRevenue,
      goal,
      goalProgressPct,
      remainingToGoal,
      dailyTargetNeeded,
      pendingReceivablesTotal,
      overduePayablesCount,
      overdueReceivablesCount,
    }
  }, [movements, extraIncomes, expenses, receivables, period, finConfig])

  // Abrir modal PDV Rápido
  function openPdvModal() {
    const firstProd = products[0]
    setSelectedProductId(firstProd?.id || '')
    setPdvQty('1')
    setPdvUnitPrice(firstProd?.price ? String(firstProd.price) : '')
    setPdvPayment('pix')
    setPdvNote('')
    setSrvDesc('')
    setSrvAmount('')
    setSrvCost('')
    setPdvOpen(true)
  }

  function handleSelectProductInPdv(prodId: string) {
    setSelectedProductId(prodId)
    const found = products.find((p) => p.id === prodId)
    if (found && found.price !== null) {
      setPdvUnitPrice(String(found.price))
    }
  }

  async function handleConfirmPdv(e: React.FormEvent) {
    e.preventDefault()
    setSavingPdv(true)
    try {
      if (pdvMode === 'product') {
        const prod = products.find((p) => p.id === selectedProductId)
        if (!prod) {
          toast.error('Selecione um produto.')
          setSavingPdv(false)
          return
        }
        const qty = parseInt(pdvQty, 10)
        const price = parseFloat(pdvUnitPrice.replace(',', '.'))
        if (isNaN(qty) || qty <= 0) {
          toast.error('Informe uma quantidade válida.')
          setSavingPdv(false)
          return
        }
        const meta = metaMap[prod.id] || {}
        const result = await registerStockMovement({
          productId: prod.id,
          productName: prod.name,
          type: 'out',
          reason: 'sale',
          paymentMethod: pdvPayment,
          quantity: qty,
          unitPrice: !isNaN(price) ? price : prod.price || 0,
          unitCost: meta.cost_price ?? 0,
          note: pdvNote.trim() || `Venda PDV (${PAYMENT_LABELS[pdvPayment]})`,
        })
        setMetaMap((prev) => ({ ...prev, [prod.id]: result.meta }))
        setMovements(result.movements)
        toast.success(`Venda de ${qty}x "${prod.name}" registrada no caixa!`)
      } else {
        const amount = parseFloat(srvAmount.replace(',', '.'))
        const cost = parseFloat(srvCost.replace(',', '.'))
        if (!srvDesc.trim() || isNaN(amount) || amount <= 0) {
          toast.error('Informe a descrição e o valor do serviço/receita.')
          setSavingPdv(false)
          return
        }
        const nextIncomes = await addExtraIncome({
          description: srvDesc,
          category: srvCategory,
          amount,
          cost_amount: !isNaN(cost) ? cost : 0,
          payment_method: pdvPayment,
        })
        setExtraIncomes(nextIncomes)
        toast.success('Receita extra / serviço registrado no caixa!')
      }
      setPdvOpen(false)
    } catch {
      toast.error('Erro ao registrar lançamento no caixa.')
    } finally {
      setSavingPdv(false)
    }
  }

  // Adicionar Conta a Pagar / Despesa
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(expAmount.replace(',', '.'))
    if (!expDesc.trim() || isNaN(val) || val <= 0) {
      toast.error('Informe a descrição e um valor válido.')
      return
    }
    setSavingExp(true)
    try {
      const next = await addStoreExpense({
        description: expDesc,
        category: expCategory,
        amount: val,
        due_date: expDueDate,
        date: expDueDate,
        status: expStatus,
      })
      setExpenses(next)
      setExpDesc('')
      setExpAmount('')
      toast.success('Conta / despesa registrada com sucesso!')
    } catch {
      toast.error('Erro ao registrar despesa.')
    } finally {
      setSavingExp(false)
    }
  }

  async function handleToggleExpense(id: string) {
    const next = await toggleStoreExpenseStatus(id)
    setExpenses(next)
    toast.success('Status da conta atualizado!')
  }

  async function handleDeleteExpense(id: string) {
    const next = await deleteStoreExpense(id)
    setExpenses(next)
    toast.success('Despesa removida.')
  }

  // Adicionar Conta a Receber (Fiado)
  async function handleAddReceivable(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(recAmount.replace(',', '.'))
    if (!recName.trim() || !recDesc.trim() || isNaN(val) || val <= 0) {
      toast.error('Preencha o nome do cliente, descrição e valor.')
      return
    }
    setSavingRec(true)
    try {
      const next = await addCustomerReceivable({
        customer_name: recName,
        customer_phone: recPhone,
        description: recDesc,
        amount: val,
        due_date: recDueDate,
      })
      setReceivables(next)
      setRecName('')
      setRecPhone('')
      setRecDesc('')
      setRecAmount('')
      toast.success('Venda a prazo / conta a receber cadastrada!')
    } catch {
      toast.error('Erro ao cadastrar conta a receber.')
    } finally {
      setSavingRec(false)
    }
  }

  async function handleToggleReceivable(id: string) {
    const next = await toggleCustomerReceivableStatus(id)
    setReceivables(next)
    toast.success('Status de recebimento atualizado!')
  }

  async function handleDeleteReceivable(id: string) {
    const next = await deleteCustomerReceivable(id)
    setReceivables(next)
    toast.success('Registro removido.')
  }

  async function handleDeleteExtraIncome(id: string) {
    const next = await deleteExtraIncome(id)
    setExtraIncomes(next)
    toast.success('Receita extra removida.')
  }

  // Salvar Meta e Taxas de Maquininha
  async function handleSaveFinancialConfig(e: React.FormEvent) {
    e.preventDefault()
    setSavingConfig(true)
    try {
      const newCfg: FinancialConfig = {
        monthly_revenue_goal: Math.max(100, parseFloat(goalInput.replace(',', '.')) || 25000),
        credit_card_fee_pct: Math.max(0, parseFloat(creditFeeInput.replace(',', '.')) || 0),
        debit_card_fee_pct: Math.max(0, parseFloat(debitFeeInput.replace(',', '.')) || 0),
        pix_fee_pct: Math.max(0, parseFloat(pixFeeInput.replace(',', '.')) || 0),
      }
      const ext = await getExtendedStoreConfig()
      await saveExtendedStoreConfig({
        ...ext,
        financial_config: newCfg,
      })
      setFinConfig(newCfg)
      toast.success('Meta mensal e taxas de maquininha salvas!')
    } catch {
      toast.error('Erro ao salvar configurações financeiras.')
    } finally {
      setSavingConfig(false)
    }
  }

  // Gerar link de cobrança amigável no WhatsApp
  function buildReceivableWhatsAppLink(rec: CustomerReceivable): string {
    const cleanPhone = rec.customer_phone.replace(/\D/g, '')
    const fullPhone =
      cleanPhone.length >= 10 && !cleanPhone.startsWith('55')
        ? `55${cleanPhone}`
        : cleanPhone
    const dueFormatted = new Date(rec.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
    const msg = `Olá ${rec.customer_name}, tudo bem? 😊\nPassando para lembrar do pagamento referente a *${rec.description}* no valor de *${formatBRL(rec.amount)}* (combinado para ${dueFormatted}) aqui na *Alfa Eletrônicos*.\n\nSe preferir pagar via PIX, é só me avisar por aqui. Muito obrigado!`
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`
  }

  // Exportar DRE & Fluxo de Caixa em CSV
  function handleExportFinancialCSV() {
    const headers = ['Data', 'Tipo', 'Descricao', 'Meio Pagamento / Categoria', 'Valor Bruto (R$)', 'Custo / Taxa (R$)', 'Impacto Liquido (R$)']
    const rows: (string | number)[][] = []

    for (const s of summary.salesMovements) {
      const rev = s.total_value ?? (s.unit_price || 0) * s.quantity
      const cmv = (s.unit_cost || 0) * s.quantity
      const fee = rev * getCardFeeRate(s.payment_method)
      const net = rev - cmv - fee
      rows.push([
        new Date(s.created_at).toLocaleDateString('pt-BR'),
        'Venda de Produto',
        `"${s.quantity}x ${s.product_name.replace(/"/g, '""')}"`,
        PAYMENT_LABELS[s.payment_method || 'pix'],
        rev.toFixed(2),
        (cmv + fee).toFixed(2),
        net.toFixed(2),
      ])
    }

    for (const inc of summary.filteredIncomes) {
      const fee = inc.amount * getCardFeeRate(inc.payment_method)
      const net = inc.amount - inc.cost_amount - fee
      rows.push([
        new Date(inc.created_at).toLocaleDateString('pt-BR'),
        'Servico / Receita Extra',
        `"${inc.description.replace(/"/g, '""')}"`,
        PAYMENT_LABELS[inc.payment_method],
        inc.amount.toFixed(2),
        (inc.cost_amount + fee).toFixed(2),
        net.toFixed(2),
      ])
    }

    for (const exp of summary.filteredExpenses) {
      rows.push([
        exp.due_date || exp.date,
        exp.status === 'pending' ? 'Despesa Pendente' : 'Despesa Paga',
        `"${exp.description.replace(/"/g, '""')}"`,
        EXPENSE_CATEGORY_LABELS[exp.category],
        '0.00',
        exp.amount.toFixed(2),
        (-exp.amount).toFixed(2),
      ])
    }

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `financeiro-dre-alfa-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Relatório Financeiro (CSV/Excel) exportado!')
  }

  if (loading) {
    return (
      <AdminLayout>
        <PageLoader />
      </AdminLayout>
    )
  }

  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto w-full space-y-6">
      {/* ── Cabeçalho Executivo + Filtro de Período + Ações Rápidas ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
            Central Financeira & DRE
          </h1>
          <p className="text-sm text-[#767676] mt-0.5">
            Faturamento bruto, lucro líquido descontando taxas de maquininha, contas a pagar e vendas a receber.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Período */}
          <div className="inline-flex items-center bg-[#F4F4F4] border border-[#E5E5E5] rounded-xl p-1">
            {(
              [
                { id: 'today', label: 'Hoje' },
                { id: '7d', label: '7 Dias' },
                { id: 'month', label: 'Este Mês' },
                { id: 'last_month', label: 'Mês Passado' },
                { id: 'all', label: 'Tudo' },
              ] as { id: PeriodFilter; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  period === p.id
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openPdvModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold transition-colors"
          >
            <Plus size={15} /> Lançar Venda / Serviço (PDV)
          </button>

          <button
            type="button"
            onClick={handleExportFinancialCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E0E0E0] bg-white hover:bg-[#F7F7F7] text-xs font-semibold text-[#242424] transition-colors"
          >
            <Download size={14} /> Exportar DRE (Excel)
          </button>
        </div>
      </div>

      {/* ── Barra de Meta de Faturamento Mensal (Sóbria Editorial) ── */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] p-5 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F4F4F4] border border-[#E5E5E5] flex items-center justify-center text-[#111111]">
              <Target size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#767676]">
                  Meta de Faturamento deste Mês
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="text-[11px] text-[#111111] hover:underline font-semibold"
                >
                  Editar meta
                </button>
              </div>
              <p className="text-lg font-extrabold text-[#111111] tabular-nums mt-0.5">
                {formatBRL(summary.currentMonthRevenue)}{' '}
                <span className="text-sm font-normal text-[#767676]">
                  de {formatBRL(summary.goal)} ({summary.goalProgressPct}%)
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="bg-[#FAFAF8] border border-[#EAEAEA] rounded-xl px-3.5 py-2">
              <span className="text-[#767676] block">Falta para bater a meta</span>
              <strong className="text-[#111111] font-bold tabular-nums text-sm">
                {summary.remainingToGoal > 0 ? formatBRL(summary.remainingToGoal) : 'Meta Atingida'}
              </strong>
            </div>
            {summary.remainingToGoal > 0 && (
              <div className="bg-[#FAFAF8] border border-[#EAEAEA] rounded-xl px-3.5 py-2">
                <span className="text-[#767676] block">Ritmo necessário por dia</span>
                <strong className="text-[#111111] font-bold tabular-nums text-sm">
                  {formatBRL(summary.dailyTargetNeeded)} / dia
                </strong>
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-2 bg-[#F0F0EE] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#111111] rounded-full transition-all duration-500"
            style={{ width: `${summary.goalProgressPct}%` }}
          />
        </div>
      </div>

      {/* ── 4 Cartões Executivos Principais ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 shadow-card">
          <div className="flex items-center justify-between text-[#767676] mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Faturamento Bruto
            </span>
            <TrendingUp size={15} className="text-[#767676]" />
          </div>
          <p className="text-2xl font-extrabold text-[#111111] tabular-nums">
            {formatBRL(summary.totalGrossRevenue)}
          </p>
          <p className="text-[11px] text-[#767676] mt-1">
            Produtos: {formatBRL(summary.productGrossRevenue)} · Serviços: {formatBRL(summary.extraGrossRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 shadow-card">
          <div className="flex items-center justify-between text-[#767676] mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Lucro Bruto (Após CMV e Taxas)
            </span>
            <Wallet size={15} className="text-[#767676]" />
          </div>
          <p className="text-2xl font-extrabold text-[#111111] tabular-nums">
            {formatBRL(summary.grossProfit)}
          </p>
          <p className="text-[11px] text-[#767676] mt-1">
            CMV: {formatBRL(summary.totalDirectCosts)} · Taxas: {formatBRL(summary.totalCardFees)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 shadow-card">
          <div className="flex items-center justify-between text-[#767676] mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Despesas Pagas & Perdas
            </span>
            <TrendingDown size={15} className="text-[#767676]" />
          </div>
          <p className="text-2xl font-extrabold text-[#111111] tabular-nums">
            {formatBRL(summary.paidExpensesTotal + summary.totalWarrantyAndLosses)}
          </p>
          <p className="text-[11px] text-[#767676] mt-1">
            {summary.pendingExpensesTotal > 0 ? (
              <span className="text-[#92400E] font-semibold">
                + {formatBRL(summary.pendingExpensesTotal)} em contas a pagar
              </span>
            ) : (
              'Todas as contas do período estão em dia'
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-4 shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#767676]">
              Lucro Líquido Real (Caixa)
            </span>
            <DollarSign
              size={15}
              className={summary.netRealProfit >= 0 ? 'text-[#166534]' : 'text-[#991B1B]'}
            />
          </div>
          <p
            className={cn(
              'text-2xl font-extrabold tabular-nums',
              summary.netRealProfit >= 0 ? 'text-[#166534]' : 'text-[#991B1B]'
            )}
          >
            {formatBRL(summary.netRealProfit)}
          </p>
          <div className="flex items-center justify-between text-[11px] mt-1 text-[#767676]">
            <span>
              Margem Líquida: <strong className="text-[#111111]">{summary.netMarginPct}%</strong>
            </span>
            {summary.pendingReceivablesTotal > 0 && (
              <span className="text-[#242424] font-semibold">
                + {formatBRL(summary.pendingReceivablesTotal)} a receber
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Navegação das 4 Abas do Financeiro ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EAEAEA] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('dre')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'dre'
              ? 'bg-[#111111] text-white'
              : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
          )}
        >
          <Receipt size={14} /> DRE & Fluxo de Caixa
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payables')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'payables'
              ? 'bg-[#111111] text-white'
              : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
          )}
        >
          <CreditCard size={14} /> Contas a Pagar & Despesas
          {summary.overduePayablesCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#FEF2F2] text-[#991B1B]">
              {summary.overduePayablesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receivables')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'receivables'
              ? 'bg-[#111111] text-white'
              : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
          )}
        >
          <Users size={14} /> Contas a Receber (Fiado)
          {receivables.filter((r) => r.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#F4F4F4] text-[#111111]">
              {receivables.filter((r) => r.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'settings'
              ? 'bg-[#111111] text-white'
              : 'bg-white text-[#555555] hover:text-[#111111] border border-[#EAEAEA]'
          )}
        >
          <Settings2 size={14} /> Taxas de Maquininha & Meta
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ABA 1: DRE COMPLETO & FLUXO DE CAIXA POR MEIO DE PAGAMENTO
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dre' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda (2/3): DRE Passo a Passo */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#111111]">
                    Demonstrativo de Resultado do Exercício (DRE)
                  </h2>
                  <p className="text-xs text-[#767676]">
                    Apuração real de entradas, taxas de cartão, custo de mercadorias (CMV) e despesas.
                  </p>
                </div>
                <Link
                  to="/admin/estoque"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#111111] hover:underline"
                >
                  Ir para Estoque <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8] border border-[#F0F0EE]">
                  <span className="font-semibold text-[#242424]">
                    (+) Receita Bruta com Vendas de Produtos ({summary.salesMovements.length} vendas)
                  </span>
                  <span className="font-bold text-[#111111] tabular-nums">
                    {formatBRL(summary.productGrossRevenue)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8] border border-[#F0F0EE]">
                  <span className="font-semibold text-[#242424]">
                    (+) Receitas Extras / Assistência / Serviços ({summary.filteredIncomes.length})
                  </span>
                  <span className="font-bold text-[#111111] tabular-nums">
                    {formatBRL(summary.extraGrossRevenue)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8] text-[#555555]">
                  <span>
                    (-) Taxas de Maquininha (Crédito {finConfig.credit_card_fee_pct}% / Débito {finConfig.debit_card_fee_pct}%)
                  </span>
                  <span className="font-semibold text-[#991B1B] tabular-nums">
                    - {formatBRL(summary.totalCardFees)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8] text-[#555555]">
                  <span>(-) Custo das Mercadorias Vendidas (CMV + Custo de Serviços)</span>
                  <span className="font-semibold text-[#991B1B] tabular-nums">
                    - {formatBRL(summary.totalDirectCosts)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F4F4F4] border border-[#E5E5E5] text-[#111111] font-bold">
                  <span>(=) Lucro Bruto Operacional</span>
                  <span className="tabular-nums">{formatBRL(summary.grossProfit)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8] text-[#555555]">
                  <span>(-) Custos com Garantias, Trocas, Perdas e Brindes</span>
                  <span className="font-semibold text-[#92400E] tabular-nums">
                    - {formatBRL(summary.totalWarrantyAndLosses)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8] text-[#555555]">
                  <span>(-) Despesas Fixas e Contas Pagas da Loja</span>
                  <span className="font-semibold text-[#991B1B] tabular-nums">
                    - {formatBRL(summary.paidExpensesTotal)}
                  </span>
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between p-4 rounded-2xl border text-base font-extrabold mt-2',
                    summary.netRealProfit >= 0
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                      : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                  )}
                >
                  <div>
                    <span>(=) Lucro Líquido Real no Caixa</span>
                    <p className="text-[11px] font-medium opacity-80">
                      Margem líquida final de {summary.netMarginPct}% sobre o faturamento
                    </p>
                  </div>
                  <span className="text-xl tabular-nums">{formatBRL(summary.netRealProfit)}</span>
                </div>
              </div>
            </div>

            {/* Extrato Recente de Vendas & Receitas Extras */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#111111]">
                  Últimas Entradas no Caixa (Vendas de Produtos & Serviços)
                </h3>
                <button
                  type="button"
                  onClick={openPdvModal}
                  className="text-xs font-semibold text-[#111111] hover:underline"
                >
                  + Novo lançamento
                </button>
              </div>

              {summary.salesMovements.length === 0 && summary.filteredIncomes.length === 0 ? (
                <div className="text-center py-8 text-[#767676] text-sm">
                  Nenhuma venda ou serviço registrado neste período. Clique em{' '}
                  <strong>"Lançar Venda / Serviço (PDV)"</strong> no topo para iniciar.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {summary.filteredIncomes.map((inc) => (
                    <div
                      key={inc.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                          <Wrench size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111111] truncate">
                            {inc.description}
                          </p>
                          <p className="text-[11px] text-[#767676]">
                            Serviço / Receita Extra · {PAYMENT_LABELS[inc.payment_method]} ·{' '}
                            {new Date(inc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#166534] tabular-nums">
                            + {formatBRL(inc.amount)}
                          </p>
                          {inc.cost_amount > 0 && (
                            <p className="text-[10px] text-[#767676] tabular-nums">
                              Custo: {formatBRL(inc.cost_amount)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExtraIncome(inc.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Excluir lançamento"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {summary.salesMovements.slice(0, 20).map((sale) => {
                    const rev = sale.total_value ?? (sale.unit_price || 0) * sale.quantity
                    const fee = rev * getCardFeeRate(sale.payment_method)
                    const netProfit = (sale.profit_value || 0) - fee
                    return (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-[#EAEAEA] hover:bg-[#FAFAF8]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#F4F4F4] text-[#111111] flex items-center justify-center shrink-0">
                            <ShoppingBag size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#111111] truncate">
                              {sale.quantity}x {sale.product_name}
                            </p>
                            <p className="text-[11px] text-[#767676]">
                              {PAYMENT_LABELS[sale.payment_method || 'pix']} ·{' '}
                              {new Date(sale.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-[#111111] tabular-nums">
                            {formatBRL(rev)}
                          </p>
                          <p className="text-[10px] font-semibold text-[#166534] tabular-nums">
                            Lucro Líq.: +{formatBRL(netProfit)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita (1/3): Recebimentos por Meio de Pagamento */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-5 shadow-card">
              <h3 className="text-sm font-bold text-[#111111] mb-1">
                Receita por Meio de Pagamento
              </h3>
              <p className="text-xs text-[#767676] mb-4">
                Comparativo entre valor bruto cobrado do cliente e valor líquido descontando a maquininha.
              </p>

              <div className="space-y-3">
                {(['pix', 'credit_card', 'debit_card', 'cash'] as PaymentMethod[]).map((m) => {
                  const data = summary.byPayment[m]
                  return (
                    <div key={m} className="p-3 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8]">
                      <div className="flex items-center justify-between text-xs font-bold text-[#111111]">
                        <span>{PAYMENT_LABELS[m]}</span>
                        <span className="tabular-nums">{formatBRL(data.gross)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#767676] mt-1">
                        <span>Taxa retida: {formatBRL(data.fees)}</span>
                        <span className="text-[#166534] font-semibold tabular-nums">
                          Líquido: {formatBRL(data.net)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resumo Rápido de Pendências */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-5 shadow-card space-y-3">
              <h3 className="text-sm font-bold text-[#111111]">Radar de Contas & Recebíveis</h3>

              <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#111111]">Contas a Pagar Pendentes</p>
                  <p className="text-[11px] text-[#767676]">
                    {summary.overduePayablesCount > 0
                      ? `${summary.overduePayablesCount} vencendo hoje ou atrasada(s)`
                      : 'Nenhuma atrasada'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-[#92400E] tabular-nums">
                    {formatBRL(summary.pendingExpensesTotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('payables')}
                    className="text-[11px] font-bold text-[#111111] underline"
                  >
                    Ver contas
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-[#EAEAEA] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#111111]">Total a Receber (Fiado)</p>
                  <p className="text-[11px] text-[#767676]">
                    {receivables.filter((r) => r.status === 'pending').length} cliente(s) pendente(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-[#111111] tabular-nums">
                    {formatBRL(summary.pendingReceivablesTotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('receivables')}
                    className="text-[11px] font-bold text-[#111111] underline"
                  >
                    Cobrar clientes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ABA 2: CONTAS A PAGAR & DESPESAS DA LOJA
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payables' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddExpense}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4 h-fit"
          >
            <div>
              <h3 className="text-sm font-bold text-gray-900">Nova Conta a Pagar / Despesa</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cadastre boletos de fornecedores, aluguel, energia, tráfego pago ou embalagens.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição</label>
              <input
                type="text"
                placeholder="Ex: Boleto Fornecedor Capinhas, Aluguel..."
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Categoria</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as StoreExpense['category'])}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="fixa">Custo Fixo (Aluguel, Luz, Internet)</option>
                <option value="fornecedor">Fornecedor / Boleto de Mercadoria</option>
                <option value="marketing">Marketing & Tráfego Pago</option>
                <option value="logistica">Embalagens, Motoboy & Frete</option>
                <option value="variavel">Despesa Variável / Manutenção</option>
                <option value="impostos">Impostos / Taxas Contábeis</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vencimento</label>
                <input
                  type="date"
                  value={expDueDate}
                  onChange={(e) => setExpDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status Inicial</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpStatus('paid')}
                  className={cn(
                    'py-2 px-3 rounded-xl text-xs font-bold border transition-all',
                    expStatus === 'paid'
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-[#FAFAF8] text-[#767676] border-[#EAEAEA]'
                  )}
                >
                  Já Pago
                </button>
                <button
                  type="button"
                  onClick={() => setExpStatus('pending')}
                  className={cn(
                    'py-2 px-3 rounded-xl text-xs font-bold border transition-all',
                    expStatus === 'pending'
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-[#FAFAF8] text-[#767676] border-[#EAEAEA]'
                  )}
                >
                  A Pagar / Pendente
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingExp}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors"
            >
              {savingExp ? 'Salvando...' : '+ Cadastrar Conta / Despesa'}
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Controle de Contas a Pagar & Despesas ({expenses.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Clique no status para alternar rapidamente entre <strong>Pendente</strong> e <strong>Pago</strong>.
                </p>
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Nenhuma conta ou despesa cadastrada ainda.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {expenses.map((exp) => {
                  const due = exp.due_date || exp.date
                  const isPending = exp.status === 'pending'
                  const isOverdue = isPending && due <= todayIso

                  return (
                    <div
                      key={exp.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors',
                        isOverdue
                          ? 'bg-red-50/60 border-red-200'
                          : isPending
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-gray-50/70 border-gray-100'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {exp.description}
                          </p>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              <AlertTriangle size={10} /> Vencida / Hoje
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {EXPENSE_CATEGORY_LABELS[exp.category] || exp.category} • Vencimento:{' '}
                          <strong>{new Date(due + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="text-sm font-extrabold text-gray-900 tabular-nums">
                          {formatBRL(exp.amount)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleExpense(exp.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                            isPending
                              ? 'bg-amber-100 text-amber-800 hover:bg-emerald-600 hover:text-white'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-gray-200'
                          )}
                          title="Clique para alternar entre Pago e Pendente"
                        >
                          {isPending ? (
                            <>
                              <Clock size={12} /> Pendente (Marcar Pago)
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={12} /> Pago
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                          title="Excluir conta"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ABA 3: CONTAS A RECEBER / CONTROLE DE "FIADO" & VENDAS A PRAZO
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'receivables' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddReceivable}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4 h-fit"
          >
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Registrar Venda a Prazo / A Receber
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Controle clientes que ficaram de pagar depois e envie lembretes no WhatsApp em 1 clique.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nome do Cliente
              </label>
              <input
                type="text"
                placeholder="Ex: João Silva"
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                WhatsApp do Cliente (com DDD)
              </label>
              <input
                type="text"
                placeholder="Ex: 11999999999"
                value={recPhone}
                onChange={(e) => setRecPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Produto / Descrição da Venda
              </label>
              <input
                type="text"
                placeholder="Ex: 2ª parcela Perfume Importado / Capinha..."
                value={recDesc}
                onChange={(e) => setRecDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Valor a Receber (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Data Combinada
                </label>
                <input
                  type="date"
                  value={recDueDate}
                  onChange={(e) => setRecDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingRec}
              className="w-full py-2.5 px-4 rounded-xl bg-[#111111] hover:bg-[#242424] text-white text-xs font-bold transition-colors"
            >
              {savingRec ? 'Salvando...' : '+ Registrar Conta a Receber'}
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#EAEAEA] p-5 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#111111]">
                  Carteira de Clientes a Receber ({receivables.length})
                </h3>
                <p className="text-xs text-[#767676]">
                  Total pendente na rua:{' '}
                  <strong className="text-[#111111]">
                    {formatBRL(summary.pendingReceivablesTotal)}
                  </strong>
                </p>
              </div>
            </div>

            {receivables.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Nenhuma venda a prazo ou conta a receber cadastrada.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {receivables.map((rec) => {
                  const isPending = rec.status === 'pending'
                  const isOverdue = isPending && rec.due_date < todayIso

                  return (
                    <div
                      key={rec.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border',
                        isOverdue
                          ? 'bg-[#FEF2F2] border-[#FECACA]'
                          : isPending
                          ? 'bg-white border-[#EAEAEA]'
                          : 'bg-[#FAFAF8] border-[#F0F0EE] opacity-75'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#111111]">{rec.customer_name}</p>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                              Atrasado
                            </span>
                          )}
                          {!isPending && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#166534]">
                              Recebido
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#555555] mt-0.5">{rec.description}</p>
                        <p className="text-[11px] text-[#767676] mt-0.5 flex items-center gap-1">
                          <Calendar size={11} /> Combinado para:{' '}
                          <strong>
                            {new Date(rec.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </strong>
                          {rec.customer_phone && ` · WhatsApp: ${rec.customer_phone}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="text-sm font-extrabold text-[#111111] tabular-nums mr-1">
                          {formatBRL(rec.amount)}
                        </span>

                        {isPending && rec.customer_phone && (
                          <a
                            href={buildReceivableWhatsAppLink(rec)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#24A850] hover:bg-[#1e8e42] text-white text-xs font-bold transition-colors"
                            title="Enviar lembrete amigável no WhatsApp"
                          >
                            <MessageCircle size={12} /> Cobrar WhatsApp
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleReceivable(rec.id)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors',
                            isPending
                              ? 'bg-[#111111] text-white hover:bg-[#242424]'
                              : 'bg-[#F4F4F4] text-[#555555] hover:bg-[#E5E5E5]'
                          )}
                        >
                          <CheckCircle2 size={12} />
                          {isPending ? 'Dar Baixa (Recebido)' : 'Reabrir'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteReceivable(rec.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ABA 4: CONFIGURAÇÃO DE TAXAS DE MAQUININHA & META MENSAL
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
          <h2 className="text-base font-bold text-gray-900 mb-1">
            Configurações de Meta Mensal & Taxas da Maquininha
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            Esses percentuais são descontados automaticamente nas vendas do DRE para você saber exatamente quanto cai líquido na conta da loja.
          </p>

          <form onSubmit={handleSaveFinancialConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Meta de Faturamento Mensal da Loja (R$)
              </label>
              <input
                type="number"
                step="100"
                min="100"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Taxa Cartão de Crédito (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  value={creditFeeInput}
                  onChange={(e) => setCreditFeeInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Taxa Cartão de Débito (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  value={debitFeeInput}
                  onChange={(e) => setDebitFeeInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Taxa PIX PJ (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={pixFeeInput}
                  onChange={(e) => setPixFeeInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors"
            >
              {savingConfig ? 'Salvando...' : 'Salvar Parâmetros Financeiros'}
            </button>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL PDV RÁPIDO (LANÇAR VENDA DE PRODUTO OU SERVIÇO EXTRA)
         ══════════════════════════════════════════════════════════════════ */}
      {pdvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                Lançar Entrada no Caixa (PDV Rápido)
              </h3>
              <button
                type="button"
                onClick={() => setPdvOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4F4F4] rounded-xl">
              <button
                type="button"
                onClick={() => setPdvMode('product')}
                className={cn(
                  'py-2 rounded-lg text-xs font-bold transition-colors',
                  pdvMode === 'product'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Venda de Produto
              </button>
              <button
                type="button"
                onClick={() => setPdvMode('service')}
                className={cn(
                  'py-2 rounded-lg text-xs font-bold transition-colors',
                  pdvMode === 'service'
                    ? 'bg-white text-[#111111] shadow-2xs'
                    : 'text-[#767676] hover:text-[#111111]'
                )}
              >
                Serviço / Receita Extra
              </button>
            </div>

            <form onSubmit={handleConfirmPdv} className="space-y-3.5">
              {pdvMode === 'product' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Produto Vendido
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleSelectProductInPdv(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatBRL(p.price || 0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={pdvQty}
                        onChange={(e) => setPdvQty(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Preço Unitário Cobrado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={pdvUnitPrice}
                        onChange={(e) => setPdvUnitPrice(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Descrição do Serviço / Receita
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Troca de Tela, Aplicação de Película, Frete..."
                      value={srvDesc}
                      onChange={(e) => setSrvDesc(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Valor Cobrado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={srvAmount}
                        onChange={(e) => setSrvAmount(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Custo da Peça/Serviço (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00 (Opcional)"
                        value={srvCost}
                        onChange={(e) => setSrvCost(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Meio de Pagamento
                </label>
                <select
                  value={pdvPayment}
                  onChange={(e) => setPdvPayment(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="cash">Dinheiro</option>
                </select>
              </div>

              {pdvMode === 'product' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Observação / Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Cliente Lucas - WhatsApp"
                    value={pdvNote}
                    onChange={(e) => setPdvNote(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPdvOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPdv}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  {savingPdv ? 'Confirmando...' : 'Confirmar Entrada no Caixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}
