import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftRight, ChevronDown, ChevronUp, PencilLine, Plus, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteTransfer, groupTransactionEntries, getTransactionMovement, loadFinanceData, updateTransfer, type FinanceData, type TransferRecord } from '../lib/financeData'

const currency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const displayDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const messageForError = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this request.'

export const TransfersPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<TransferRecord | null>(null)
  const [savingTransfer, setSavingTransfer] = useState(false)
  const [editForm, setEditForm] = useState({ transfer_date: '', description: '', amount: '', reference_number: '' })
  const [expandedTransferGroups, setExpandedTransferGroups] = useState<Set<string>>(() => new Set())

  const reload = useCallback(async () => {
    if (!user) return
    try {
      setData(await loadFinanceData(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load transfers.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void reload() }, [reload])

  const handleDelete = async (transfer: TransferRecord) => {
    if (!user) return
    if (!confirm(`Delete "${transfer.description}"? This removes both account entries and cannot be undone.`)) return
    setDeletingTransferId(transfer.id)
    setError('')
    try {
      await deleteTransfer(user.id, transfer.id)
      await reload()
    } catch (deleteError) {
      setError(messageForError(deleteError))
    } finally {
      setDeletingTransferId(null)
    }
  }

  const openEdit = (transfer: TransferRecord) => {
    setEditingTransfer(transfer)
    setEditForm({
      transfer_date: transfer.transfer_date,
      description: transfer.description,
      amount: String(transfer.amount),
      reference_number: transfer.reference_number ?? '',
    })
    setError('')
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !editingTransfer) return
    const amount = Number(editForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!editForm.description.trim()) {
      setError('Enter a description for this transfer.')
      return
    }
    const openingDates = [editingTransfer.from_account_id, editingTransfer.to_account_id]
      .map((accountId) => data?.accounts.find((account) => account.id === accountId)?.opening_balance_date)
      .filter((date): date is string => Boolean(date))
    const earliestAllowedDate = openingDates.sort().at(-1)
    if (earliestAllowedDate && editForm.transfer_date < earliestAllowedDate) {
      setError('The transfer date cannot predate either account opening date.')
      return
    }

    setSavingTransfer(true)
    setError('')
    try {
      await updateTransfer(user.id, editingTransfer.id, {
        transfer_date: editForm.transfer_date,
        description: editForm.description.trim(),
        amount,
        reference_number: editForm.reference_number.trim() || null,
      })
      setEditingTransfer(null)
      await reload()
    } catch (saveError) {
      setError(messageForError(saveError))
    } finally {
      setSavingTransfer(false)
    }
  }

  const transferRows = groupTransactionEntries(
    (data?.transactions ?? []).filter((transaction) => transaction.transaction_type === 'transfer'),
    data?.transfers ?? [],
  )
  const ledgerEntryCount = transferRows.reduce((total, group) => total + group.entries.length, 0)
  const toggleTransferDetails = (groupId: string) => {
    setExpandedTransferGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">ACCOUNT MOVEMENTS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Transfers</h1>
          <p className="mt-1 text-sm text-slate-500">Move funds between your own accounts with a balanced statement record.</p>
        </div>
        <button type="button" onClick={() => navigate('/transactions', { state: { operation: 'transfer' } })} className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 sm:self-auto"><Plus className="h-4 w-4" /> New transfer</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Transfer statement</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {transferRows.length} transfers · {ledgerEntryCount} underlying account entries
          </p>
        </div>
        {loading ? <p className="px-4 py-12 text-center text-sm text-slate-600 dark:text-slate-300">Loading transfers…</p> : transferRows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700"><ArrowLeftRight className="h-5 w-5" /></span>
            <h3 className="mt-3 font-medium text-slate-800 dark:text-slate-100">No transfers yet</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Transfers are recorded on both account statements without changing your total balance.</p>
            <button type="button" onClick={() => navigate('/transactions', { state: { operation: 'transfer' } })} className="mt-4 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800">Make a transfer</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 font-semibold">Account</th>
                    <th className="px-3 py-2 font-semibold">Counterparty</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Reference</th>
                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transferRows.map(({ id, transaction: row, entries, transfer }) => {
                    const sourceAccount = transfer && data?.accounts.find((account) => account.id === transfer.from_account_id)
                    const destinationAccount = transfer && data?.accounts.find((account) => account.id === transfer.to_account_id)
                    const isExpanded = expandedTransferGroups.has(id)

                    return (
                      <Fragment key={id}>
                      <tr className="transaction-row border-t border-slate-200 dark:border-slate-700">
                        <td className="whitespace-nowrap px-3 py-2 text-[12px] text-slate-800 dark:text-slate-200">{displayDate(row.transaction_date)}</td>
                        <td className="px-3 py-2 text-[13px] font-medium text-slate-900 dark:text-slate-100">{row.description}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-[12px] text-slate-800 dark:text-slate-200">{sourceAccount?.account_name ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-[12px] text-slate-700 dark:text-slate-300">{destinationAccount?.account_name ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-[12px] font-semibold text-blue-700 dark:text-blue-300">
                          {currency(row.amount)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[12px] text-slate-700 dark:text-slate-300">{row.reference_number ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => toggleTransferDetails(id)} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} account entries for ${row.description}`} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {transfer && (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(transfer)}
                                disabled={savingTransfer || deletingTransferId === transfer.id}
                                aria-label={`Edit transfer from ${sourceAccount?.account_name ?? 'account'} to ${destinationAccount?.account_name ?? 'account'}`}
                                className="rounded-lg p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                              >
                                <PencilLine className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(transfer)}
                                disabled={deletingTransferId === transfer.id || savingTransfer}
                                aria-label={`Delete transfer from ${sourceAccount?.account_name ?? 'account'} to ${destinationAccount?.account_name ?? 'account'}`}
                                className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="transaction-row bg-blue-50/60 dark:bg-blue-950/30">
                          <td colSpan={7} className="px-5 py-2">
                            <ul className="space-y-1.5" aria-label="Paired transfer account entries">
                              {entries.map((entry) => {
                                const entryAccount = data?.accounts.find((account) => account.id === entry.account_id)
                                const movement = data ? getTransactionMovement(entry, data.transfers) : 0
                                return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-200">
                                  <span>{entryAccount?.account_name ?? 'Account'} · Entry {entry.id}</span>
                                  <span className={movement < 0 ? 'font-semibold text-rose-700 dark:text-rose-300' : 'font-semibold text-emerald-700 dark:text-emerald-300'}>{movement < 0 ? 'Outgoing' : 'Incoming'} · {movement < 0 ? '−' : '+'}{currency(Math.abs(movement))}</span>
                                </li>
                              })}
                            </ul>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
            </table>
          </div>
        )}
      </section>

      {editingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm dark:bg-blue-950/75" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingTransfer) setEditingTransfer(null) }}>
          <form onSubmit={handleEdit} role="dialog" aria-modal="true" aria-labelledby="transfer-edit-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/25 dark:border-slate-700 dark:bg-popover dark:shadow-black/50">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-6 py-5 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Account movement</p>
                <h2 id="transfer-edit-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">Edit transfer</h2>
              </div>
              <button type="button" onClick={() => setEditingTransfer(null)} disabled={savingTransfer} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 bg-white p-6 dark:bg-slate-900">
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"><span className="block text-xs text-slate-500 dark:text-slate-400">From account</span>{data?.accounts.find((account) => account.id === editingTransfer.from_account_id)?.account_name ?? '—'}</p>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"><span className="block text-xs text-slate-500 dark:text-slate-400">To account</span>{data?.accounts.find((account) => account.id === editingTransfer.to_account_id)?.account_name ?? '—'}</p>
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Date<input required type="date" min={[editingTransfer.from_account_id, editingTransfer.to_account_id].map((accountId) => data?.accounts.find((account) => account.id === accountId)?.opening_balance_date ?? '').sort().at(-1)} value={editForm.transfer_date} onChange={(event) => setEditForm((current) => ({ ...current, transfer_date: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]" /></label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Description<input required value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Amount<input required type="number" min="0.01" step="0.01" value={editForm.amount} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-950" /></label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Reference<input value={editForm.reference_number} onChange={(event) => setEditForm((current) => ({ ...current, reference_number: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" /></label>
            </div>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/70">
              <button type="button" onClick={() => setEditingTransfer(null)} disabled={savingTransfer} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={savingTransfer} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-950/20 hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500">{savingTransfer ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
