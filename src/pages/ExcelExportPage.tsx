import { useCallback, useEffect, useState } from 'react'
import { Download, FileOutput } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { compareTransactionsChronologically, getTransactionMovement, loadFinanceData, type FinanceBackup, type FinanceData } from '../lib/financeData'

type ExportKind = 'account' | 'transactions' | 'monthly' | 'yearly' | 'all'
type ExportFormat = 'excel' | 'csv' | 'json'
const currentDate = new Date()
const currentMonth = currentDate.toISOString().slice(0, 7)
const currentYear = String(currentDate.getFullYear())
const currencyValue = (value: number) => Number(value.toFixed(2))
const formatType = (type: string) => type === 'income' ? 'Deposit' : type === 'expense' ? 'Withdrawal' : type === 'transfer' ? 'Transfer' : type.replaceAll('_', ' ')
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to export the selected records.'

function transactionRows(data: FinanceData) {
  return [...data.transactions].sort(compareTransactionsChronologically).map((transaction) => {
    const account = data.accounts.find((item) => item.id === transaction.account_id)
    const category = data.categories.find((item) => item.id === transaction.category_id)
    return {
      Date: transaction.transaction_date,
      Description: transaction.description,
      Account: account?.account_name ?? '',
      Category: category?.name ?? '',
      Type: formatType(transaction.transaction_type),
      Amount: currencyValue(transaction.amount),
      Reference: transaction.reference_number ?? '',
      Notes: transaction.notes ?? '',
    }
  })
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: object[]) {
  const normalizedRows = rows.map((row) => Object.fromEntries(Object.entries(row)))
  const sheet = XLSX.utils.json_to_sheet(normalizedRows)
  const headers = Object.keys(rows[0] ?? {})
  sheet['!cols'] = headers.map((header) => ({ wch: Math.min(Math.max(header.length + 4, ...normalizedRows.slice(0, 30).map((row) => String(row[header] ?? '').length + 2)), 42) }))
  XLSX.utils.book_append_sheet(workbook, sheet, name)
}

function portableBackup(data: FinanceData): FinanceBackup {
  return {
    format: 'dmyac-finance-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    accounts: data.accounts.map(({ user_id: _userId, ...account }) => account),
    categories: data.categories.map(({ user_id: _userId, ...category }) => category),
    transactions: data.transactions.map(({ user_id: _userId, ...transaction }) => transaction),
    transfers: data.transfers.map(({ user_id: _userId, ...transfer }) => transfer),
  }
}

