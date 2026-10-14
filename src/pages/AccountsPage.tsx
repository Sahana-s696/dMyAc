import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BadgeDollarSign, FileText, Landmark, PencilLine, Plus, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createAccount, deleteAccount, loadAccounts as fetchAccounts, updateAccount, type AccountRecord } from '../lib/financeData'
import { isSupabaseConfigured } from '../lib/supabase'
import type { AccountType } from '../types'

type AccountForm = {
  account_name: string
  bank_name: string
  account_type: AccountType
  opening_balance: string
  opening_balance_date: string
}

const emptyForm = (): AccountForm => ({
  account_name: '',
  bank_name: '',
  account_type: 'checking',
  opening_balance: '0',
  opening_balance_date: new Date().toISOString().slice(0, 10),
})
const accountTypes: AccountType[] = ['checking', 'savings', 'investment', 'cash', 'broker', 'credit', 'loan', 'other']
const formatMoney = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const displayType = (type: string) => type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const errorMessage = (error: unknown) => {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? error.code : undefined
    const message = 'message' in error ? error.message : undefined
    if (code === '23503' && typeof message === 'string' && message.includes('accounts_user_id_fkey')) {
      return 'Your Supabase user is missing its profile record. Run supabase/migrations/20261008000200_repair_existing_profiles.sql in the Supabase SQL Editor, then try again.'
    }
    if (typeof message === 'string') return message
  }
  return 'Unable to load accounts. Check your connection and Supabase account-table permissions.'
}
const isAccountType = (value: string): value is AccountType => accountTypes.includes(value as AccountType)

