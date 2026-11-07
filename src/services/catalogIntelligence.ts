import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const BUCKET = 'store-assets'
const META_PATH = 'analytics/product-meta.json'
const MOVEMENTS_PATH = 'analytics/stock-movements.json'
const EXPENSES_PATH = 'analytics/store-expenses.json'
const RECEIVABLES_PATH = 'analytics/customer-receivables.json'
const EXTRA_INCOMES_PATH = 'analytics/extra-incomes.json'
const EXTENDED_SETTINGS_PATH = 'settings/extended-config.json'

const LOCAL_META_KEY = 'alfa_product_meta_v1'
const LOCAL_MOVEMENTS_KEY = 'alfa_stock_movements_v1'
const LOCAL_EXPENSES_KEY = 'alfa_store_expenses_v1'
const LOCAL_RECEIVABLES_KEY = 'alfa_customer_receivables_v1'
const LOCAL_EXTRA_INCOMES_KEY = 'alfa_extra_incomes_v1'
const LOCAL_SETTINGS_KEY = 'alfa_extended_settings_v1'

export interface ProductMetaItem {
  sku?: string // Código ou SKU interno do produto
  stock_quantity?: number | null
  low_stock_threshold?: number
  cost_price?: number | null // Preço de custo real (visível apenas no Admin)
  compare_at_price?: number | null // Preço antigo "De R$" para promoção
  supplier?: string // Fornecedor principal
  variations?: string[] // Ex: ["Preto", "Titânio Natural", "256GB"]
  views?: number // Visualizações reais da página do produto
  last_viewed_at?: string
  whatsapp_clicks?: number
  last_clicked_at?: string
  last_sale_at?: string
  total_units_sold?: number
  total_revenue?: number
  total_profit?: number
}

export type ProductMetaMap = Record<string, ProductMetaItem>

export type StockMovementType = 'in' | 'out' | 'adjustment'

export type StockMovementReason =
  | 'sale' // Venda para cliente
  | 'restock' // Compra / Entrada de fornecedor
  | 'warranty' // Troca / Garantia
  | 'loss' // Perda / Avaria / Defeito
  | 'gift' // Brinde comercial
  | 'adjustment' // Ajuste de balanço

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'other'

export interface StockMovement {
  id: string
  product_id: string
  product_name: string
  type: StockMovementType
  reason?: StockMovementReason
  payment_method?: PaymentMethod
  quantity: number
  previous_stock: number
  new_stock: number
  unit_price?: number // Preço de venda unitário
  unit_cost?: number // Preço de custo unitário
  total_value?: number // Valor total da operação (R$)
  profit_value?: number // Lucro líquido na venda (R$)
  supplier?: string
  responsible?: string // Operador responsável pela movimentação
  note: string
  created_at: string
}

export interface StoreExpense {
  id: string
  description: string
  category: 'fixa' | 'variavel' | 'marketing' | 'logistica' | 'impostos' | 'fornecedor'
  amount: number
  date: string
  due_date?: string
  status?: 'paid' | 'pending'
  created_at: string
}

export interface CustomerReceivable {
  id: string
  customer_name: string
  customer_phone: string
  description: string
  amount: number
  due_date: string
  status: 'pending' | 'received'
  created_at: string
  received_at?: string
}

export interface ExtraIncome {
  id: string
  description: string
  category: 'service' | 'accessory' | 'shipping' | 'other'
  amount: number
  cost_amount: number
  payment_method: PaymentMethod
  created_at: string
}

export interface FinancialConfig {
  monthly_revenue_goal: number
  credit_card_fee_pct: number
  debit_card_fee_pct: number
  pix_fee_pct: number
}

export interface ExtendedStoreConfig {
  whatsapp_message_template?: string
  hero_image_url?: string
  financial_config?: FinancialConfig
}

let memoryMetaCache: ProductMetaMap | null = null
let memoryMovementsCache: StockMovement[] | null = null
let memoryExpensesCache: StoreExpense[] | null = null
let memoryReceivablesCache: CustomerReceivable[] | null = null
let memoryExtraIncomesCache: ExtraIncome[] | null = null