function downloadText(content: string, fileName: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function accountStatementRows(data: FinanceData, accountId: string) {
  const account = data.accounts.find((item) => item.id === accountId)
  if (!account) throw new Error('Select an account before exporting its statement.')
  const records = data.transactions
    .filter((transaction) => transaction.account_id === account.id)
    .sort(compareTransactionsChronologically)
  let balance = account.opening_balance
  return [
    { Date: account.opening_balance_date, Description: 'Opening balance', Reference: '', Deposit: '', Withdrawal: '', Balance: currencyValue(balance) },
    ...records.map((transaction) => {
      const movement = getTransactionMovement(transaction, data.transfers)
      if (transaction.transaction_date >= account.opening_balance_date) balance += movement
      return {
        Date: transaction.transaction_date,
        Description: transaction.description,
        Reference: transaction.reference_number ?? '',
        Deposit: movement > 0 ? currencyValue(movement) : '',
        Withdrawal: movement < 0 ? currencyValue(Math.abs(movement)) : '',
        Balance: currencyValue(balance),
      }
    }),
  ]
}

function monthlyStatementRows(data: FinanceData, accountId: string, start: string, end: string) {
  const account = data.accounts.find((item) => item.id === accountId)
  if (!account) throw new Error('Select an account before exporting its statement.')
  const ordered = data.transactions
    .filter((transaction) => transaction.account_id === account.id && transaction.transaction_date >= account.opening_balance_date)
    .sort(compareTransactionsChronologically)
  const openingBalance = ordered
    .filter((transaction) => transaction.transaction_date < start)
    .reduce((balance, transaction) => balance + getTransactionMovement(transaction, data.transfers), account.opening_balance)
  let balance = openingBalance
  const rows: Record<string, unknown>[] = [{ Date: start, Description: 'Opening balance', Reference: '', Deposit: '', Withdrawal: '', Balance: currencyValue(balance) }]
  let deposits = 0
  let withdrawals = 0
  for (const transaction of ordered.filter((item) => item.transaction_date >= start && item.transaction_date <= end)) {
    const movement = getTransactionMovement(transaction, data.transfers)
    balance += movement
    if (movement > 0) deposits += movement
    else withdrawals += Math.abs(movement)
    rows.push({
      Date: transaction.transaction_date,
      Description: transaction.description,
      Reference: transaction.reference_number ?? '',
      Deposit: movement > 0 ? currencyValue(movement) : '',
      Withdrawal: movement < 0 ? currencyValue(Math.abs(movement)) : '',
      Balance: currencyValue(balance),
    })
  }
  const transfers = data.transfers
    .filter((transfer) => transfer.transfer_date >= start && transfer.transfer_date <= end && (transfer.from_account_id === accountId || transfer.to_account_id === accountId))
    .reduce((total, transfer) => total + transfer.amount, 0)
  return {
    rows,
    totals: { Period: `${start.slice(0, 7)}`, OpeningBalance: currencyValue(openingBalance), Deposits: currencyValue(deposits), Withdrawals: currencyValue(withdrawals), Transfers: currencyValue(transfers), ClosingBalance: currencyValue(balance) },
  }
}

export const ExcelExportPage = () => {
  const { user } = useAuth()
  const location = useLocation()
  const routeState = location.state
  const stateKind = routeState && typeof routeState === 'object' && 'kind' in routeState && routeState.kind === 'account' ? 'account' : 'all'
  const stateAccountId = routeState && typeof routeState === 'object' && 'account_id' in routeState && typeof routeState.account_id === 'string' ? routeState.account_id : ''
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [kind, setKind] = useState<ExportKind>(stateKind)
  const [format, setFormat] = useState<ExportFormat>('excel')
  const [accountId, setAccountId] = useState<string>(stateAccountId)
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const result = await loadFinanceData(user.id, true)
      setData(result)
      setAccountId((current) => current || result.accounts[0]?.id || '')
      setError('')
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [user])
  useEffect(() => { void load() }, [load])

  const exportFile = () => {
    if (!data) return setError('Finance records are not loaded yet.')
    setExporting(true)
    setError('')
    setNotice('')
    try {
      const backup = portableBackup(data)
      const baseName = kind === 'all' ? 'finance-backup' : `${kind}-statement`
      const extension = format === 'excel' ? 'xlsx' : format
      if (format === 'json' && kind === 'all') {
        downloadText(JSON.stringify(backup, null, 2), `${baseName}.json`, 'application/json')
        setNotice('Your JSON backup has been created and downloaded.')
        return
      }
      if (format === 'csv' && kind === 'all') {
        const columns = [
          'id', 'account_name', 'bank_name', 'account_number', 'account_type', 'opening_balance', 'opening_balance_date', 'status', 'notes',
          'name', 'category_type', 'parent_id', 'is_active', 'account_id', 'transaction_date', 'description', 'transaction_type',
          'category_id', 'amount', 'reference_number', 'transfer_id', 'from_account_id', 'to_account_id', 'transfer_date',
        ]
        const records: Record<string, unknown>[] = [
          ...backup.accounts.map((payload) => ({ record_type: 'account', ...payload })),
          ...backup.categories.map((payload) => ({ record_type: 'category', ...payload })),
          ...backup.transactions.map((payload) => ({ record_type: 'transaction', ...payload })),
          ...backup.transfers.map((payload) => ({ record_type: 'transfer', ...payload })),
        ]
        const sheet = XLSX.utils.aoa_to_sheet([
          ['record_type', ...columns],
          ...records.map((record) => [record.record_type, ...columns.map((column) => record[column] ?? '')]),
        ])
        downloadText(XLSX.utils.sheet_to_csv(sheet), `${baseName}.csv`, 'text/csv;charset=utf-8')
        setNotice('Your CSV backup has been created and downloaded.')
        return
      }
      if (format === 'json' || format === 'csv') {
        const selectedMonthStart = `${month}-01`
        const selectedMonthEnd = `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`
        const yearStart = `${year}-01-01`
        const yearEnd = `${year}-12-31`
        let rows: Record<string, unknown>[]
        if (kind === 'account') rows = accountStatementRows(data, accountId)
        else if (kind === 'transactions') rows = transactionRows(data)
        else if (kind === 'monthly') rows = monthlyStatementRows(data, accountId, selectedMonthStart, selectedMonthEnd).rows
        else if (kind === 'yearly') rows = transactionRows(data).filter((row) => String(row.Date) >= yearStart && String(row.Date) <= yearEnd)
        else rows = []
        const content = format === 'json'
          ? JSON.stringify(rows, null, 2)
          : XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows))
        downloadText(content, `${baseName}.${extension}`, format === 'json' ? 'application/json' : 'text/csv;charset=utf-8')
        setNotice(`Your ${format.toUpperCase()} export has been created and downloaded.`)
        return
      }

      const workbook = XLSX.utils.book_new()
      const rows = transactionRows(data)
      const selectedMonthStart = `${month}-01`
      const selectedMonthEnd = `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`
      const yearStart = `${year}-01-01`
      const yearEnd = `${year}-12-31`

      if (kind === 'account') {
        const selectedAccount = data.accounts.find((account) => account.id === accountId)
        if (!selectedAccount) throw new Error('Select an account to export.')
        appendSheet(workbook, 'Account Statement', accountStatementRows(data, accountId))
        XLSX.writeFile(workbook, `${selectedAccount.account_name.replace(/[^a-z0-9-_]/gi, '_')}-statement.xlsx`)
      } else if (kind === 'transactions') {
        appendSheet(workbook, 'Transactions', rows)
        XLSX.writeFile(workbook, 'finance-transactions.xlsx')
      } else if (kind === 'monthly') {
        if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Select a valid statement month.')
        const statement = monthlyStatementRows(data, accountId, selectedMonthStart, selectedMonthEnd)
        appendSheet(workbook, 'Monthly Statement', statement.rows)
        appendSheet(workbook, 'Monthly Totals', [statement.totals])
        XLSX.writeFile(workbook, `monthly-statement-${month}.xlsx`)
      } else if (kind === 'yearly') {
        appendSheet(workbook, 'Yearly Statement', rows.filter((row) => String(row.Date) >= yearStart && String(row.Date) <= yearEnd))
        appendSheet(workbook, 'Transfers', data.transfers.filter((transfer) => transfer.transfer_date >= yearStart && transfer.transfer_date <= yearEnd).map((transfer) => ({
          Date: transfer.transfer_date,
          From: data.accounts.find((account) => account.id === transfer.from_account_id)?.account_name ?? '',
          To: data.accounts.find((account) => account.id === transfer.to_account_id)?.account_name ?? '',
          Description: transfer.description,
          Amount: currencyValue(transfer.amount),
          Reference: transfer.reference_number ?? '',
        })))
        XLSX.writeFile(workbook, `yearly-statement-${year}.xlsx`)
      } else {
        appendSheet(workbook, 'Accounts', backup.accounts)
        appendSheet(workbook, 'Transactions', backup.transactions)
        appendSheet(workbook, 'Transfers', backup.transfers)
        appendSheet(workbook, 'Categories', backup.categories)
        XLSX.writeFile(workbook, `${baseName}.xlsx`)
      }
      setNotice('Your workbook has been created and downloaded.')
    } catch (exportError) {
      setError(errorMessage(exportError))
    } finally {
      setExporting(false)
    }
  }

  const options: { id: ExportKind; label: string; description: string }[] = [
    { id: 'account', label: 'Account statement', description: 'Statement with running balance for one account.' },
    { id: 'transactions', label: 'Transactions', description: 'Download the transaction ledger.' },
    { id: 'monthly', label: 'Monthly statement', description: 'Transactions for a selected month.' },
    { id: 'yearly', label: 'Yearly statement', description: 'Transactions and transfers for a selected year.' },
    { id: 'all', label: 'All data', description: 'Workbook with accounts, transactions, transfers, and categories.' },
  ]
  const extensionLabel = format === 'excel' ? 'workbook' : format.toUpperCase() + ' file'

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/70 px-5 py-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Data portability</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Export data</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Download account and transaction records as Excel, CSV, or JSON. Choose All data to create a portable backup.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">{notice}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div className="flex items-center gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><FileOutput className="h-4 w-4" /></span><div><h2 className="font-semibold text-slate-900 dark:text-slate-100">Choose an export</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Select a report or full backup.</p></div></div></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {options.map((option) => (
            <label key={option.id} className={`flex cursor-pointer items-start gap-3 border-l-2 px-5 py-3.5 transition-colors ${kind === option.id ? 'border-l-blue-500 bg-blue-50/70 dark:border-l-blue-400 dark:bg-blue-950/30' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70'}`}>
              <input type="radio" name="export-kind" value={option.id} checked={kind === option.id} onChange={() => setKind(option.id)} className="mt-1 accent-blue-700 dark:accent-blue-400" />
              <span><span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{option.description}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Export options</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">File format<select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]"><option value="excel">Excel workbook (.xlsx)</option><option value="csv">CSV (.csv)</option><option value="json">JSON (.json)</option></select></label>
          {(kind === 'account' || kind === 'monthly') && <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Account<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]"><option value="">Select account</option>{data?.accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}</select></label>}
          {kind === 'monthly' && <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Statement month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]" /></label>}
          {kind === 'yearly' && <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Statement year<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" /></label>}
        </div>
        <div className="mt-5 flex flex-col justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-700 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? 'Loading your records…' : `${data?.accounts.length ?? 0} accounts · ${data?.transactions.length ?? 0} ledger entries · ${data?.transfers.length ?? 0} transfers`}</p>
          <button type="button" disabled={loading || exporting || !data} onClick={exportFile} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />{exporting ? 'Preparing export…' : `Download ${extensionLabel}`}</button>
        </div>
      </section>
    </div>
  )
}
