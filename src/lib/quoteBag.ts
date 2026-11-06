import { useState, useEffect } from 'react'
import type { Product } from '@/types'

export interface QuoteBagItem {
  product: Product
  quantity: number
  variation?: string
}

const STORAGE_KEY = 'alfa_quote_bag_v1'
const EVENT_NAME = 'alfa_quote_bag_updated'

export function getQuoteBag(): QuoteBagItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQuoteBag(items: QuoteBagItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    // ignore
  }
}

export function addToQuoteBag(product: Product, variation?: string, qty: number = 1) {
  const current = getQuoteBag()
  const existingIdx = current.findIndex(
    (item) => item.product.id === product.id && (item.variation || '') === (variation || '')
  )

  if (existingIdx >= 0) {
    current[existingIdx].quantity += qty
  } else {
    current.push({
      product,
      quantity: qty,
      variation,
    })
  }
  saveQuoteBag([...current])
}

export function updateQuoteBagQuantity(productId: string, variation: string | undefined, quantity: number) {
  const current = getQuoteBag()
  const next = current
    .map((item) =>
      item.product.id === productId && (item.variation || '') === (variation || '')
        ? { ...item, quantity }
        : item
    )
    .filter((item) => item.quantity > 0)
  saveQuoteBag(next)
}

export function clearQuoteBag() {
  saveQuoteBag([])
}

export function openQuoteBagDrawer() {
  window.dispatchEvent(new CustomEvent('alfa_quote_bag_open'))
}

export function useQuoteBag() {
  const [items, setItems] = useState<QuoteBagItem[]>(() => getQuoteBag())

  useEffect(() => {
    const handleUpdate = () => setItems(getQuoteBag())
    window.addEventListener(EVENT_NAME, handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const totalCount = items.reduce((acc, item) => acc + item.quantity, 0)
  const totalAmount = items.reduce(
    (acc, item) => acc + (item.product.show_price && item.product.price ? item.product.price * item.quantity : 0),
    0
  )

  return {
    items,
    totalCount,
    totalAmount,
    addItem: addToQuoteBag,
    updateQuantity: updateQuoteBagQuantity,
    clearBag: clearQuoteBag,
    openDrawer: openQuoteBagDrawer,
  }
}