export const AccountsPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null)
  const [form, setForm] = useState<AccountForm>(emptyForm)

  const loadAccounts = useCallback(async () => {
    if (!user) return
    try {
      setAccounts(await fetchAccounts(user.id))
      setPageError('')
    } catch (error) {
      setPageError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void loadAccounts() }, [loadAccounts])

  const openCreateForm = () => {
    setEditingAccount(null)
    setForm(emptyForm())
    setFormError('')
    setIsFormOpen(true)
  }
  const openEditForm = (account: AccountRecord) => {
    setEditingAccount(account)
    setForm({
      account_name: account.account_name,
      bank_name: account.bank_name,
      account_type: isAccountType(account.account_type) ? account.account_type : 'other',
      opening_balance: String(account.opening_balance),
      opening_balance_date: account.opening_balance_date,
    })
    setFormError('')
    setIsFormOpen(true)
  }

  const saveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return setFormError('You must be signed in to save an account.')
    const openingBalance = Number(form.opening_balance)
    if (!form.account_name.trim() || !form.bank_name.trim() || !Number.isFinite(openingBalance) || openingBalance < 0) {
      return setFormError('Enter an account name, bank name, and a valid non-negative opening balance.')
    }

    setSaving(true)
    setFormError('')
    try {
      const values = { 
        account_name: form.account_name.trim(), 
        bank_name: form.bank_name.trim(), 
        account_type: form.account_type,
        opening_balance: openingBalance,
        opening_balance_date: form.opening_balance_date
      }
      if (editingAccount) {
        await updateAccount(user.id, editingAccount.id, values)
      } else {
        await createAccount(user.id, values)
      }
      setIsFormOpen(false)
      await loadAccounts()
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (account: AccountRecord) => {
    if (!user || !window.confirm(`Delete "${account.account_name}"? Accounts with transaction history cannot be removed.`)) return
    try {
      await deleteAccount(user.id, account.id)
      await loadAccounts()
    } catch (error) {
      setPageError(errorMessage(error))
    }
  }

  const totalBalance = accounts.filter((account) => account.status === 'active').reduce((total, account) => total + account.current_balance, 0)

  return (
     <div className="mx-auto max-w-[1500px] space-y-6">
       <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
         <div><p className="text-sm font-semibold text-blue-700 dark:text-blue-500">ACCOUNT MANAGEMENT</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Accounts</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage linked bank, cash, and savings accounts.</p></div>
         <button type="button" onClick={openCreateForm} className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-700 dark:bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-900 sm:self-auto"><Plus className="h-4 w-4" /> Add account</button>
       </div>

       {!isSupabaseConfigured && <div className="rounded-lg border border-blue-100 dark:border-blue-300 bg-blue-50/70 dark:bg-blue-900/50 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">Demo entries are stored only in this browser. Add Supabase settings to enable authenticated cloud storage and syncing.</div>}
       {pageError && <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{pageError}</div>}

       <section className="gap-3 sm:grid-cols-2">
         <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm">
           <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><BadgeDollarSign className="h-4 w-4 text-blue-700 dark:text-blue-500" /> Total active balance</span>
           <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatMoney(totalBalance)}</span>
         </div>
         <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:bg-slate-800 px-4 py-3.5 shadow-sm">
           <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Landmark className="h-4 w-4 text-blue-700 dark:text-blue-500" /> Total accounts</span>
           <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{accounts.length}</span>
         </div>
       </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-slate-800 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-600 px-4 py-4 sm:px-5"><h2 className="font-semibold text-slate-900 dark:text-slate-100">Account register</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select a statement to review the account ledger and calculated balances.</p></div>
         {loading ? <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading accounts…</p> : accounts.length === 0 ? (
           <div className="px-5 py-12 text-center"><Landmark className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" /><h3 className="mt-3 font-medium text-slate-800 dark:text-slate-200">No accounts yet</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add a bank or cash account to begin keeping a statement.</p><button type="button" onClick={openCreateForm} className="mt-4 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-700">Add your first account</button></div>
        ) : (
          <div className="overflow-x-auto">
             <table className="min-w-full text-left text-sm">
               <thead className="bg-slate-50 dark:bg-slate-700 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className="px-3 py-2 font-semibold">Account</th><th className="px-3 py-2 font-semibold">Institution</th><th className="px-3 py-2 font-semibold">Type</th><th className="px-3 py-2 text-right font-semibold">Opening balance</th><th className="px-3 py-2 text-right font-semibold">Current balance</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 text-right font-semibold">Actions</th></tr></thead>
               <tbody>{accounts.map((account) => (
                 <tr key={account.id} className="border-t border-slate-200 dark:border-slate-600 hover:bg-slate-50/70 dark:hover:bg-slate-600/50">
                   <td className="whitespace-nowrap px-3 py-1 font-medium text-slate-800 dark:text-slate-200 text-[13px]">{account.account_name}</td>
                   <td className="whitespace-nowrap px-3 py-1 text-slate-600 dark:text-slate-300 text-[12px]">{account.bank_name}</td>
                   <td className="whitespace-nowrap px-3 py-1 text-slate-600 dark:text-slate-300 text-[12px]">{displayType(account.account_type)}</td>
                   <td className="whitespace-nowrap px-3 py-1 text-right text-slate-600 dark:text-slate-300 text-[12px]">{formatMoney(account.opening_balance)}</td>
                   <td className="whitespace-nowrap px-3 py-1 text-right font-semibold text-slate-900 dark:text-slate-100 text-[13px]">{formatMoney(account.current_balance)}</td>
                  <td className="px-3 py-1"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${account.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{displayType(account.status)}</span></td>
                  <td className="px-3 py-1"><div className="flex justify-end gap-1">
                     <button type="button" onClick={() => navigate(`/accounts/${account.id}`)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 dark:hover:border-blue-300 dark:hover:bg-blue-600 dark:hover:text-blue-200"><FileText className="h-3 w-3" /> Statement</button>
                     <button type="button" onClick={() => openEditForm(account)} className="rounded-md p-1.5 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-slate-200" aria-label={`Edit ${account.account_name}`}><PencilLine className="h-3.5 w-3.5" /></button>
                     <button type="button" onClick={() => void handleDelete(account)} className="rounded-md p-1.5 text-slate-500 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-600 hover:text-rose-700 dark:hover:text-rose-200" aria-label={`Delete ${account.account_name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 dark:bg-blue-950/70" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}>
           <form onSubmit={saveAccount} className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-popover" role="dialog" aria-modal="true" aria-labelledby="account-form-title">
             <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-500">Account setup</p><h2 id="account-form-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{editingAccount ? 'Edit account' : 'Add account'}</h2></div><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600" aria-label="Close"><X className="h-4 w-4" /></button></div>
             <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Account name<input required value={form.account_name} onChange={(event) => setForm({ ...form, account_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 font-normal text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-300" /></label>
             <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Bank or institution<input required value={form.bank_name} onChange={(event) => setForm({ ...form, bank_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 font-normal text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-300" /></label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Account type<select value={form.account_type} onChange={(event) => { if (isAccountType(event.target.value)) setForm({ ...form, account_type: event.target.value }) }} className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 font-normal text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-300">{accountTypes.map((type) => <option key={type} value={type}>{displayType(type)}</option>)}</select></label>
 <div className="space-y-3">
   <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Opening balance</label>
   <input
     required
     type="number"
     min="0"
     step="0.01"
     value={form.opening_balance}
     onChange={(event) => setForm({ ...form, opening_balance: event.target.value })}
     className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 font-normal text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-300"
     // Note: Opening balance is typically not changed after account creation to maintain historical accuracy
     // {editingAccount && 'readOnly'}  // Uncomment to make read-only when editing
   />
 </div>
 <div className="space-y-3">
   <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Opening balance date</label>
   <input
     required
     type="date"
     value={form.opening_balance_date}
     onChange={(event) => setForm({ ...form, opening_balance_date: event.target.value })}
     className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 font-normal text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-300"
     // Note: Opening balance date is typically not changed after account creation
     // {editingAccount && 'readOnly'}  // Uncomment to make read-only when editing
   />
 </div>
             {formError && <p role="alert" className="rounded-lg border border-rose-200 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/50 p-3 text-sm text-rose-800 dark:text-rose-200">{formError}</p>}
             <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-700 dark:bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-900 disabled:opacity-60">{saving ? 'Saving…' : 'Save account'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
