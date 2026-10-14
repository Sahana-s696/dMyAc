import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Tags, PencilLine, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createCategory, deleteCategory, loadFinanceData, updateCategory, type CategoryRecord, type FinanceData, type NewCategory } from '../lib/financeData'

const categoryTypes: NewCategory['category_type'][] = ['income', 'expense', 'transfer', 'broker']
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const isCategoryType = (value: string): value is NewCategory['category_type'] =>
  value === 'income' || value === 'expense' || value === 'transfer' || value === 'broker'

export const CategoriesPage = () => {
  const { user } = useAuth()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRecord | null>(null)
  const [name, setName] = useState('')
  const [categoryType, setCategoryType] = useState<NewCategory['category_type']>('expense')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!user) return
    try {
      setData(await loadFinanceData(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load categories.')
    } finally {
      setLoading(false)
    }
  }, [user])
  useEffect(() => { void reload() }, [reload])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setCategoryType('expense')
    setError('')
    setFormOpen(true)
  }
  const openEdit = (category: CategoryRecord) => {
    if (!isCategoryType(category.category_type)) return
    setEditing(category)
    setName(category.name)
    setCategoryType(category.category_type)
    setError('')
    setFormOpen(true)
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !name.trim()) return setError('Enter a category name.')
    setSaving(true)
    setError('')
    try {
      const values = { name: name.trim(), category_type: categoryType }
      if (editing) await updateCategory(user.id, editing.id, values)
      else await createCategory(user.id, values)
      setFormOpen(false)
      await reload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the category.')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (category: CategoryRecord) => {
    if (!user || !window.confirm(`Delete the "${category.name}" category? Existing transactions will remain but become uncategorized.`)) return
    try {
      await deleteCategory(user.id, category.id)
      await reload()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to delete the category.')
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-semibold text-blue-700 dark:text-blue-400">LEDGER ORGANIZATION</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Categories</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organize deposits and withdrawals for clear statements.</p></div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 sm:self-auto"><Plus className="h-4 w-4" /> Add category</button>
      </div>
      {error && !formOpen && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{error}</div>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5 dark:border-slate-700"><div className="flex items-center gap-2"><Tags className="h-4 w-4 text-blue-700 dark:text-blue-400" /><h2 className="font-semibold text-slate-900 dark:text-slate-100">Category register</h2></div></div>
        {loading ? <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading categories…</p> : !data?.categories.length ? <div className="px-5 py-12 text-center"><p className="text-sm text-slate-500 dark:text-slate-400">No categories have been set up yet.</p><button type="button" onClick={openCreate} className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Create a category</button></div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300"><tr><th className="px-3 py-2 font-semibold">Category</th><th className="px-3 py-2 font-semibold">Transaction type</th><th className="px-3 py-2 text-right font-semibold">Entries</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 text-right font-semibold">Actions</th></tr></thead>
              <tbody>{data.categories.map((category) => <tr key={category.id} className="border-t border-slate-100 hover:bg-slate-50/70 dark:border-slate-700 dark:hover:bg-slate-700/60"><td className="px-3 py-1.5 font-medium text-slate-800 text-[13px] dark:text-slate-100">{category.name}</td><td className="px-3 py-1.5 text-[12px] text-slate-600 dark:text-slate-300">{label(category.category_type)}</td><td className="px-3 py-1.5 text-right text-[12px] text-slate-600 dark:text-slate-300">{data.transactions.filter((transaction) => transaction.category_id === category.id).length}</td><td className="px-3 py-1.5"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${category.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{category.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-3 py-1.5"><div className="flex justify-end gap-1"><button type="button" onClick={() => openEdit(category)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-100" aria-label={`Edit ${category.name}`}><PencilLine className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void remove(category)} className="rounded-md p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-300" aria-label={`Delete ${category.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 dark:bg-blue-950/70" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false) }}>
        <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="category-form-title" className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-popover">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Ledger category</p><h2 id="category-form-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{editing ? 'Edit category' : 'Add category'}</h2></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Close"><X className="h-4 w-4" /></button></div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-900" /></label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Type<select value={categoryType} onChange={(event) => { if (isCategoryType(event.target.value)) setCategoryType(event.target.value) }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]">{categoryTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
          {formOpen && error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save category'}</button></div>
        </form>
      </div>}
    </div>
  )
}