// ── Leitura e escrita de metadados de produtos (Estoque, Custo, Promoção, Variações e Cliques) ──
export async function getAllProductMeta(): Promise<ProductMetaMap> {
  if (memoryMetaCache) return memoryMetaCache

  let localData: ProductMetaMap = {}
  try {
    const raw = localStorage.getItem(LOCAL_META_KEY)
    if (raw) localData = JSON.parse(raw)
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) {
    memoryMetaCache = localData
    return localData
  }

  let remoteData: ProductMetaMap = {}
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(META_PATH)
    if (!error && data) {
      const text = await data.text()
      remoteData = JSON.parse(text) as ProductMetaMap
    }
  } catch {
    // Arquivo ainda não existe no bucket, usa local
  }

  // Tenta enriquecer com colunas relacionais da tabela products se existirem
  try {
    const { data: dbProds, error: pErr } = await supabase
      .from('products')
      .select('id, stock_quantity, low_stock_threshold, cost_price, compare_at_price, supplier, whatsapp_clicks, last_clicked_at, variations')

    if (!pErr && dbProds && dbProds.length > 0) {
      for (const p of dbProds) {
        if (!remoteData[p.id]) remoteData[p.id] = {}
        if (p.stock_quantity !== null && p.stock_quantity !== undefined) {
          remoteData[p.id].stock_quantity = p.stock_quantity
        }
        if (p.low_stock_threshold !== null && p.low_stock_threshold !== undefined) {
          remoteData[p.id].low_stock_threshold = p.low_stock_threshold
        }
        if (p.cost_price !== null && p.cost_price !== undefined) {
          remoteData[p.id].cost_price = Number(p.cost_price)
        }
        if (p.compare_at_price !== null && p.compare_at_price !== undefined) {
          remoteData[p.id].compare_at_price = Number(p.compare_at_price)
        }
        if (p.supplier) {
          remoteData[p.id].supplier = p.supplier
        }
        if (p.whatsapp_clicks !== null && p.whatsapp_clicks !== undefined) {
          remoteData[p.id].whatsapp_clicks = p.whatsapp_clicks
        }
        if (p.last_clicked_at) {
          remoteData[p.id].last_clicked_at = p.last_clicked_at
        }
        if (p.variations && Array.isArray(p.variations)) {
          remoteData[p.id].variations = p.variations
        }
      }
    }
  } catch {
    // colunas ainda não migradas, mantém remoteData do storage
  }

  memoryMetaCache = { ...localData, ...remoteData }
  try {
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify(memoryMetaCache))
  } catch {
    // ignore
  }
  return memoryMetaCache
}

export async function saveAllProductMeta(map: ProductMetaMap): Promise<void> {
  memoryMetaCache = map
  try {
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) return

  try {
    const blob = new Blob([JSON.stringify(map)], { type: 'application/json' })
    await supabase.storage.from(BUCKET).upload(META_PATH, blob, {
      upsert: true,
      contentType: 'application/json',
    })
  } catch {
    // fallback silencioso no localStorage
  }
}

export async function updateProductMeta(
  productId: string,
  patch: Partial<ProductMetaItem>
): Promise<ProductMetaItem> {
  const all = await getAllProductMeta()
  const current = all[productId] || {}
  const updated: ProductMetaItem = {
    ...current,
    ...patch,
  }
  const nextMap = { ...all, [productId]: updated }
  await saveAllProductMeta(nextMap)

  // Persiste também diretamente nas colunas da tabela products quando disponível
  if (isSupabaseConfigured) {
    const dbPatch: Record<string, unknown> = {}
    if (patch.stock_quantity !== undefined) dbPatch.stock_quantity = patch.stock_quantity
    if (patch.low_stock_threshold !== undefined) dbPatch.low_stock_threshold = patch.low_stock_threshold
    if (patch.cost_price !== undefined) dbPatch.cost_price = patch.cost_price
    if (patch.compare_at_price !== undefined) dbPatch.compare_at_price = patch.compare_at_price
    if (patch.supplier !== undefined) dbPatch.supplier = patch.supplier
    if (patch.whatsapp_clicks !== undefined) dbPatch.whatsapp_clicks = patch.whatsapp_clicks
    if (patch.last_clicked_at !== undefined) dbPatch.last_clicked_at = patch.last_clicked_at
    if (patch.variations !== undefined) dbPatch.variations = patch.variations

    if (Object.keys(dbPatch).length > 0) {
      try {
        await supabase.from('products').update(dbPatch).eq('id', productId)
      } catch {
        // ignora se colunas ainda não existem
      }
    }
  }

  return updated
}

