import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getTransactionMovement, loadFinanceData, type FinanceData } from '../lib/financeData'

const currency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const isDeposit = (type: string) => ['income', 'interest', 'cash_deposit', 'broker_withdrawal', 'loan_repayment'].includes(type)
const isWithdrawal = (type: string) => ['expense', 'cash_withdrawal', 'broker_deposit', 'ipo_payment', 'bank_charge', 'other'].includes(type)

export const YearlySummaryPage = () => {
  const { user } = useAuth()
  const [data, setData] = useState<FinanceData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setData(await loadFinanceData(user.id))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load yearly statements.')
    } finally {
      setLoading(false)
    }
  }, [user])
  useEffect(() => { void load() }, [load])

  const years = useMemo(() => {
    if (!data) return []
    const yearValues = [...new Set(data.transactions.map((row) => row.transaction_date.slice(0, 4)))].sort((a, b) => b.localeCompare(a))
    return yearValues.map((year) => {
      const start = `${year}-01-01`
      const end = `${year}-12-31`
      const transactions = data.transactions.filter((row) => row.transaction_date >= start && row.transaction_date <= end)
      const deposits = transactions.filter((row) => isDeposit(row.transaction_type)).reduce((total, row) => total + row.amount, 0)
      const withdrawals = transactions.filter((row) => isWithdrawal(row.transaction_type)).reduce((total, row) => total + row.amount, 0)
      const transfers = data.transfers.filter((row) => row.transfer_date >= start && row.transfer_date <= end).reduce((total, row) => total + row.amount, 0)
      const opening = data.accounts.reduce((total, account) => {
        if (account.opening_balance_date >= start) return total
        const prior = data.transactions
          .filter((row) => row.account_id === account.id && row.transaction_date >= account.opening_balance_date && row.transaction_date < start)
          .reduce((balance, row) => balance + getTransactionMovement(row, data.transfers), 0)
        return total + account.opening_balance + prior
      }, 0)
      const yearEndBalance = data.accounts.reduce((total, account) => {
        if (account.opening_balance_date > end) return total
        const movement = data.transactions
          .filter((row) => row.account_id === account.id && row.transaction_date >= account.opening_balance_date && row.transaction_date <= end)
          .reduce((balance, row) => balance + getTransactionMovement(row, data.transfers), 0)
        return total + account.opening_balance + movement
      }, 0)
      return { year, deposits, withdrawals, transfers, net: yearEndBalance - opening, opening, closing: yearEndBalance }
    })
  }, [data])

  const totalDeposits = years.reduce((sum, row) => sum + row.deposits, 0)
  const totalWithdrawals = years.reduce((sum, row) => sum + row.withdrawals, 0)
  const totalTransfers = years.reduce((sum, row) => sum + row.transfers, 0)
  const totalNet = years.reduce((sum, row) => sum + row.net, 0)
  const totalOpening = years.reduce((sum, row) => sum + row.opening, 0)
  const totalClosing = years.reduce((sum, row) => sum + row.closing, 0)

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div><p className="text-sm font-semibold text-blue-700">ANNUAL STATEMENT</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Yearly summary</h1><p className="mt-1 text-sm text-slate-500">Review yearly deposits, withdrawals, transfers, and closing balances.</p></div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Yearly account statement</h2><p className="mt-1 text-xs text-slate-500">Balances use posted account activity and opening balances.</p></div>
        {loading ? <p className="px-5 py-12 text-center text-sm text-slate-500">Loading yearly statements…</p> : !years.length ? <p className="px-5 py-12 text-center text-sm text-slate-500">Yearly statements will appear after you record transactions.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2 font-semibold">Year</th><th className="px-3 py-2 text-right font-semibold">Opening balance</th><th className="px-3 py-2 text-right font-semibold">Deposits</th><th className="px-3 py-2 text-right font-semibold">Withdrawals</th><th className="px-3 py-2 text-right font-semibold">Transfers</th><th className="px-3 py-2 text-right font-semibold">Net movement</th><th className="px-3 py-2 text-right font-semibold">Closing balance</th></tr></thead>
              <tbody>{years.map((row) => <tr key={row.year} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-3 py-1.5 font-semibold text-slate-800 text-[13px]">{row.year}</td><td className="whitespace-nowrap px-3 py-1.5 text-right text-slate-600 text-[12px]">{currency(row.opening)}</td><td className="whitespace-nowrap px-3 py-1.5 text-right font-medium text-emerald-700 text-[12px]">{currency(row.deposits)}</td><td className="whitespace-nowrap px-3 py-1.5 text-right font-medium text-rose-700 text-[12px]">{currency(row.withdrawals)}</td><td className="whitespace-nowrap px-3 py-1.5 text-right font-medium text-blue-700 text-[12px]">{currency(row.transfers)}</td><td className="whitespace-nowrap px-3 py-1.5 text-right font-medium text-slate-700 text-[12px]">{currency(row.net)}</td><td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold text-slate-900 text-[12px]">{currency(row.closing)}</td></tr>)}</tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-600">TOTAL</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-600 text-[12px]">{currency(totalOpening)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700 text-[12px]">{currency(totalDeposits)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-rose-700 text-[12px]">{currency(totalWithdrawals)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-700 text-[12px]">{currency(totalTransfers)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700 text-[12px]">{currency(totalNet)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900 text-[12px]">{currency(totalClosing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
