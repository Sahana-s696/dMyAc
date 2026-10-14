import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Printer, ReceiptText, Landmark, PencilLine, Search, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { compareTransactionsChronologically, deleteTransaction, getTransactionMovement, loadFinanceData, type FinanceData } from '../lib/financeData'

const currency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`))

export const AccountStatementPage = () => {
  const { accountId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setData(await loadFinanceData(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this account statement.')
    } finally {
      setLoading(false)
    }
  }, [user])
  useEffect(() => { void load() }, [load])

  const account = data?.accounts.find((item) => item.id === accountId)
  const rows = useMemo(() => {
    if (!data) return []
    const accountRows = data.transactions
      .filter((row) => row.account_id === accountId && row.transaction_date >= (account?.opening_balance_date ?? '0000-01-01'))
      .sort(compareTransactionsChronologically)
    let balance = account?.opening_balance ?? 0
    return accountRows.map((row) => {
      if (account && row.transaction_date >= account.opening_balance_date) balance += getTransactionMovement(row, data.transfers)
      return { transaction: row, balance, movement: getTransactionMovement(row, data.transfers) }
    })
  }, [account, accountId, data])

  const depositTotal = rows.reduce((total, row) => total + Math.max(row.movement, 0), 0)
  const withdrawalTotal = rows.reduce((total, row) => total + Math.max(-row.movement, 0), 0)
  const beginAction = (operation: 'deposit' | 'withdrawal' | 'transfer') => navigate('/transactions', { state: { operation, account_id: accountId } })
  const editTransaction = (transactionId: string) => navigate('/transactions', { state: { edit_transaction_id: transactionId } })
  const removeTransaction = async (transaction: FinanceData['transactions'][number]) => {
    if (!user || deletingTransactionId) return
    const isTransfer = transaction.transaction_type === 'transfer' && Boolean(transaction.transfer_id)
    const confirmation = isTransfer
      ? 'Delete this transfer and both of its account entries?'
      : `Delete "${transaction.description}"?`
    if (!window.confirm(confirmation)) return
    setDeletingTransactionId(transaction.id)
    setError('')
    try {
      await deleteTransaction(user.id, transaction.id)
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this transaction.')
    } finally {
      setDeletingTransactionId(null)
    }
  }
  const getRegisterDetails = useCallback((transaction: FinanceData['transactions'][number], movement: number) => {
    const transfer = transaction.transfer_id
      ? data?.transfers.find((item) => item.id === transaction.transfer_id)
      : undefined
    return {
      fromAccount: transfer
        ? data?.accounts.find((item) => item.id === transfer.from_account_id)?.account_name ?? '—'
        : '—',
      category: data?.categories.find((item) => item.id === transaction.category_id)?.name
        ?? (transfer ? 'Account transfer' : '—'),
      toAccount: transfer
        ? data?.accounts.find((item) => item.id === transfer.to_account_id)?.account_name ?? '—'
        : movement < 0 ? transaction.description : '—',
    }
  }, [data])
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter(({ transaction, movement }) => {
      const details = getRegisterDetails(transaction, movement)
      const categoryId = transaction.category_id ?? (transaction.transfer_id ? 'transfer' : '')
      const matchesSearch = !query || [
        transaction.description,
        transaction.reference_number ?? '',
        transaction.notes ?? '',
        details.fromAccount,
        details.category,
        details.toAccount,
      ].join(' ').toLowerCase().includes(query)
      const matchesCategory = categoryFilter === 'all' || categoryId === categoryFilter
      const matchesType = typeFilter === 'all'
        || (typeFilter === 'deposit' && movement > 0)
        || (typeFilter === 'withdrawal' && movement < 0)
        || (typeFilter === 'transfer' && transaction.transaction_type === 'transfer')
      const matchesFrom = !dateFrom || transaction.transaction_date >= dateFrom
      const matchesTo = !dateTo || transaction.transaction_date <= dateTo
      return matchesSearch && matchesCategory && matchesType && matchesFrom && matchesTo
    })
  }, [rows, search, categoryFilter, typeFilter, dateFrom, dateTo, getRegisterDetails])
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const firstVisibleRow = visibleRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastVisibleRow = Math.min(currentPage * pageSize, visibleRows.length)

  return (
    <div className="mx-auto max-w-[1800px] space-y-3">
       <button type="button" onClick={() => navigate('/accounts')} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"><ChevronLeft className="h-3.5 w-3.5" /> Back to accounts</button>
       {error && <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{error}</div>}
        {loading ? <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading account statement…</div> : !account ? (
           <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-10 text-center">
             <Landmark className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-200" />
             <h1 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">Account not found</h1>
             <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This account may have been removed or is not available to your user.</p>
           </div>
      ) : (
        <>
           <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="inline-flex min-w-0 items-center gap-1.5 truncate text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    <Landmark aria-hidden="true" className="h-7 w-7 shrink-0 text-blue-700 dark:text-blue-400" />
                    <span className="truncate">{account.account_name}</span>
                  </h1>
                  <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-2.5 py-1.5 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Current balance</span>
                    <span className="ml-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{currency(account.current_balance)}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{account.bank_name} · {account.account_type.replaceAll('_', ' ')}</p>
              </div>
               <div className="flex flex-wrap gap-1.5 sm:justify-end">
                 <button type="button" onClick={() => beginAction('deposit')} className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"><ArrowDownLeft className="h-3 w-3" /> Deposit</button>
                 <button type="button" onClick={() => beginAction('withdrawal')} className="inline-flex items-center gap-1 rounded-md bg-rose-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-700"><ArrowUpRight className="h-3 w-3" /> Withdrawal</button>
                 <button type="button" onClick={() => beginAction('transfer')} className="inline-flex items-center gap-1 rounded-md bg-blue-800 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700"><ArrowLeftRight className="h-3 w-3" /> Transfer</button>
                 <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"><Printer className="h-3 w-3" /> Print</button>
                 <button type="button" onClick={() => navigate('/excel-export', { state: { kind: 'account', account_id: account.id } })} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"><Download className="h-3 w-3" /> Export</button>
               </div>
            </div>
             <dl className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-200 pt-2 sm:grid-cols-4 dark:border-slate-700">
               <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900/40"><dt className="text-[10px] text-slate-500 dark:text-slate-400">Opening balance</dt><dd className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-800 dark:text-slate-200">{currency(account.opening_balance)}</dd></div>
               <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-2.5 py-1.5 dark:border-emerald-900/70 dark:bg-emerald-950/30"><dt className="text-[10px] text-slate-500 dark:text-slate-400">Deposits</dt><dd className="mt-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{currency(depositTotal)}</dd></div>
               <div className="rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-1.5 dark:border-rose-900/70 dark:bg-rose-950/30"><dt className="text-[10px] text-slate-500 dark:text-slate-400">Withdrawals</dt><dd className="mt-0.5 text-[11px] font-semibold tabular-nums text-rose-700 dark:text-rose-400">{currency(withdrawalTotal)}</dd></div>
               <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900/40"><dt className="text-[10px] text-slate-500 dark:text-slate-400">Balance</dt><dd className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-800 dark:text-slate-200">{currency(account.current_balance)}</dd></div>
             </dl>
          </section>

           <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm">
             <div className="space-y-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700 sm:px-4">
               <div className="flex flex-wrap items-center justify-between gap-3">
                 <div><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Account activity</h2><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Oldest transactions first · {visibleRows.length} of {rows.length} entries match</p></div>
                 <button type="button" onClick={() => navigate(`/transactions?accountId=${encodeURIComponent(accountId)}`)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"><ReceiptText className="h-3.5 w-3.5" /> All activity</button>
               </div>
               <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                 <label className="relative">
                   <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                   <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search activity..." className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-[11px] text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-300 dark:focus:ring-blue-300" />
                 </label>
                 <select aria-label="Filter by account" value={accountId} onChange={(event) => { setPage(1); navigate(`/accounts/${encodeURIComponent(event.target.value)}`) }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]">
                   {data?.accounts.map((item) => <option key={item.id} value={item.id}>{item.account_name}</option>)}
                 </select>
                 <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]">
                   <option value="all">All categories</option>
                   <option value="transfer">Account transfer</option>
                   {data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                 </select>
                 <select aria-label="Filter by transaction type" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]">
                   <option value="all">All types</option>
                   <option value="deposit">Deposits</option>
                   <option value="withdrawal">Withdrawals</option>
                   <option value="transfer">Transfers</option>
                 </select>
                 <label className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                   <span>From</span>
                   <input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="min-w-0 bg-transparent py-1.5 text-[11px] text-slate-900 outline-none dark:text-slate-100 dark:[color-scheme:dark]" />
                 </label>
                 <label className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                   <span>To</span>
                   <input aria-label="Date to" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="min-w-0 bg-transparent py-1.5 text-[11px] text-slate-900 outline-none dark:text-slate-100 dark:[color-scheme:dark]" />
                 </label>
               </div>
            </div>
             {visibleRows.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{rows.length === 0 ? 'No transactions posted to this account.' : 'No activity matches these filters.'}</p> : (
              <>
                 <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-[1180px] w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                          <th className="px-2.5 py-1.5 font-semibold">Date</th>
                          <th className="px-2.5 py-1.5 font-semibold">From Account</th>
                          <th className="px-2.5 py-1.5 font-semibold">Category</th>
                          <th className="px-2.5 py-1.5 font-semibold">Description</th>
                          <th className="px-2.5 py-1.5 font-semibold">Reference</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Deposit</th>
                          <th className="px-2.5 py-1.5 font-semibold">To Account</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Withdrawal</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Balance</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                     <tbody>
                       {pageRows.map(({ transaction, balance, movement }) => {
                         const details = getRegisterDetails(transaction, movement)

                         return (
                           <tr key={transaction.id} className="transaction-row border-t border-slate-200 odd:bg-slate-50/60 dark:border-slate-700 dark:odd:bg-slate-900/25">
                             <td className="whitespace-nowrap px-2.5 py-2 text-xs leading-[18px] tabular-nums text-slate-700 dark:text-slate-300">{dateLabel(transaction.transaction_date)}</td>
                             <td className="px-2.5 py-2 text-xs leading-[18px] text-slate-700 dark:text-slate-300">{details.fromAccount}</td>
                             <td className="px-2.5 py-2 text-xs leading-[18px] text-slate-700 dark:text-slate-300">{details.category}</td>
                             <td className="px-2.5 py-2 text-xs leading-[18px] font-medium text-slate-800 dark:text-slate-200">{transaction.description}</td>
                             <td className="px-2.5 py-2 text-xs leading-[18px] text-slate-700 dark:text-slate-300">{transaction.reference_number ?? '—'}</td>
                             <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{movement > 0 ? currency(movement) : '—'}</td>
                             <td className="px-2.5 py-2 text-xs leading-[18px] text-slate-700 dark:text-slate-300">{details.toAccount}</td>
                             <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-medium tabular-nums text-rose-700 dark:text-rose-400">{movement < 0 ? currency(Math.abs(movement)) : '—'}</td>
                             <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-semibold tabular-nums text-slate-800 dark:text-slate-200">{currency(balance)}</td>
                             <td className="px-2.5 py-2 text-right">
                               <div className="inline-flex items-center">
                                 <button type="button" onClick={() => editTransaction(transaction.id)} aria-label={`Edit ${transaction.description}`} className="rounded-md p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300">
                                   <PencilLine className="h-3.5 w-3.5" />
                                 </button>
                                 <button type="button" onClick={() => void removeTransaction(transaction)} disabled={deletingTransactionId !== null} aria-label={`Delete ${transaction.description}`} className="rounded-md p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-40 dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-300">
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </button>
                               </div>
                             </td>
                           </tr>
                         )
                       })}
                     </tbody>
                   </table>
                 </div>
                 <div className="divide-y divide-slate-100 dark:divide-slate-600 md:hidden">
                   {pageRows.map(({ transaction, balance, movement }) => {
                     const details = getRegisterDetails(transaction, movement)

                     return (
                       <article key={transaction.id} className="transaction-row px-4 py-2">
                         <div className="flex justify-between gap-3">
                           <div>
                             <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{transaction.description}</p>
                             <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">{dateLabel(transaction.transaction_date)} · Ref {transaction.reference_number ?? '—'}</p>
                             <p className="mt-0.5 text-[11px] text-slate-700 dark:text-slate-300">From AC: {details.fromAccount} · Category: {details.category}</p>
                             {details.toAccount !== '—' && <p className="mt-0.5 text-[11px] text-slate-700 dark:text-slate-300">To AC: {details.toAccount}</p>}
                           </div>
                           <p className={`text-xs font-semibold ${movement >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{movement >= 0 ? '+' : '−'}{currency(Math.abs(movement))}</p>
                         </div>
                         <p className="mt-1 text-right text-[11px] text-slate-600 dark:text-slate-400">Balance {currency(balance)}</p>
                         <div className="mt-0.5 flex justify-end gap-1">
                           <button type="button" onClick={() => editTransaction(transaction.id)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950">
                             <PencilLine className="h-3 w-3" /> Edit
                           </button>
                           <button type="button" onClick={() => void removeTransaction(transaction)} disabled={deletingTransactionId !== null} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950">
                             <Trash2 className="h-3 w-3" /> Delete
                           </button>
                         </div>
                       </article>
                     )
                   })}
                 </div>
                 <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
                   <p className="text-[11px] text-slate-500 dark:text-slate-400">Showing {firstVisibleRow}–{lastVisibleRow} of {visibleRows.length}</p>
                   <div className="flex items-center gap-2">
                     <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                       Rows
                       <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]">
                         {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                       </select>
                     </label>
                     <span className="min-w-14 text-center text-[11px] text-slate-500 dark:text-slate-400">Page {currentPage} of {pageCount}</span>
                     <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page" className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronLeft className="h-3.5 w-3.5" /></button>
                     <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="Next page" className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronRight className="h-3.5 w-3.5" /></button>
                   </div>
                 </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