// Registra visualização real da página de detalhes de um produto (com proteção contra repetição na mesma sessão)
const viewedSessionSet = new Set<string>()
export async function recordProductView(productId: string): Promise<void> {
  if (!productId || viewedSessionSet.has(productId)) return
  viewedSessionSet.add(productId)
  try {
    const all = await getAllProductMeta()
    const current = all[productId] || {}
    const nextViews = (current.views || 0) + 1
    await updateProductMeta(productId, {
      views: nextViews,
      last_viewed_at: new Date().toISOString(),
    })
  } catch {
    // Não bloqueia a visualização do cliente
  }
}

// Registra um clique no botão do WhatsApp de um produto (apenas métrica de interesse, NUNCA uma venda concluída)
export async function recordWhatsAppClick(productId: string): Promise<void> {
  try {
    const all = await getAllProductMeta()
    const current = all[productId] || {}
    const nextClicks = (current.whatsapp_clicks || 0) + 1
    await updateProductMeta(productId, {
      whatsapp_clicks: nextClicks,
      last_clicked_at: new Date().toISOString(),
    })
  } catch {
    // Não bloqueia o redirecionamento do cliente
  }
}

// ── Histórico e Registro de Movimentações Financeiras e de Estoque ──
export async function getStockMovements(): Promise<StockMovement[]> {
  if (memoryMovementsCache) return memoryMovementsCache

  let localList: StockMovement[] = []
  try {
    const raw = localStorage.getItem(LOCAL_MOVEMENTS_KEY)
    if (raw) localList = JSON.parse(raw)
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) {
    memoryMovementsCache = localList
    return localList
  }

  // Tenta carregar da tabela relacional pública
  try {
    const { data: dbRows, error: dbError } = await supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (!dbError && dbRows && dbRows.length > 0) {
      memoryMovementsCache = dbRows as StockMovement[]
      localStorage.setItem(LOCAL_MOVEMENTS_KEY, JSON.stringify(dbRows))
      return memoryMovementsCache
    }
  } catch {
    // segue para fallback do storage
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(MOVEMENTS_PATH)
    if (!error && data) {
      const text = await data.text()
      const remoteList = JSON.parse(text) as StockMovement[]
      memoryMovementsCache = remoteList
      localStorage.setItem(LOCAL_MOVEMENTS_KEY, JSON.stringify(remoteList))
      return remoteList
    }
  } catch {
    // ignore
  }

  memoryMovementsCache = localList
  return localList
}

