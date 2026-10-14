import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Printer } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getTransactionMovement, groupTransactionEntries, loadFinanceData, type FinanceData, type TransactionRecord } from '../lib/financeData'

const currency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const isDeposit = (type: string) => ['income', 'interest', 'cash_deposit', 'broker_withdrawal', 'loan_repayment'].includes(type) // loan_repayment can be positive (received) or negative (paid)
const isWithdrawal = (type: string) => ['expense', 'cash_withdrawal', 'broker_deposit', 'ipo_payment', 'bank_charge', 'other'].includes(type)
const monthEnd = (month: string) => `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`

export const MonthlySummaryPage = () => {
  const { user } = useAuth()
  const [month, setMonth] = useState('2026-05')
  const title = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01`))
  const [data, setData] = useState<FinanceData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setData(await loadFinanceData(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the monthly statement.')
    } finally {
      setLoading(false)
    }
  }, [user])
  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => {
    if (!data) return { opening: 0, deposits: 0, withdrawals: 0, transfers: 0, closing: 0, rows: [] as TransactionRecord[] }
    const start = `${month}-01`
    const end = monthEnd(month)
    const opening = data.accounts.reduce((total, account) => {
      const movementBefore = data.transactions
        .filter((transaction) => transaction.account_id === account.id && transaction.transaction_date >= account.opening_balance_date && transaction.transaction_date < start)
        .reduce((balance, transaction) => balance + getTransactionMovement(transaction, data.transfers), 0)
      return total + (account.opening_balance_date < start ? account.opening_balance + movementBefore : 0)
    }, 0)
    const rows = data.transactions.filter((transaction) => transaction.transaction_date >= start && transaction.transaction_date <= end)
    const deposits = rows.filter((transaction) => isDeposit(transaction.transaction_type)).reduce((total, transaction) => total + transaction.amount, 0)
    const withdrawals = rows.filter((transaction) => isWithdrawal(transaction.transaction_type)).reduce((total, transaction) => total + transaction.amount, 0)
    const transfers = data.transfers.filter((transfer) => transfer.transfer_date >= start && transfer.transfer_date <= end).reduce((total, transfer) => total + transfer.amount, 0)
    const closing = data.accounts.reduce((total, account) => {
      if (account.opening_balance_date > end) return total
      const movement = data.transactions
        .filter((transaction) => transaction.account_id === account.id && transaction.transaction_date >= account.opening_balance_date && transaction.transaction_date <= end)
        .reduce((balance, transaction) => balance + getTransactionMovement(transaction, data.transfers), 0)
      return total + account.opening_balance + movement
    }, 0)
    return { opening, deposits, withdrawals, transfers, closing, rows }
  }, [data, month])
  const displayRows = useMemo(
    () => data ? groupTransactionEntries(summary.rows, data.transfers) : [],
    [data, summary.rows],
  )

  const totalDeposits = summary.rows.filter((r) => {
    const m = data ? getTransactionMovement(r, data.transfers) : 0
    return m > 0
  }).reduce((sum, r) => sum + (data ? getTransactionMovement(r, data.transfers) : 0), 0)
  const totalWithdrawals = summary.rows.filter((r) => {
    const m = data ? getTransactionMovement(r, data.transfers) : 0
    return m < 0
  }).reduce((sum, r) => sum + Math.abs(data ? getTransactionMovement(r, data.transfers) : 0), 0)

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-semibold text-blue-700">BANK STATEMENT</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Monthly summary</h1><p className="mt-1 text-sm text-slate-500">Account activity and balances for {title}.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4 text-slate-400" /><span className="sr-only">Select month</span><input type="month" aria-label="Select month" value={month} onChange={(event) => setMonth(event.target.value)} className="bg-transparent text-sm outline-none" /></label>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print statement</button>
        </div>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consolidated statement</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2></div>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {[
            ['Opening balance', summary.opening, 'text-slate-900'],
            ['Total deposits', summary.deposits, 'text-emerald-700'],
            ['Total withdrawals', summary.withdrawals, 'text-rose-700'],
            ['Total transfers', summary.transfers, 'text-blue-700'],
            ['Net movement', summary.deposits - summary.withdrawals, 'text-slate-900'],
            ['Closing balance', summary.closing, 'text-slate-900'],
          ].map(([label, amount, color]) => (
            <div key={label} className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <dt className="text-sm text-slate-600">{label}</dt><dd className={`text-sm font-semibold ${color}`}>{currency(Number(amount))}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Statement activity</h2><p className="mt-1 text-xs text-slate-500">{displayRows.length} displayed lines · {summary.rows.length} ledger entries for {title}</p></div>
        {loading ? <p className="px-5 py-10 text-center text-sm text-slate-500">Loading statement…</p> : summary.rows.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">There is no activity for this period.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className="px-3 py-2 font-semibold text-foreground dark:text-foreground">Date</th><th className="px-3 py-2 font-semibold text-foreground dark:text-foreground">Description</th><th className="px-3 py-2 font-semibold text-foreground dark:text-foreground">Account</th><th className="px-3 py-2 text-right font-semibold text-foreground dark:text-foreground">Deposit</th><th className="px-3 py-2 text-right font-semibold text-foreground dark:text-foreground">Withdrawal</th></tr></thead>
               <tbody>{displayRows.map(({ id, transaction: row, entries, transfer }) => {
                 const account = data?.accounts.find((item) => item.id === row.account_id)
                 const movement = data ? getTransactionMovement(row, data.transfers) : 0
                 const sourceAccount = transfer && data?.accounts.find((item) => item.id === transfer.from_account_id)
                 const destinationAccount = transfer && data?.accounts.find((item) => item.id === transfer.to_account_id)
                 
                 return <tr key={id} className="transaction-row border-t border-slate-200 dark:border-slate-700"><td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-foreground dark:text-foreground">{new Date(`${row.transaction_date}T00:00:00`).toLocaleDateString('en-IN')}</td><td className="px-3 py-1.5 font-medium text-foreground dark:text-foreground text-[13px]">{row.description}{transfer && <span className="ml-1 text-[10px] font-normal text-blue-700 dark:text-blue-300">Transfer {currency(row.amount)}</span>}</td><td className="px-3 py-1.5 text-[12px] text-foreground dark:text-foreground">{transfer ? <><span>{sourceAccount?.account_name ?? '—'} → {destinationAccount?.account_name ?? '—'}</span><details className="mt-1 text-[11px]"><summary className="cursor-pointer text-blue-700 dark:text-blue-300">View {entries.length} entries</summary><ul className="mt-1 space-y-1">{entries.map((entry) => { const entryAccount = data?.accounts.find((item) => item.id === entry.account_id); const entryMovement = data ? getTransactionMovement(entry, data.transfers) : 0; return <li key={entry.id}>{entryAccount?.account_name ?? 'Account'} · {entryMovement < 0 ? 'Outgoing' : 'Incoming'} {currency(Math.abs(entryMovement))} · {entry.id}</li> })}</ul></details></> : account?.account_name}</td><td className="px-3 py-1.5 text-right font-medium text-emerald-700 dark:text-emerald-400 text-[12px]">{!transfer && movement > 0 ? currency(movement) : '—'}</td><td className="px-3 py-1.5 text-right font-medium text-rose-700 dark:text-rose-400 text-[12px]">{!transfer && movement < 0 ? currency(Math.abs(movement)) : '—'}</td></tr>
               })}</tbody>
               <tfoot className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                 <tr>
                   <td className="px-3 py-2 font-semibold text-foreground dark:text-foreground" colSpan={3}>TOTAL</td>
                   <td className="px-3 py-2 text-right font-semibold text-emerald-700 text-[12px]">{currency(totalDeposits)}</td>
                   <td className="px-3 py-2 text-right font-semibold text-rose-700 text-[12px]">{currency(totalWithdrawals)}</td>
                 </tr>
               </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
