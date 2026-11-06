import { useState, useEffect } from 'react'
import { ShoppingBag, X, Plus, Minus, Trash2, MessageCircle, Package } from 'lucide-react'
import { useQuoteBag } from '@/lib/quoteBag'
import { useStore } from '@/hooks/useStore'
import { formatBRL, normalizeWhatsAppNumber } from '@/lib/utils'
import { recordWhatsAppClick } from '@/services/catalogIntelligence'

export function QuoteBagWidget() {
  const { items, totalCount, totalAmount, updateQuantity, clearBag } = useQuoteBag()
  const { settings } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [paymentPref, setPaymentPref] = useState<'PIX' | 'Cartão' | 'A combinar'>('PIX')

  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('alfa_quote_bag_open', handleOpen)
    return () => window.removeEventListener('alfa_quote_bag_open', handleOpen)
  }, [])

  if (totalCount === 0 && !isOpen) return null

  function handleSendOrderToWhatsApp() {
    if (items.length === 0) return

    const phone = normalizeWhatsAppNumber(settings?.whatsapp_number || '5511999999999')
    const storeName = settings?.store_name || 'Alfa Eletrônicos'

    // Registra clique de interesse para cada produto da sacola
    for (const item of items) {
      recordWhatsAppClick(item.product.id)
    }

    const lines = items.map((item, idx) => {
      const varLabel = item.variation ? ` (${item.variation})` : ''
      const unitPrice =
        item.product.show_price && item.product.price && item.product.price > 0
          ? formatBRL(item.product.price * item.quantity)
          : 'Sob consulta'
      return `${idx + 1}. *${item.quantity}x ${item.product.name}${varLabel}* — ${unitPrice}`
    })

    const intro = customerName.trim()
      ? `Olá, me chamo *${customerName.trim()}*! Selecionei estes itens no catálogo da *${storeName}*:`
      : `Olá! Selecionei estes itens no catálogo da *${storeName}* e gostaria de confirmar disponibilidade:`

    const totalLine =
      totalAmount > 0 ? `\n💰 *Valor total estimado:* ${formatBRL(totalAmount)}` : ''
    const paymentLine = `\n💳 *Preferência de pagamento:* ${paymentPref}`

    const fullText = `${intro}\n\n${lines.join('\n')}${totalLine}${paymentLine}\n\nAguardo retorno!`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(fullText)}`
    window.open(url, '_blank')
  }

  return (
    <>
      {/* Botão Flutuante da Sacola de Orçamento */}
      {totalCount > 0 && !isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-3 bg-[#111111] hover:bg-[#222222] text-white px-4 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] border border-white/15 transition-all duration-200 hover:scale-[1.02]"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#24A850] text-white">
            <ShoppingBag size={16} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-[#111111] text-[10px] font-extrabold flex items-center justify-center">
              {totalCount}
            </span>
          </div>
          <div className="text-left pr-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-300 font-semibold leading-none">
              Sacola de Orçamento
            </p>
            <p className="text-xs font-extrabold text-white tabular-nums mt-0.5">
              {totalAmount > 0 ? formatBRL(totalAmount) : `${totalCount} item(ns)`}
            </p>
          </div>
        </button>
      )}

      {/* Gaveta / Modal da Sacola */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-fade-in">
            {/* Topo */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#111111] text-white flex items-center justify-center">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#111111]">
                    Sacola de Orçamento ({totalCount})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Envie vários produtos de uma só vez para o nosso WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Lista de Itens */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-16 text-gray-400 space-y-2">
                  <ShoppingBag size={40} className="mx-auto stroke-1" />
                  <p className="text-sm font-medium text-gray-600">
                    Sua sacola de orçamento está vazia
                  </p>
                  <p className="text-xs text-gray-400">
                    Clique no botão "+ Sacola" nos produtos para cotar vários itens juntos.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const img =
                    item.product.product_images?.find((i) => i.is_primary)?.public_url ||
                    item.product.product_images?.[0]?.public_url
                  return (
                    <div
                      key={`${item.product.id}-${item.variation || ''}`}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white"
                    >
                      <div className="w-14 h-14 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={item.product.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Package size={20} className="text-gray-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#111111] truncate">
                          {item.product.name}
                        </p>
                        {item.variation && (
                          <p className="text-[11px] text-gray-500">{item.variation}</p>
                        )}
                        <p className="text-xs font-extrabold text-[#111111] tabular-nums mt-0.5">
                          {item.product.show_price && item.product.price
                            ? formatBRL(item.product.price * item.quantity)
                            : 'Sob consulta'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.product.id, item.variation, item.quantity - 1)
                          }
                          className="w-6 h-6 rounded-lg bg-white text-gray-700 flex items-center justify-center hover:bg-gray-200"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center text-xs font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.product.id, item.variation, item.quantity + 1)
                          }
                          className="w-6 h-6 rounded-lg bg-white text-gray-700 flex items-center justify-center hover:bg-gray-200"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Rodapé da Sacola */}
            {items.length > 0 && (
              <div className="p-5 border-t border-gray-200 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Seu Nome (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Lucas"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Forma de Pagamento
                    </label>
                    <select
                      value={paymentPref}
                      onChange={(e) =>
                        setPaymentPref(e.target.value as 'PIX' | 'Cartão' | 'A combinar')
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-[#111111]"
                    >
                      <option value="PIX">PIX</option>
                      <option value="Cartão">Cartão de Crédito</option>
                      <option value="A combinar">A combinar</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs text-gray-500">Total estimado</span>
                    <p className="text-lg font-extrabold text-[#111111] tabular-nums">
                      {totalAmount > 0 ? formatBRL(totalAmount) : 'Sob consulta'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearBag}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-medium"
                  >
                    <Trash2 size={13} /> Limpar sacola
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendOrderToWhatsApp}
                  className="w-full flex items-center justify-center gap-2 bg-[#24A850] hover:bg-[#1E8E42] text-white font-bold text-sm py-3.5 px-5 rounded-full transition-colors shadow-sm"
                >
                  <MessageCircle size={17} />
                  Enviar Pedido Completo no WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