export async function registerStockMovement(params: {
  productId: string
  productName: string
  type: StockMovementType
  reason?: StockMovementReason
  paymentMethod?: PaymentMethod
  quantity: number
  unitPrice?: number
  unitCost?: number
  supplier?: string
  responsible?: string
  note?: string
}): Promise<{ newStock: number; movement: StockMovement; marginWarning?: string }> {
  const allMeta = await getAllProductMeta()
  const currentMeta = allMeta[params.productId] || {}
  const previousStock = currentMeta.stock_quantity ?? 0

  const qty = Math.abs(params.quantity)
  let newStock = previousStock
  if (params.type === 'in') {
    newStock = previousStock + qty
  } else if (params.type === 'out') {
    newStock = Math.max(0, previousStock - qty)
  } else {
    newStock = Math.max(0, params.quantity)
  }

  const effectiveReason: StockMovementReason =
    params.reason ||
    (params.type === 'in'
      ? 'restock'
      : params.type === 'out'
        ? 'sale'
        : 'adjustment')

  const unitCost =
    params.unitCost !== undefined && params.unitCost > 0
      ? params.unitCost
      : currentMeta.cost_price ?? 0
  const unitPrice = params.unitPrice ?? 0

  let totalValue = 0
  let profitValue = 0

  if (effectiveReason === 'sale') {
    totalValue = unitPrice * qty
    // Só calcula lucro positivo/negativo se houver custo real informado; caso contrário, registra 0 para não distorcer com estimativas
    profitValue = unitCost > 0 ? (unitPrice - unitCost) * qty : 0
  } else if (effectiveReason === 'restock') {
    totalValue = unitCost * qty
  } else if (effectiveReason === 'warranty' || effectiveReason === 'loss' || effectiveReason === 'gift') {
    totalValue = unitCost * qty
    profitValue = -(unitCost * qty) // Custo absorvido pela loja
  }

  const metaPatch: Partial<ProductMetaItem> = {
    stock_quantity: newStock,
    low_stock_threshold: currentMeta.low_stock_threshold ?? 2,
  }

  if (params.unitCost !== undefined && params.unitCost > 0) {
    metaPatch.cost_price = params.unitCost
  }
  if (params.supplier?.trim()) {
    metaPatch.supplier = params.supplier.trim()
  }
  if (effectiveReason === 'sale') {
    metaPatch.last_sale_at = new Date().toISOString()
    metaPatch.total_units_sold = (currentMeta.total_units_sold || 0) + qty
    metaPatch.total_revenue = (currentMeta.total_revenue || 0) + totalValue
    metaPatch.total_profit = (currentMeta.total_profit || 0) + profitValue
  }

  await updateProductMeta(params.productId, metaPatch)

  // Verifica se o novo custo comprimiu a margem abaixo de 20%
  let marginWarning: string | undefined
  if (params.type === 'in' && unitCost > 0 && unitPrice > 0) {
    const marginPct = ((unitPrice - unitCost) / unitPrice) * 100
    if (marginPct < 20) {
      marginWarning = `Atenção: Com o novo custo de R$ ${unitCost.toFixed(2)}, a margem de "${params.productName}" caiu para ${marginPct.toFixed(1)}%. Considere reajustar o preço de venda.`
    }
  }

  // Atualiza status de disponibilidade automaticamente no Supabase
  if (isSupabaseConfigured) {
    if (newStock === 0) {
      await supabase
        .from('products')
        .update({ availability: 'unavailable', updated_at: new Date().toISOString() })
        .eq('id', params.productId)
    } else if (newStock > 0) {
      await supabase
        .from('products')
        .update({ availability: 'available', updated_at: new Date().toISOString() })
        .eq('id', params.productId)
    }
  }

  const reasonLabels: Record<StockMovementReason, string> = {
    sale: 'Venda realizada',
    restock: 'Entrada de fornecedor',
    warranty: 'Saída por Garantia / Troca',
    loss: 'Baixa por Avaria / Perda',
    gift: 'Saída para Brinde',
    adjustment: 'Ajuste de inventário',
  }

  const movement: StockMovement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: params.productId,
    product_name: params.productName,
    type: params.type,
    reason: effectiveReason,
    payment_method: params.paymentMethod,
    quantity: qty,
    previous_stock: previousStock,
    new_stock: newStock,
    unit_price: unitPrice,
    unit_cost: unitCost,
    total_value: totalValue,
    profit_value: profitValue,
    supplier: params.supplier,
    responsible: params.responsible?.trim() || 'Operador Admin',
    note: params.note?.trim() || reasonLabels[effectiveReason],
    created_at: new Date().toISOString(),
  }

  const existingMovements = await getStockMovements()
  const nextMovements = [movement, ...existingMovements].slice(0, 300)
  memoryMovementsCache = nextMovements

  try {
    localStorage.setItem(LOCAL_MOVEMENTS_KEY, JSON.stringify(nextMovements))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    // 1. Tenta gravar na tabela relacional de histórico
    try {
      await supabase.from('stock_movements').insert({
        product_id: params.productId,
        product_name: params.productName,
        type: params.type,
        reason: effectiveReason,
        payment_method: params.paymentMethod || null,
        quantity: qty,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_price: unitPrice,
        unit_cost: unitCost,
        total_value: totalValue,
        profit_value: profitValue,
        supplier: params.supplier || null,
        note: params.note?.trim() || reasonLabels[effectiveReason],
      })
    } catch {
      // ignora se tabela ainda não existe
    }

    // 2. Grava também no snapshot JSON para compatibilidade imediata
    try {
      const blob = new Blob([JSON.stringify(nextMovements)], {
        type: 'application/json',
      })
      await supabase.storage.from(BUCKET).upload(MOVEMENTS_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return { newStock, movement, marginWarning }
}

// ── Gestão de Despesas Operacionais da Loja (Para DRE Simplificado) ──
export async function getStoreExpenses(): Promise<StoreExpense[]> {
  if (memoryExpensesCache) return memoryExpensesCache

  let localList: StoreExpense[] = []
  try {
    const raw = localStorage.getItem(LOCAL_EXPENSES_KEY)
    if (raw) localList = JSON.parse(raw)
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) {
    memoryExpensesCache = localList
    return localList
  }

  // Tenta carregar da tabela store_expenses
  try {
    const { data: dbRows, error: dbError } = await supabase
      .from('store_expenses')
      .select('*')
      .order('date', { ascending: false })

    if (!dbError && dbRows && dbRows.length > 0) {
      memoryExpensesCache = dbRows as StoreExpense[]
      localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(dbRows))
      return memoryExpensesCache
    }
  } catch {
    // fallback para storage
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(EXPENSES_PATH)
    if (!error && data) {
      const text = await data.text()
      const remoteList = JSON.parse(text) as StoreExpense[]
      memoryExpensesCache = remoteList
      localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(remoteList))
      return remoteList
    }
  } catch {
    // ignore
  }

  memoryExpensesCache = localList
  return localList
}

