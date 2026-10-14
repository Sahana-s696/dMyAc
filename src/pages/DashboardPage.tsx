import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, ChevronRight, CirclePlus, Landmark, Plus, Search, ShieldCheck, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { compareTransactionEntrySequence, compareTransactionsChronologically, getTransactionMovement, groupTransactionEntries, loadFinanceData, type FinanceData, type TransactionRecord, type TransferRecord } from '../lib/financeData'
import { isSupabaseConfigured } from '../lib/supabase'

const currency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const isDeposit = (type: string) => ['income', 'interest', 'cash_deposit', 'broker_withdrawal'].includes(type)
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to load financial data.'

function groupAmounts(entries: TransactionRecord[], transfers: TransferRecord[], accountId: string) {
  const relevantEntries = accountId === 'all' ? entries : entries.filter((entry) => entry.account_id === accountId)
  return relevantEntries.reduce((amounts, entry) => {
    const movement = getTransactionMovement(entry, transfers)
    if (movement > 0) amounts.deposit += movement
    if (movement < 0) amounts.withdrawal += Math.abs(movement)
    return amounts
  }, { deposit: 0, withdrawal: 0 })
}

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const monthBounds = (month: string) => ({
  start: `${month}-01`,
  end: `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`,
})

function getRunningBalances(data: FinanceData) {
  const balances = new Map(data.accounts.map((account) => [account.id, account.opening_balance]))
  const rowsByDate = [...data.transactions].sort(compareTransactionsChronologically)
  const running = new Map<string, number>()

  for (const row of rowsByDate) {
    const account = data.accounts.find((item) => item.id === row.account_id)
    if (!account || row.transaction_date < account.opening_balance_date) continue
    const next = (balances.get(row.account_id) ?? 0) + getTransactionMovement(row, data.transfers)
    balances.set(row.account_id, next)
    running.set(row.id, next)
  }
  return running
}

