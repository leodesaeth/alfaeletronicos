import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit, Trash2, Tag, GripVertical, Package } from 'lucide-react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryProductCount,
} from '@/services/categories'
import type { Category, CategoryFormData } from '@/types'
import { Input, Textarea, Toggle } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDeleteModal } from '@/components/ui/Modal'
import { Badge, EmptyState, PageLoader } from '@/components/ui/StateComponents'
import toast from 'react-hot-toast'

const DEFAULT_FORM: CategoryFormData = {
  name: '',
  description: '',
  image_path: '',
  parent_id: '',
  display_order: 0,
  is_active: true,
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteWarning, setDeleteWarning] = useState('')
  const [formData, setFormData] = useState<CategoryFormData>(DEFAULT_FORM)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getAllCategories()
    setCategories(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditTarget(null)
    setFormData(DEFAULT_FORM)
    setFormErrors({})
    setFormOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditTarget(cat)
    setFormData({
      name: cat.name,
      description: cat.description || '',
      image_path: cat.image_path || '',
      parent_id: cat.parent_id || '',
      display_order: cat.display_order,
      is_active: cat.is_active,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const openDelete = async (cat: Category) => {
    const count = await getCategoryProductCount(cat.id)
    if (count > 0) {
      setDeleteWarning(
        `Esta categoria possui ${count} produto(s) vinculado(s). Reatribua-os antes de excluir.`
      )
    } else {
      setDeleteWarning('')
    }
    setDeleteTarget(cat)
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = 'Nome é obrigatório.'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setFormLoading(true)
    try {
      if (editTarget) {
        const updated = await updateCategory(editTarget.id, formData)
        setCategories((prev) =>
          prev.map((c) => (c.id === editTarget.id ? updated : c))
        )
        toast.success('Categoria atualizada!')
      } else {
        const created = await createCategory(formData)
        setCategories((prev) => [...prev, created])
        toast.success('Categoria criada!')
      }
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteWarning) {
      toast.error('Reatribua os produtos antes de excluir a categoria.')
      return
    }
    setDeleteLoading(true)
    try {
      await deleteCategory(deleteTarget.id)
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.success('Categoria excluída.')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex flex-col gap-5 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-graphite">Categorias</h1>
            <p className="text-sm text-muted mt-0.5">{categories.length} categoria(s)</p>
          </div>
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            Nova categoria
          </Button>
        </div>

        {/* Lista */}
        {categories.length === 0 ? (
          <EmptyState
            icon={<Tag size={48} />}
            title="Nenhuma categoria cadastrada"
            description="Crie categorias para organizar seus produtos."
            action={<Button icon={<Plus size={16} />} onClick={openCreate}>Criar categoria</Button>}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-surface/50 transition-colors ${
                  idx < categories.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <GripVertical size={16} className="text-gray-300 shrink-0 cursor-grab" />

                {/* Ícone/imagem */}
                <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0 overflow-hidden">
                  <Package size={16} className="text-brand/40" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-graphite">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-muted truncate">{cat.description}</p>
                  )}
                </div>

                {/* Status */}
                <Badge variant={cat.is_active ? 'green' : 'gray'}>
                  {cat.is_active ? 'Ativa' : 'Inativa'}
                </Badge>

                {/* Ações */}
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(cat)}
                    className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-brand transition-colors"
                    title="Editar"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => openDelete(cat)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de formulário */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editTarget ? 'Editar categoria' : 'Nova categoria'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={formLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={formLoading}>
                {editTarget ? 'Salvar alterações' : 'Criar categoria'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input
              label="Nome da categoria"
              required
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Celulares"
              error={formErrors.name}
            />
            <Textarea
              label="Descrição"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Descrição opcional da categoria..."
              rows={3}
            />
            <Toggle
              label="Categoria ativa"
              description="Categorias inativas não aparecem no catálogo público"
              checked={formData.is_active}
              onChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
              id="cat_is_active"
            />
          </div>
        </Modal>

        {/* Modal de exclusão */}
        {deleteTarget && (
          <Modal
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title="Excluir categoria"
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleteLoading}
                  disabled={!!deleteWarning}
                >
                  Excluir
                </Button>
              </>
            }
          >
            {deleteWarning ? (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <Package size={15} className="shrink-0 mt-0.5" />
                <p>{deleteWarning}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Tem certeza que deseja excluir <strong>"{deleteTarget.name}"</strong>? Esta ação não pode ser desfeita.
              </p>
            )}
          </Modal>
        )}
      </div>
    </AdminLayout>
  )
}
