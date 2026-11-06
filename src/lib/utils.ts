import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formata valor em reais brasileiros
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Gera slug a partir de texto
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Normaliza número de telefone para formato WhatsApp (somente dígitos, com código do país)
export function normalizeWhatsAppNumber(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return '5511999999999'
  // Se não começa com código de país (Brasil = 55), adiciona
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}` // celular ou fixo BR com DDD
  return digits
}

// Gera link WhatsApp com mensagem pré-preenchida
export function buildWhatsAppLink(
  phone: string,
  productName: string,
  productUrl: string,
  customTemplate?: string | null
): string {
  const normalized = normalizeWhatsAppNumber(phone)
  let rawText = customTemplate?.trim()
  if (rawText) {
    rawText = rawText
      .replace(/{produto}/gi, productName)
      .replace(/{link}/gi, productUrl)
  } else {
    rawText =
      `Olá, Alfa Eletrônicos! Tenho interesse no produto *${productName}*. ` +
      `Vi o item no catálogo de vocês: ${productUrl}. ` +
      `Poderiam me informar mais detalhes sobre ele?`
  }

  return `https://wa.me/${normalized}?text=${encodeURIComponent(rawText)}`
}

// Trunca texto com reticências
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

// Valida URL de imagem
export function isValidImageUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Formata bytes para exibição amigável
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