export const DashboardPage = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [today] = useState(() => new Date())
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(today)
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    loadFinanceData(user.id)
      .then((result) => {
        if (active) {
          setData(result)
          setLoadError('')
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [user])

   const { transactions, runningBalances } = useMemo(() => {
     if (!data) return { transactions: [] as TransactionRecord[], runningBalances: new Map<string, number>() }
     const monthString = month ? month.slice(0,7) : currentMonth().slice(0,7)
     const bounds = monthBounds(monthString)
     const filtered = data.transactions.filter((row) => row.transaction_date >= bounds.start && row.transaction_date <= bounds.end)
     const running = getRunningBalances(data)
     return {
     transactions: [...filtered].sort((left, right) =>
       left.transaction_date.localeCompare(right.transaction_date) || compareTransactionEntrySequence(left, right),
     ),
       runningBalances: running,
     }
   }, [data, month])

  const visibleTransactions = data
    ? groupTransactionEntries(transactions, data.transfers)
      .filter(({ transaction, entries, transfer }) => {
        const accountNames = entries.map((entry) => data.accounts.find((account) => account.id === entry.account_id)?.account_name ?? '').join(' ')
        const transferAccounts = transfer
          ? `${data.accounts.find((account) => account.id === transfer.from_account_id)?.account_name ?? ''} ${data.accounts.find((account) => account.id === transfer.to_account_id)?.account_name ?? ''}`
          : ''
        const categoryName = data.categories.find((category) => category.id === transaction.category_id)?.name ?? ''
        return `${transaction.description} ${transaction.reference_number ?? ''} ${accountNames} ${transferAccounts} ${categoryName}`.toLowerCase().includes(search.toLowerCase())
      })
       .sort((left, right) => left.transaction.transaction_date.localeCompare(right.transaction.transaction_date)
        || left.transaction.created_at.localeCompare(right.transaction.created_at)
        || left.transaction.id.localeCompare(right.transaction.id))
      .slice(0, 8)
    : []

  const quickAction = (operation: 'deposit' | 'withdrawal' | 'transfer') => navigate('/transactions', { state: { operation } })

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
       <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/80 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:flex-row sm:items-center sm:p-6">
         <div>
           <p className="text-xs font-semibold tracking-[0.16em] text-blue-700 dark:text-blue-300">BANKING OVERVIEW</p>
           <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Dashboard</h1>
           <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}. Here’s your financial overview.</p>
         </div>
         <div className="flex items-center gap-3 self-start rounded-xl border border-blue-100 bg-white/80 px-4 py-3 shadow-sm dark:border-blue-900/70 dark:bg-slate-900/70 sm:self-auto">
           <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><CalendarDays className="h-5 w-5" /></span>
           <div>
             <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today</p>
             <time dateTime={todayIso} className="mt-0.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">{todayLabel}</time>
           </div>
         </div>
       </section>

       {loadError && <div role="alert" className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">{loadError}</div>}
       {!isSupabaseConfigured && (
         <div className="flex items-center gap-2 rounded-lg border border-blue-100 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-900/50 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
           <ShieldCheck className="h-4 w-4 shrink-0" /> Demo data is stored in this browser only. Connect Supabase to use your own secure account data.
         </div>
       )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
         <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
           <div className="flex flex-col justify-between gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-4 sm:flex-row sm:items-center">
             <div>
               <h2 className="font-semibold text-slate-900 dark:text-slate-100">Recent transactions</h2>
               <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Your latest account activity</p>
             </div>
             <button type="button" onClick={() => navigate('/transactions')} className="inline-flex items-center gap-1 self-start text-sm font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 sm:self-auto">
               View all <ChevronRight className="h-4 w-4" />
             </button>
           </div>

<div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  <span className="sr-only">Statement date</span>
                  <input aria-label="Statement date" type="date" value={month} onChange={(event) => setMonth(event.target.value)} className="min-w-0 border-0 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
                </label>
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 pl-9 pr-3 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 dark:focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-200" />
              </label>
                <span className="self-center whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{transactions.length} transactions on {dateLabel(month ? `${month.slice(0,7)}-01` : `${currentMonth().slice(0,7)}-01`)}</span>
            </div>

           {loading ? (
             <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading account activity…</div>
           ) : visibleTransactions.length === 0 ? (
             <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{transactions.length ? 'No transactions match your search.' : 'No activity for this month yet. Add your first transaction using Quick actions.'}</div>
           ) : (
            <>
               <div className="hidden overflow-x-auto md:block">
                 <table className="min-w-full text-left text-sm">
<thead className="bg-slate-50 dark:bg-slate-800 text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                       <tr>
                         <th className="px-3 py-1 font-medium text-[9px]">Date</th>
                         <th className="px-3 py-1 font-medium text-[9px]">Account</th>
                         <th className="px-3 py-1 font-medium text-[9px]">Category</th>
                         <th className="px-3 py-1 font-medium text-[9px]">Description</th>
                         <th className="px-3 py-1 text-right font-medium text-[9px]">Deposit</th>
                         <th className="px-3 py-1 text-right font-medium text-[9px]">Withdrawal</th>
                         <th className="px-3 py-1 text-right font-medium text-[9px]">Balance</th>
                       </tr>
                     </thead>
<tbody>
 {visibleTransactions.map(({ id, transaction: row, entries: _entries, transfer }) => {
                         const account = data?.accounts.find((item) => item.id === row.account_id)
                         const category = data?.categories.find((item) => item.id === row.category_id)
const kind = row.transaction_type === 'transfer' ? 'transfer' : isDeposit(row.transaction_type) ? 'deposit' : 'withdrawal'
                         const sourceAccount = transfer ? data?.accounts.find((item) => item.id === transfer.from_account_id) : undefined
                         const destinationAccount = transfer ? data?.accounts.find((item) => item.id === transfer.to_account_id) : undefined
                         const amounts = data ? groupTransactionEntries([row], data.transfers).reduce((acc, g) => {
                           const amts = data ? groupAmounts(g.entries, data.transfers, 'all') : { deposit: 0, withdrawal: 0 }
                           acc.deposit += amts.deposit
                           acc.withdrawal += amts.withdrawal
                           return acc
                         }, { deposit: 0, withdrawal: 0 }) : { deposit: 0, withdrawal: 0 }
                         return (
                          <tr key={id} className="transaction-row border-t border-slate-200 dark:border-slate-700">
                              <td className="whitespace-nowrap px-3 py-1 font-medium text-[12px] text-slate-800 dark:text-slate-200">{dateLabel(row.transaction_date)}</td>
                              <td className="whitespace-nowrap px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300">
                                {kind === 'transfer' ? <p className="text-blue-700 dark:text-blue-300 text-[11px]">{sourceAccount?.account_name ?? account?.account_name ?? '—'} → {destinationAccount?.account_name ?? '—'}</p> : <p className="text-[11px]">{account?.account_name ?? '—'}</p>}
                                {kind === 'deposit' && <p className="text-[9px] text-emerald-700 dark:text-emerald-300">From: External source · To: {account?.account_name ?? '—'}</p>}
                              </td>
                              <td className="whitespace-nowrap px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300">{category?.name ?? (kind === 'transfer' ? 'Account transfer' : '—')}</td>
                               <td className="whitespace-nowrap px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300"><p className="font-medium text-[11px]">{row.description}</p>{row.reference_number && <p className="mt-0.5 text-[9px]">Ref: {row.reference_number}</p>}</td>
                              <td className="whitespace-nowrap px-3 py-1 text-right text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{amounts.deposit > 0 ? `+${currency(amounts.deposit)}` : '—'}</td>
                              <td className="whitespace-nowrap px-3 py-1 text-right text-[11px] font-semibold text-rose-700 dark:text-rose-300">{amounts.withdrawal > 0 ? `−${currency(amounts.withdrawal)}` : '—'}</td>
                              <td className="whitespace-nowrap px-3 py-1 text-right text-[11px] font-semibold text-slate-900 dark:text-slate-100">{currency(runningBalances.get(row.id) ?? account?.current_balance ?? 0)}</td>
                            </tr>
                         )
                       })}
                    </tbody>
</table>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700 md:hidden">
{visibleTransactions.map(({ id, transaction: row, entries: _entries, transfer }) => {
                    const account = data?.accounts.find((item) => item.id === row.account_id)
                    const category = data?.categories.find((item) => item.id === row.category_id)
                    const kind = row.transaction_type === 'transfer' ? 'transfer' : isDeposit(row.transaction_type) ? 'deposit' : 'withdrawal'
                    const sourceAccount = transfer ? data?.accounts.find((item) => item.id === transfer.from_account_id) : undefined
                    const destinationAccount = transfer ? data?.accounts.find((item) => item.id === transfer.to_account_id) : undefined
                    const amounts = data ? groupAmounts(_entries, data.transfers, 'all') : { deposit: 0, withdrawal: 0 }
                    return (
                       <article key={id} className="transaction-row bg-white px-3 py-1 dark:bg-slate-800">
                         <div className="flex flex-col gap-1.5">
                           <div className="flex items-center justify-between gap-2">
                             <p className="truncate text-sm font-medium text-[11px] text-slate-800 dark:text-slate-100">{row.description}</p>
                             <span className="shrink-0 text-right">
                               {amounts.deposit > 0 && <p className="text-sm font-semibold text-[10px] text-emerald-700 dark:text-emerald-300">Deposit +{currency(amounts.deposit)}</p>}
                               {amounts.withdrawal > 0 && <p className="text-sm font-semibold text-[10px] text-rose-700 dark:text-rose-300">Withdrawal −{currency(amounts.withdrawal)}</p>}
                               {kind === 'transfer' && amounts.deposit === 0 && amounts.withdrawal === 0 && <p className="text-sm font-semibold text-[10px] text-blue-700 dark:text-blue-300">{currency(row.amount)}</p>}
                             </span>
                           </div>
                           <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-700 dark:text-slate-300">
                             <span className="font-medium">{dateLabel(row.transaction_date)}</span>
                             <span>{kind === 'transfer' ? `${sourceAccount?.account_name ?? account?.account_name ?? '—'} → ${destinationAccount?.account_name ?? '—'}` : account?.account_name ?? 'Account'}</span>
                             <span>{category?.name ?? (kind === 'transfer' ? 'Account transfer' : '—')}</span>
                           </div>
                           {row.reference_number && <span className="text-[9px] text-slate-500 dark:text-slate-400">Ref: {row.reference_number}</span>}
                           {kind === 'deposit' && <span className="text-[9px] text-emerald-700 dark:text-emerald-300">From: External source · To: {account?.account_name ?? '—'}</span>}
                         </div>
                       </article>
                    )
                  })}
                </div>
            </>
          )}
            <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 text-xs text-slate-400 dark:text-slate-500">Balances are calculated from opening balances and posted transactions.</div>
        </section>

         <aside className="space-y-5">
           <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
             <h2 className="font-semibold text-slate-900 dark:text-slate-100">Quick actions</h2>
             <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Common banking operations</p>
             <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => quickAction('deposit')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/50 px-2 py-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-200 dark:hover:text-emerald-800"><ArrowDownLeft className="h-4 w-4" /> Deposit</button>
                <button type="button" onClick={() => quickAction('withdrawal')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/50 px-2 py-2.5 text-sm font-medium text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-200 dark:hover:text-rose-800"><ArrowUpRight className="h-4 w-4" /> Withdraw</button>
                <button type="button" onClick={() => quickAction('transfer')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/50 px-2 py-2.5 text-sm font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-200 dark:hover:text-blue-800"><ArrowLeftRight className="h-4 w-4" /> Transfer</button>
               <button type="button" onClick={() => navigate('/transactions')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"><CirclePlus className="h-4 w-4" /> Add entry</button>
               <button type="button" onClick={() => navigate('/excel-import')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"><Upload className="h-4 w-4" /> Import</button>
               <button type="button" onClick={() => navigate('/excel-export')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"><Plus className="h-4 w-4" /> Export</button>
             </div>
          </section>

           <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
             <div className="flex items-center justify-between">
               <div>
                 <h2 className="font-semibold text-slate-900 dark:text-slate-100">Accounts overview</h2>
                 <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{data?.accounts.length ?? 0} linked accounts</p>
               </div>
               <button type="button" aria-label="View accounts" onClick={() => navigate('/accounts')} className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-200 hover:text-blue-700 dark:hover:text-blue-400"><Landmark className="h-4 w-4" /></button>
             </div>
             <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
               {data?.accounts.map((account) => (
                 <button key={account.id} type="button" onClick={() => navigate('/accounts')} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-600/10">
                   <span className="flex min-w-0 items-center gap-2.5">
                     <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"><Landmark className="h-4 w-4" /></span>
                     <span className="min-w-0">
                       <span className="block truncate text-sm font-medium text-foreground dark:text-foreground">{account.account_name}</span>
                       <span className="block truncate text-xs text-foreground dark:text-foreground">{account.bank_name}</span>
                     </span>
                   </span>
                   <span className="shrink-0 text-right">
                     <span className="block text-sm font-semibold text-foreground dark:text-foreground">{currency(account.current_balance)}</span>
                     <span className="text-[11px] text-emerald-700 dark:text-emerald-400">{account.status === 'active' ? 'Active' : account.status}</span>
                   </span>
                 </button>
               ))}
               {!data?.accounts.length && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No accounts to display.</p>}
             </div>
             <button type="button" onClick={() => navigate('/accounts')} className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">Manage accounts</button>
           </section>
        </aside>
      </div>
    </div>
  )
}