export async function addStoreExpense(params: {
  description: string
  category: StoreExpense['category']
  amount: number
  date?: string
  due_date?: string
  status?: 'paid' | 'pending'
}): Promise<StoreExpense[]> {
  const current = await getStoreExpenses()
  const newItem: StoreExpense = {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: params.description.trim(),
    category: params.category,
    amount: Math.abs(params.amount),
    date: params.date || new Date().toISOString().slice(0, 10),
    due_date: params.due_date || params.date || new Date().toISOString().slice(0, 10),
    status: params.status || 'paid',
    created_at: new Date().toISOString(),
  }

  const next = [newItem, ...current]
  memoryExpensesCache = next

  try {
    localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('store_expenses').insert({
        description: newItem.description,
        category: newItem.category,
        amount: newItem.amount,
        date: newItem.date,
        due_date: newItem.due_date || null,
        status: newItem.status,
      })
    } catch {
      // ignora se tabela ainda não existe
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(EXPENSES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

export async function toggleStoreExpenseStatus(id: string): Promise<StoreExpense[]> {
  const current = await getStoreExpenses()
  const next = current.map((item) =>
    item.id === id
      ? {
        ...item,
        status: (item.status === 'pending' ? 'paid' : 'pending') as 'paid' | 'pending',
      }
      : item
  )
  memoryExpensesCache = next

  try {
    localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    const updatedItem = next.find((i) => i.id === id)
    if (updatedItem) {
      try {
        await supabase
          .from('store_expenses')
          .update({ status: updatedItem.status })
          .eq('id', id)
      } catch {
        // ignore
      }
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(EXPENSES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

export async function deleteStoreExpense(id: string): Promise<StoreExpense[]> {
  const current = await getStoreExpenses()
  const next = current.filter((item) => item.id !== id)
  memoryExpensesCache = next

  try {
    localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('store_expenses').delete().eq('id', id)
    } catch {
      // ignore
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(EXPENSES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

// ── Contas a Receber / Fiado (CustomerReceivable) ──
export async function getCustomerReceivables(): Promise<CustomerReceivable[]> {
  if (memoryReceivablesCache) return memoryReceivablesCache

  let localList: CustomerReceivable[] = []
  try {
    const raw = localStorage.getItem(LOCAL_RECEIVABLES_KEY)
    if (raw) localList = JSON.parse(raw)
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) {
    memoryReceivablesCache = localList
    return localList
  }

  // Tenta carregar da tabela customer_receivables
  try {
    const { data: dbRows, error: dbError } = await supabase
      .from('customer_receivables')
      .select('*')
      .order('due_date', { ascending: true })

    if (!dbError && dbRows && dbRows.length > 0) {
      memoryReceivablesCache = dbRows as CustomerReceivable[]
      localStorage.setItem(LOCAL_RECEIVABLES_KEY, JSON.stringify(dbRows))
      return memoryReceivablesCache
    }
  } catch {
    // fallback para storage
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(RECEIVABLES_PATH)
    if (!error && data) {
      const text = await data.text()
      const remoteList = JSON.parse(text) as CustomerReceivable[]
      if (Array.isArray(remoteList)) {
        memoryReceivablesCache = remoteList
        localStorage.setItem(LOCAL_RECEIVABLES_KEY, JSON.stringify(remoteList))
        return remoteList
      }
    }
  } catch {
    // ignore
  }

  memoryReceivablesCache = localList
  return localList
}

export async function addCustomerReceivable(params: {
  customer_name: string
  customer_phone: string
  description: string
  amount: number
  due_date: string
}): Promise<CustomerReceivable[]> {
  const current = await getCustomerReceivables()
  const newItem: CustomerReceivable = {
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customer_name: params.customer_name.trim(),
    customer_phone: params.customer_phone.trim(),
    description: params.description.trim(),
    amount: Math.abs(params.amount),
    due_date: params.due_date || new Date().toISOString().slice(0, 10),
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  const next = [newItem, ...current]
  memoryReceivablesCache = next

  try {
    localStorage.setItem(LOCAL_RECEIVABLES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('customer_receivables').insert({
        customer_name: newItem.customer_name,
        customer_phone: newItem.customer_phone || null,
        description: newItem.description,
        amount: newItem.amount,
        due_date: newItem.due_date,
        status: newItem.status,
      })
    } catch {
      // ignora se tabela ainda não existe
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(RECEIVABLES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

export async function toggleCustomerReceivableStatus(id: string): Promise<CustomerReceivable[]> {
  const current = await getCustomerReceivables()
  const next = current.map((item) =>
    item.id === id
      ? {
        ...item,
        status: (item.status === 'pending' ? 'received' : 'pending') as 'pending' | 'received',
        received_at: item.status === 'pending' ? new Date().toISOString() : undefined,
      }
      : item
  )
  memoryReceivablesCache = next

  try {
    localStorage.setItem(LOCAL_RECEIVABLES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    const updated = next.find((i) => i.id === id)
    if (updated) {
      try {
        await supabase
          .from('customer_receivables')
          .update({
            status: updated.status,
            received_at: updated.received_at || null,
          })
          .eq('id', id)
      } catch {
        // ignore
      }
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(RECEIVABLES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

export async function deleteCustomerReceivable(id: string): Promise<CustomerReceivable[]> {
  const current = await getCustomerReceivables()
  const next = current.filter((item) => item.id !== id)
  memoryReceivablesCache = next

  try {
    localStorage.setItem(LOCAL_RECEIVABLES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('customer_receivables').delete().eq('id', id)
    } catch {
      // ignore
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(RECEIVABLES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

// ── Receitas Extras / Serviços / Assistência Técnica (ExtraIncome) ──
export async function getExtraIncomes(): Promise<ExtraIncome[]> {
  if (memoryExtraIncomesCache) return memoryExtraIncomesCache

  let localList: ExtraIncome[] = []
  try {
    const raw = localStorage.getItem(LOCAL_EXTRA_INCOMES_KEY)
    if (raw) localList = JSON.parse(raw)
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) {
    memoryExtraIncomesCache = localList
    return localList
  }

  // Tenta carregar da tabela extra_incomes
  try {
    const { data: dbRows, error: dbError } = await supabase
      .from('extra_incomes')
      .select('*')
      .order('created_at', { ascending: false })

    if (!dbError && dbRows && dbRows.length > 0) {
      memoryExtraIncomesCache = dbRows as ExtraIncome[]
      localStorage.setItem(LOCAL_EXTRA_INCOMES_KEY, JSON.stringify(dbRows))
      return memoryExtraIncomesCache
    }
  } catch {
    // fallback para storage
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(EXTRA_INCOMES_PATH)
    if (!error && data) {
      const text = await data.text()
      const remoteList = JSON.parse(text) as ExtraIncome[]
      if (Array.isArray(remoteList)) {
        memoryExtraIncomesCache = remoteList
        localStorage.setItem(LOCAL_EXTRA_INCOMES_KEY, JSON.stringify(remoteList))
        return remoteList
      }
    }
  } catch {
    // ignore
  }

  memoryExtraIncomesCache = localList
  return localList
}

export async function addExtraIncome(params: {
  description: string
  category: ExtraIncome['category']
  amount: number
  cost_amount?: number
  payment_method: PaymentMethod
}): Promise<ExtraIncome[]> {
  const current = await getExtraIncomes()
  const newItem: ExtraIncome = {
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: params.description.trim(),
    category: params.category,
    amount: Math.abs(params.amount),
    cost_amount: Math.abs(params.cost_amount || 0),
    payment_method: params.payment_method,
    created_at: new Date().toISOString(),
  }

  const next = [newItem, ...current]
  memoryExtraIncomesCache = next

  try {
    localStorage.setItem(LOCAL_EXTRA_INCOMES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('extra_incomes').insert({
        description: newItem.description,
        category: newItem.category,
        amount: newItem.amount,
        cost_amount: newItem.cost_amount,
        payment_method: newItem.payment_method,
      })
    } catch {
      // ignore
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(EXTRA_INCOMES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

export async function deleteExtraIncome(id: string): Promise<ExtraIncome[]> {
  const current = await getExtraIncomes()
  const next = current.filter((item) => item.id !== id)
  memoryExtraIncomesCache = next

  try {
    localStorage.setItem(LOCAL_EXTRA_INCOMES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('extra_incomes').delete().eq('id', id)
    } catch {
      // ignore
    }

    try {
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' })
      await supabase.storage.from(BUCKET).upload(EXTRA_INCOMES_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      })
    } catch {
      // ignore
    }
  }

  return next
}

// ── Configurações estendidas da loja (Template WhatsApp + Imagem Hero) ──
export async function getExtendedStoreConfig(): Promise<ExtendedStoreConfig> {
  let localCfg: ExtendedStoreConfig = {}
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY)
    if (raw) localCfg = JSON.parse(raw)
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) return localCfg

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(EXTENDED_SETTINGS_PATH)
    if (!error && data) {
      const text = await data.text()
      const remoteCfg = JSON.parse(text) as ExtendedStoreConfig
      const merged = { ...localCfg, ...remoteCfg }
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(merged))
      return merged
    }
  } catch {
    // ignore
  }

  return localCfg
}

export async function saveExtendedStoreConfig(
  cfg: ExtendedStoreConfig
): Promise<void> {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(cfg))
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured) return

  try {
    const blob = new Blob([JSON.stringify(cfg)], { type: 'application/json' })
    await supabase.storage.from(BUCKET).upload(EXTENDED_SETTINGS_PATH, blob, {
      upsert: true,
      contentType: 'application/json',
    })
  } catch {
    // ignore
  }
}

// ── Upload de banner personalizado do Hero ──
export async function uploadHeroBannerImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `banners/hero-banner-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(`Upload do banner falhou: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ── Gerador Inteligente de Descrição Comercial (IA Assistiva) ──
export function generateSmartProductCopy(
  productName: string,
  categoryName: string = ''
): { shortDescription: string; fullDescription: string } {
  const name = productName.trim()
  const lower = `${name} ${categoryName}`.toLowerCase()

  if (/iphone|galaxy|xiaomi|redmi|motorola|smartphone|celular/.test(lower)) {
    return {
      shortDescription: `Desempenho de última geração, câmeras de alta definição e bateria para o dia todo.`,
      fullDescription: `${name} original com garantia e procedência na Alfa Eletrônicos.\n\n• Tela de altíssima definição com cores vibrantes e fluidez superior\n• Conjunto de câmeras avançado para fotos e vídeos com qualidade profissional\n• Processador rápido para multitarefas, jogos e produtividade\n• Bateria de longa duração com suporte a carregamento rápido\n\nConsulte disponibilidade de cores e capacidades diretamente pelo nosso WhatsApp.`,
    }
  }

  if (/perfume|eau de parfum|edt|edp|fragrância|colônia|arab|lattafa|dior|chanel/.test(lower)) {
    return {
      shortDescription: `Fragrância importada original com alta fixação e projeção marcante.`,
      fullDescription: `${name} — fragrância importada 100% original selecionada pela Alfa Eletrônicos.\n\n• Notas olfativas sofisticadas e envolventes para ocasiões especiais ou uso diário\n• Excelente fixação na pele e projeção de longa duração\n• Frasco original lacrado com acabamento de luxo\n\nGaranta o seu ou tire dúvidas sobre as notas da fragrância falando com nossa equipe no WhatsApp.`,
    }
  }

  if (/fone|airpods|earbuds|headphone|jbl|caixa de som|bluetooth|áudio/.test(lower)) {
    return {
      shortDescription: `Áudio cristalino com graves potentes, conexão Bluetooth estável e máximo conforto.`,
      fullDescription: `${name} com qualidade sonora premium e conexão rápida sem fios.\n\n• Graves profundos e agudos nítidos para músicas, chamadas e vídeos\n• Design ergonômico e confortável para horas de uso contínuo\n• Bateria de longa autonomia e conexão Bluetooth estável\n\nChame no WhatsApp para confirmar disponibilidade a pronta entrega!`,
    }
  }

  if (/watch|relógio|smartwatch|garmin|apple watch|pulseira/.test(lower)) {
    return {
      shortDescription: `Estilo, monitoramento completo de saúde e notificações direto no seu pulso.`,
      fullDescription: `${name} — tecnologia vestível para acompanhar sua rotina e seus treinos.\n\n• Visor de alta nitidez com mostradores personalizáveis\n• Monitoramento de frequência cardíaca, atividades físicas e sono\n• Recebimento de notificações e excelente autonomia de bateria\n• Acabamento resistente e pulseira confortável\n\nFale conosco no WhatsApp para mais detalhes e opções de cores.`,
    }
  }

  if (/carregador|cabo|power bank|bateria|fonte|turbo|magsafe/.test(lower)) {
    return {
      shortDescription: `Carregamento turbo seguro, alta durabilidade e proteção inteligente.`,
      fullDescription: `${name} selecionado para garantir energia rápida e segura para seus dispositivos.\n\n• Tecnologia de carregamento rápido com proteção contra sobrecarga e superaquecimento\n• Construção reforçada de alta durabilidade\n• Compatibilidade garantida com os principais aparelhos do mercado\n\nConsulte nossa equipe pelo WhatsApp para pronta entrega.`,
    }
  }

  if (/chocolate|importado|lindt|milka|ferrero|doce|cacau/.test(lower)) {
    return {
      shortDescription: `Sabor irresistível e cremosidade única — perfeito para presentear ou saborear.`,
      fullDescription: `${name} — produto selecionado com qualidade superior.\n\n• Textura cremosa e ingredientes selecionados\n• Excelente opção para presentear ou aproveitar momentos especiais\n\nConsulte disponibilidade atualizada em nosso WhatsApp!`,
    }
  }

  return {
    shortDescription: `Qualidade superior, procedência garantida e pronta entrega na Alfa Eletrônicos.`,
    fullDescription: `${name} disponível no catálogo oficial da Alfa Eletrônicos.\n\n• Produto selecionado com alto padrão de qualidade e acabamento\n• Atendimento especializado para tirar todas as suas dúvidas\n• Consulte condições especiais e disponibilidade imediata pelo nosso WhatsApp.`,
  }
}
