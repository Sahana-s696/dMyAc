import { useCallback, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookOpenText, CalendarRange, Download, Landmark, ReceiptText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadFinanceData, type FinanceData } from '../lib/financeData'

const reports = [
  { title: 'Account statement', description: 'Review activity and balances for each account.', icon: Landmark, href: '/accounts' },
  { title: 'Transaction statement', description: 'Browse and filter all posted account activity.', icon: ReceiptText, href: '/transactions' },
  { title: 'Deposit report', description: 'Review money received across your accounts.', icon: ArrowDownLeft, href: '/transactions?type=deposit' },
  { title: 'Withdrawal report', description: 'Review outgoing account activity.', icon: ArrowUpRight, href: '/transactions?type=withdrawal' },
  { title: 'Transfer report', description: 'View movements between your own accounts.', icon: ArrowLeftRight, href: '/transfers' },
  { title: 'Monthly statement', description: 'See opening balance, movement, and closing balance.', icon: CalendarRange, href: '/monthly-summary' },
  { title: 'Yearly statement', description: 'Compare account movement by financial year.', icon: BookOpenText, href: '/yearly-summary' },
  { title: 'Export records', description: 'Download account and transaction data as a workbook.', icon: Download, href: '/excel-export' }
]

export const ReportsPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<FinanceData | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    try {
      setData(await loadFinanceData(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load report totals.')
    }
  }, [user])
  useEffect(() => { void load() }, [load])

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-500">STATEMENTS & REPORTS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Banking statements and clear, table-first account reports.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{error}</div>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Accounts', count: data?.accounts.length ?? 0, icon: Landmark },
          { label: 'Transactions', count: data?.transactions.length ?? 0, icon: ReceiptText },
          { label: 'Transfers', count: data?.transfers.length ?? 0, icon: ArrowLeftRight },
          { label: 'Categories', count: data?.categories.length ?? 0, icon: BookOpenText },
        ].map(({ label, count, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"><Icon className="h-5 w-5" /></span>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-slate-100">{count}</p></div>
          </div>
        ))}
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-600 px-4 py-4"><h2 className="font-semibold text-slate-900 dark:text-slate-100">Available reports</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose a statement to view or export.</p></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-600">
          {reports.map(({ title, description, icon: Icon, href }) => (
            <button key={title} type="button" onClick={() => navigate(href)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-600 sm:px-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-blue-700 dark:bg-slate-600 dark:text-blue-300"><Icon className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{title}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span></span>
              <span className="text-slate-400 dark:text-slate-300">›</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}