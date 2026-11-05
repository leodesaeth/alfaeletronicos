import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Save, Upload, Phone, Loader2, CheckCircle } from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { getStoreSettings, updateStoreSettings, uploadStoreLogo, getLogoUrl } from '@/services/storeSettings'
import type { StoreSettings } from '@/types'
import { Input, Textarea } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/StateComponents'
import { useStore } from '@/hooks/useStore'
import toast from 'react-hot-toast'

export function StoreSettingsPage() {
  const { refetch } = useStore()
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    store_name: '',
    store_description: '',
    whatsapp_number: '',
    primary_color: '#1769FF',
    hero_title: '',
    hero_description: '',
    contact_email: '',
    contact_address: '',
    footer_text: '',
  })

  useEffect(() => {
    getStoreSettings().then((data) => {
      if (data) {
        setSettings(data)
        setForm({
          store_name: data.store_name || '',
          store_description: data.store_description || '',
          whatsapp_number: data.whatsapp_number || '',
          primary_color: data.primary_color || '#1769FF',
          hero_title: data.hero_title || '',
          hero_description: data.hero_description || '',
          contact_email: data.contact_email || '',
          contact_address: data.contact_address || '',
          footer_text: data.footer_text || '',
        })
      }
      setLoading(false)
    })
  }, [])

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!settings) return
    if (!form.store_name.trim()) {
      toast.error('O nome da loja é obrigatório.')
      return
    }

    // Validar WhatsApp (somente dígitos)
    if (form.whatsapp_number) {
      const digits = form.whatsapp_number.replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 15) {
        toast.error('Número de WhatsApp inválido. Use o formato: 5511999999999')
        return
      }
    }

    setSaving(true)
    try {
      const updated = await updateStoreSettings(settings.id, form)
      setSettings(updated)
      await refetch()
      setSaved(true)
      toast.success('Configurações salvas com sucesso!')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !settings) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      toast.error('Formato inválido. Use JPEG, PNG, WebP ou SVG.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2 MB.')
      return
    }

    setLogoUploading(true)
    try {
      const path = await uploadStoreLogo(file)
      // Salva o logo_path diretamente no banco
      const { data: dbData } = await supabase
        .from('store_settings')
        .update({ logo_path: path })
        .eq('id', settings.id)
        .select()
        .single()
      if (dbData) {
        setSettings(dbData)
        await refetch()
      }
      toast.success('Logo atualizado com sucesso!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>

  const logoUrl = getLogoUrl(settings?.logo_path ?? null)

  return (
    <AdminLayout>
      <div className="flex flex-col gap-5 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-graphite">Aparência e dados da loja</h1>
            <p className="text-sm text-muted mt-0.5">Configure as informações visíveis ao público</p>
          </div>
          <Button
            onClick={handleSave}
            loading={saving}
            icon={saved ? <CheckCircle size={16} /> : <Save size={16} />}
            variant={saved ? 'secondary' : 'primary'}
          >
            {saved ? 'Salvo!' : 'Salvar'}
          </Button>
        </div>

        {/* Logo */}
        <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-graphite">Logo da loja</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <span className="text-xs text-muted text-center leading-tight px-1">Sem logo</span>
              )}
            </div>
            <div>
              <label
                htmlFor="logo-upload"
                className={`flex items-center gap-2 text-sm font-medium text-brand border border-brand/30 hover:bg-brand/5 px-4 py-2 rounded-lg cursor-pointer transition-colors ${logoUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {logoUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {logoUploading ? 'Enviando...' : 'Enviar logo'}
              </label>
              <input
                id="logo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                disabled={logoUploading}
                onChange={handleLogoUpload}
              />
              <p className="text-xs text-muted mt-1.5">JPEG, PNG, WebP ou SVG · Máx. 2 MB</p>
            </div>
          </div>
        </section>

        {/* Identidade */}
        <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-graphite">Identidade da loja</h2>
          <Input
            label="Nome da loja"
            required
            value={form.store_name}
            onChange={(e) => update('store_name', e.target.value)}
            placeholder="Alfa Eletrônicos"
          />
          <Textarea
            label="Descrição institucional"
            value={form.store_description}
            onChange={(e) => update('store_description', e.target.value)}
            placeholder="Uma breve descrição da loja exibida no rodapé..."
            rows={3}
          />
        </section>

        {/* Página inicial */}
        <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-graphite">Página inicial (hero)</h2>
          <Input
            label="Título principal"
            value={form.hero_title}
            onChange={(e) => update('hero_title', e.target.value)}
            placeholder="Encontre os melhores eletrônicos"
          />
          <Textarea
            label="Descrição"
            value={form.hero_description}
            onChange={(e) => update('hero_description', e.target.value)}
            placeholder="Explore nosso catálogo com qualidade e confiança."
            rows={2}
          />
        </section>

        {/* WhatsApp */}
        <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-whatsapp" />
            <h2 className="font-semibold text-graphite">WhatsApp comercial</h2>
          </div>
          <Input
            label="Número de WhatsApp"
            value={form.whatsapp_number}
            onChange={(e) => update('whatsapp_number', e.target.value)}
            placeholder="5511999999999"
            hint="Somente números, com código do país. Ex: 5511999999999"
            type="tel"
          />
          {form.whatsapp_number && (
            <div className="text-xs text-muted bg-surface border border-gray-200 rounded-lg px-3 py-2">
              Prévia do link:{' '}
              <a
                href={`https://wa.me/${form.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline break-all"
              >
                wa.me/{form.whatsapp_number.replace(/\D/g, '')}
              </a>
            </div>
          )}
        </section>

        {/* Contato */}
        <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-graphite">Informações de contato</h2>
          <Input
            label="E-mail de contato"
            type="email"
            value={form.contact_email}
            onChange={(e) => update('contact_email', e.target.value)}
            placeholder="contato@alfaeletronicos.com.br"
          />
          <Input
            label="Endereço"
            value={form.contact_address}
            onChange={(e) => update('contact_address', e.target.value)}
            placeholder="Rua Exemplo, 123 — Cidade, UF"
          />
          <Input
            label="Texto do rodapé"
            value={form.footer_text}
            onChange={(e) => update('footer_text', e.target.value)}
            placeholder="Todos os direitos reservados."
          />
        </section>

        {/* Salvar */}
        <div className="flex justify-end pb-4">
          <Button onClick={handleSave} loading={saving} size="lg" icon={<Save size={16} />}>
            Salvar configurações
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}
