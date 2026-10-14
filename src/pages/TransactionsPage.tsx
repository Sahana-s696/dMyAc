import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, ChevronUp, Plus, Search, X, Edit, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { compareTransactionsChronologically, createTransaction, createTransfer, deleteTransaction, getTransactionMovement, groupTransactionEntries, loadFinanceData, updateTransaction, updateTransfer, type FinanceData, type NewTransaction, type TransactionRecord, type UpdateTransaction } from '../lib/financeData'

type Operation = 'deposit' | 'withdrawal' | 'transfer'
type TransactionForm = {
  account_id: string
  to_account_id: string
  transaction_date: string
  amount: string
  category_id: string
  description: string
  reference_number: string
  notes: string
}

const emptyForm = (): TransactionForm => ({
  account_id: '',
  to_account_id: '',
  transaction_date: new Date().toISOString().slice(0, 10),
  amount: '',
  category_id: '',
  description: '',
  reference_number: '',
  notes: '',
})
const currency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
const isDeposit = (type: string) => ['income', 'interest', 'cash_deposit', 'broker_withdrawal'].includes(type)
const operationFromState = (state: unknown): Operation | null => {
  if (!state || typeof state !== 'object' || !('operation' in state)) return null
  const operation = state.operation
  return operation === 'deposit' || operation === 'withdrawal' || operation === 'transfer' ? operation : null
}
const typeLabel = (type: string) => type === 'income' ? 'Deposit' : type === 'expense' ? 'Withdrawal' : type === 'transfer' ? 'Transfer' : type.replaceAll('_', ' ')
const messageForError = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this request.'

function runningBalances(data: FinanceData) {
  const result = new Map<string, number>()
  const balances = new Map(data.accounts.map((account) => [account.id, account.opening_balance]))
  const rows = [...data.transactions].sort(compareTransactionsChronologically)
  for (const row of rows) {
    const account = data.accounts.find((item) => item.id === row.account_id)
    if (!account || row.transaction_date < account.opening_balance_date) continue
    const balance = (balances.get(row.account_id) ?? 0) + getTransactionMovement(row, data.transfers)
    balances.set(row.account_id, balance)
    result.set(row.id, balance)
  }
  return result
}

function groupAmounts(entries: FinanceData['transactions'], transfers: FinanceData['transfers'], accountId: string) {
  const relevantEntries = accountId === 'all' ? entries : entries.filter((entry) => entry.account_id === accountId)
  return relevantEntries.reduce((amounts, entry) => {
    const movement = getTransactionMovement(entry, transfers)
    if (movement > 0) amounts.deposit += movement
    if (movement < 0) amounts.withdrawal += Math.abs(movement)
    return amounts
  }, { deposit: 0, withdrawal: 0 })
}

export const TransactionsPage = () => {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [operation, setOperation] = useState<Operation | null>(null)
  const [form, setForm] = useState<TransactionForm>(emptyForm)
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('search') ?? '')
  const [accountFilter, setAccountFilter] = useState(new URLSearchParams(location.search).get('accountId') ?? 'all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState(() => {
    const requestedType = new URLSearchParams(location.search).get('type')
    return requestedType === 'deposit' || requestedType === 'withdrawal' || requestedType === 'transfer' ? requestedType : 'all'
  })
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedTransferGroups, setExpandedTransferGroups] = useState<Set<string>>(() => new Set())
  const [editingTransaction, setEditingTransaction] = useState<TransactionRecord | null>(null)
  const [editForm, setEditForm] = useState<UpdateTransaction & { account_id: string; reference_number: string; notes: string }>({
    account_id: '',
    transaction_date: '',
    description: '',
    transaction_type: 'income',
    category_id: null,
    amount: 0,
    reference_number: '',
    notes: '',
  })
  const editingTransfer = editingTransaction?.transaction_type === 'transfer'
    ? data?.transfers.find((transfer) => transfer.id === editingTransaction.transfer_id)
    : undefined
  const editingDateMinimum = editingTransaction?.transaction_type === 'transfer' && editingTransfer
    ? [editingTransfer.from_account_id, editingTransfer.to_account_id]
      .map((accountId) => data?.accounts.find((account) => account.id === accountId)?.opening_balance_date ?? '')
      .sort()
      .at(-1)
    : data?.accounts.find((account) => account.id === editForm.account_id)?.opening_balance_date

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setData(await loadFinanceData(user.id))
      setError('')
    } catch (loadError) {
      setError(messageForError(loadError))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const requested = operationFromState(location.state)
    if (requested) {
      setOperation(requested)
      const requestedAccount = location.state && typeof location.state === 'object' && 'account_id' in location.state && typeof location.state.account_id === 'string'
        ? location.state.account_id
        : ''
      setForm({ ...emptyForm(), account_id: requestedAccount })
    }
  }, [location.state])

  const filteredCategories = data?.categories.filter((category) =>
    operation === 'transfer' ? category.category_type === 'transfer'
      : operation === 'deposit' ? category.category_type === 'income'
        : category.category_type === 'expense',
  ) ?? []
  const balances = useMemo(() => data ? runningBalances(data) : new Map<string, number>(), [data])

  const transactions = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    return groupTransactionEntries(data.transactions, data.transfers)
      .filter(({ transaction, entries, transfer }) => {
        const category = data.categories.find((item) => item.id === transaction.category_id)
        const sourceAccount = transfer && data.accounts.find((item) => item.id === transfer.from_account_id)
        const destinationAccount = transfer && data.accounts.find((item) => item.id === transfer.to_account_id)
        const entryText = entries.map((entry) => {
          const account = data.accounts.find((item) => item.id === entry.account_id)
          return `${entry.description} ${entry.reference_number ?? ''} ${entry.notes ?? ''} ${account?.account_name ?? ''}`
        }).join(' ')
        const matchesSearch = !query || `${entryText} ${category?.name ?? ''} ${sourceAccount?.account_name ?? ''} ${destinationAccount?.account_name ?? ''}`.toLowerCase().includes(query)
        const matchesAccount = accountFilter === 'all' || entries.some((entry) => entry.account_id === accountFilter)
        const matchesCategory = categoryFilter === 'all' || transaction.category_id === categoryFilter
        const matchesFrom = !dateFrom || transaction.transaction_date >= dateFrom
        const matchesTo = !dateTo || transaction.transaction_date <= dateTo
        const matchesType = typeFilter === 'all' || (typeFilter === 'deposit' ? isDeposit(transaction.transaction_type) : typeFilter === 'withdrawal' ? transaction.transaction_type !== 'transfer' && !isDeposit(transaction.transaction_type) : transaction.transaction_type === 'transfer')
        return matchesSearch && matchesAccount && matchesCategory && matchesFrom && matchesTo && matchesType
      })
  }, [data, search, accountFilter, categoryFilter, typeFilter, dateFrom, dateTo])

  const toggleTransferDetails = (groupId: string) => {
    setExpandedTransferGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const openForm = (kind: Operation) => {
    setOperation(kind)
    setForm(emptyForm())
    setError('')
  }

  const submitTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !operation) return
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!form.description.trim()) {
      setError('Enter a description for this transaction.')
      return
    }
    if (!form.account_id || (operation === 'transfer' && (!form.to_account_id || form.to_account_id === form.account_id))) {
      setError(operation === 'transfer' ? 'Choose two different accounts.' : 'Choose an account.')
      return
    }
    const account = data?.accounts.find((item) => item.id === form.account_id)
    const destination = data?.accounts.find((item) => item.id === form.to_account_id)
    if (account && form.transaction_date < account.opening_balance_date || operation === 'transfer' && destination && form.transaction_date < destination.opening_balance_date) {
      setError('The transaction date cannot predate the account opening date.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (operation === 'transfer') {
        await createTransfer(user.id, {
          from_account_id: form.account_id,
          to_account_id: form.to_account_id,
          transfer_date: form.transaction_date,
          description: form.description.trim(),
          amount,
          reference_number: form.reference_number.trim() || null,
        })
      } else {
        const payload: NewTransaction = {
          account_id: form.account_id,
          transaction_date: form.transaction_date,
          description: form.description.trim(),
          transaction_type: operation === 'deposit' ? 'income' : 'expense',
          category_id: form.category_id || null,
          amount,
          reference_number: form.reference_number.trim() || null,
          notes: form.notes.trim() || null,
        }
        await createTransaction(user.id, payload)
      }
      setOperation(null)
      setForm(emptyForm())
      await reload()
    } catch (submitError) {
      setError(messageForError(submitError))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = useCallback((row: TransactionRecord) => {
    const isTransfer = row.transaction_type === 'transfer'
    
    setEditingTransaction(row)
    setEditForm({
      account_id: row.account_id,
      transaction_date: row.transaction_date,
      description: row.description,
      transaction_type: isTransfer ? 'income' : row.transaction_type as 'income' | 'expense',
      category_id: row.category_id,
      amount: row.amount,
      reference_number: row.reference_number ?? '',
      notes: row.notes ?? '',
    })
    setError('')
  }, [])

  const requestedEditId = location.state && typeof location.state === 'object'
    && 'edit_transaction_id' in location.state
    && typeof location.state.edit_transaction_id === 'string'
    ? location.state.edit_transaction_id
    : ''
  useEffect(() => {
    if (!requestedEditId || !data) return
    const requestedTransaction = data.transactions.find((transaction) => transaction.id === requestedEditId)
    if (requestedTransaction) openEdit(requestedTransaction)
    else setError('The requested transaction could not be found.')
    navigate('/transactions', { replace: true, state: null })
  }, [data, navigate, openEdit, requestedEditId])

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !editingTransaction) return
    
    const amount = Number(editForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!editForm.description.trim()) {
      setError('Enter a description for this transaction.')
      return
    }
    if (editingTransaction.transaction_type !== 'transfer' && !editForm.account_id) {
      setError('Choose an account.')
      return
    }
    const transferFromAccount = editingTransfer && data?.accounts.find((item) => item.id === editingTransfer.from_account_id)
    const transferToAccount = editingTransfer && data?.accounts.find((item) => item.id === editingTransfer.to_account_id)
    const account = data?.accounts.find((item) => item.id === editForm.account_id)
    if (editingTransaction.transaction_type === 'transfer'
      ? (transferFromAccount && editForm.transaction_date < transferFromAccount.opening_balance_date)
        || (transferToAccount && editForm.transaction_date < transferToAccount.opening_balance_date)
      : account && editForm.transaction_date < account.opening_balance_date) {
      setError('The transaction date cannot predate the account opening date.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editingTransaction.transaction_type === 'transfer') {
        if (!editingTransaction.transfer_id) throw new Error('Transfer details could not be found. Reload and try again.')
        await updateTransfer(user.id, editingTransaction.transfer_id, {
          transfer_date: editForm.transaction_date,
          description: editForm.description.trim(),
          amount,
          reference_number: editForm.reference_number.trim() || null,
        })
      } else {
        // Update regular transaction
        await updateTransaction(user.id, editingTransaction.id, {
          account_id: editForm.account_id,
          transaction_date: editForm.transaction_date,
          description: editForm.description.trim(),
          transaction_type: editForm.transaction_type,
          category_id: editForm.category_id || null,
          amount,
          reference_number: editForm.reference_number.trim() || null,
          notes: editForm.notes.trim() || null,
        })
      }
      setEditingTransaction(null)
      await reload()
    } catch (submitError) {
      setError(messageForError(submitError))
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingTransaction(null)
    setError('')
  }

  const handleDelete = async (row: TransactionRecord) => {
    if (!user) return
    const confirmation = row.transaction_type === 'transfer'
      ? `Delete "${row.description}"? This removes both account entries and cannot be undone.`
      : `Delete "${row.description}"? This action cannot be undone.`
    if (!confirm(confirmation)) return
    setError('')
    try {
      await deleteTransaction(user.id, row.id)
      await reload()
    } catch (err) {
      setError(messageForError(err))
    }
  }

  const statementTotals = transactions.reduce((totals, group) => {
    const amounts = data ? groupAmounts(group.entries, data.transfers, accountFilter) : { deposit: 0, withdrawal: 0 }
    return {
      deposits: totals.deposits + amounts.deposit,
      withdrawals: totals.withdrawals + amounts.withdrawal,
    }
  }, { deposits: 0, withdrawals: 0 })
  const totalDeposits = statementTotals.deposits
  const totalWithdrawals = statementTotals.withdrawals
  const totalVisible = transactions.length

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">ACCOUNT ACTIVITY</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Transactions</h1>
          <p className="mt-1 text-sm text-slate-500">Review deposits, withdrawals, and transfers across your accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openForm('deposit')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"><ArrowDownLeft className="h-4 w-4" /> Deposit</button>
          <button type="button" onClick={() => openForm('withdrawal')} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-rose-800"><ArrowUpRight className="h-4 w-4" /> Withdrawal</button>
          <button type="button" onClick={() => openForm('transfer')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"><ArrowLeftRight className="h-4 w-4" /> Transfer</button>
        </div>
      </div>

      {error && !operation && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

       <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-slate-800 shadow-sm">
         <div className="border-b border-slate-200 dark:border-slate-600 px-4 py-4 sm:px-5">
           <h2 className="font-semibold text-slate-900 dark:text-slate-100">Transaction statement</h2>
           <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{totalVisible} displayed lines · Transfer lines combine paired account entries; expand for details</p>
         </div>
        <div className="grid gap-2 border-b border-slate-200 p-4 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-100" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description, reference..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-300 dark:focus:ring-blue-300" />
          </label>
          <select aria-label="Filter by account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:[color-scheme:dark]">
            <option value="all">All accounts</option>
            {data?.accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
          </select>
          <select aria-label="Filter by transaction type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:[color-scheme:dark]">
            <option value="all">All types</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="transfer">Transfers</option>
          </select>
          <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:[color-scheme:dark]">
            <option value="all">All categories</option>
            {data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <span>From</span>
            <input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="min-w-0 bg-transparent py-2 text-xs text-slate-950 outline-none dark:text-slate-50 dark:[color-scheme:dark]" />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <span>To</span>
            <input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="min-w-0 bg-transparent py-2 text-xs text-slate-950 outline-none dark:text-slate-50 dark:[color-scheme:dark]" />
          </label>
        </div>

        {loading ? (
          <div className="px-4 py-14 text-center text-sm text-slate-600 dark:text-slate-100">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <WalletIcon />
            <h3 className="mt-3 font-medium text-slate-900 dark:text-slate-100">No transactions found</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-100">Try adjusting your filters or post your first transaction.</p>
            <button type="button" onClick={() => openForm('deposit')} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800"><Plus className="h-4 w-4" /> Add transaction</button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
<thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  <tr>
<th className="px-3 py-2 font-semibold">Date</th>
                       <th className="px-3 py-2 font-semibold">Account</th>
                       <th className="px-3 py-2 font-semibold">Category</th>
                       <th className="px-3 py-2 font-semibold">Description</th>
                       <th className="px-3 py-2 text-right font-semibold">Deposit</th>
                       <th className="px-3 py-2 text-right font-semibold">Withdrawal</th>
                       <th className="px-3 py-2 text-right font-semibold">Balance</th>
                       <th className="px-3 py-2 text-right font-semibold">Actions</th>
                   </tr>
                 </thead>
                <tbody>
                  {transactions.map(({ id, transaction: row, entries, transfer }) => {
                    const account = data?.accounts.find((item) => item.id === row.account_id)
                    const category = data?.categories.find((item) => item.id === row.category_id)
                    const relevantEntry = accountFilter === 'all' ? row : entries.find((entry) => entry.account_id === accountFilter) ?? row
                    const amounts = data ? groupAmounts(entries, data.transfers, accountFilter) : { deposit: 0, withdrawal: 0 }
                    const kind = row.transaction_type === 'transfer' ? 'transfer' : isDeposit(row.transaction_type) ? 'deposit' : 'withdrawal'
                    const sourceAccount = transfer ? data?.accounts.find((item) => item.id === transfer.from_account_id) : undefined
                    const destinationAccount = transfer ? data?.accounts.find((item) => item.id === transfer.to_account_id) : undefined
                    const isExpanded = expandedTransferGroups.has(id)
                    return (
                      <Fragment key={id}>
                      <tr className="transaction-row border-t border-slate-200 dark:border-slate-600">
                        <td className="whitespace-nowrap px-3 py-1 font-medium text-[13px] text-slate-800 dark:text-slate-200">{dateLabel(row.transaction_date)}</td>
                        <td className="whitespace-nowrap px-3 py-1 text-[12px] text-slate-600 dark:text-slate-300">
                          {kind === 'transfer' ? <p className="text-blue-700 dark:text-blue-300">{sourceAccount?.account_name ?? account?.account_name ?? '—'} → {destinationAccount?.account_name ?? '—'}</p> : <p>{account?.account_name ?? '—'}</p>}
                          {kind === 'deposit' && <p className="text-[10px] text-emerald-700 dark:text-emerald-300">From: External source (not recorded) · To: {account?.account_name ?? '—'}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1 text-[12px] text-slate-600 dark:text-slate-300">{category?.name ?? (kind === 'transfer' ? 'Account transfer' : '—')}</td>
                        <td className="whitespace-nowrap px-3 py-1 text-[12px] text-slate-600 dark:text-slate-300"><p className="font-medium">{row.description}</p>{row.reference_number && <p className="mt-0.5 text-[10px]">Ref: {row.reference_number}</p>}{kind === 'transfer' && <button type="button" onClick={() => toggleTransferDetails(id)} aria-expanded={isExpanded} className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 hover:underline dark:text-blue-300">{isExpanded ? 'Hide' : 'Show'} {entries.length} account entries {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>}</td>
                        <td className="whitespace-nowrap px-3 py-1 text-right text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">{amounts.deposit > 0 ? `+${currency(amounts.deposit)}` : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-1 text-right text-[12px] font-semibold text-rose-700 dark:text-rose-300">{amounts.withdrawal > 0 ? `−${currency(amounts.withdrawal)}` : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-1 text-right text-[12px] font-semibold text-slate-900 dark:text-slate-100">{currency(balances.get(relevantEntry.id) ?? data?.accounts.find((item) => item.id === relevantEntry.account_id)?.current_balance ?? 0)}</td>
                        <td className="px-3 py-1 text-right">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openEdit(row)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-200" aria-label={kind === 'transfer' ? 'Edit transfer' : 'Edit transaction'}>
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleDelete(row)} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-600 dark:hover:text-rose-200" aria-label={kind === 'transfer' ? 'Delete transfer' : 'Delete transaction'}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {kind === 'transfer' && isExpanded && (
                        <tr className="transaction-row bg-blue-50/60 dark:bg-blue-950/30">
                          <td colSpan={8} className="px-5 py-2">
                            <ul className="space-y-1.5" aria-label="Paired transfer account entries">
                              {entries.map((entry) => {
                                const entryAccount = data?.accounts.find((item) => item.id === entry.account_id)
                                const entryMovement = data ? getTransactionMovement(entry, data.transfers) : 0
                                return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-200">
                                  <span>{entryAccount?.account_name ?? 'Account'} · {entryMovement < 0 ? 'Outgoing' : 'Incoming'} · Entry {entry.id}</span>
                                  <span className={entryMovement < 0 ? 'font-semibold text-rose-700 dark:text-rose-300' : 'font-semibold text-emerald-700 dark:text-emerald-300'}>{entryMovement < 0 ? '−' : '+'}{currency(Math.abs(entryMovement))} · Balance {currency(balances.get(entry.id) ?? 0)}</span>
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
                <tfoot className="border-t border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
                  <tr>
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100" colSpan={4}>TOTAL</td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold text-emerald-700 dark:text-emerald-200">{currency(totalDeposits)}</td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold text-rose-700 dark:text-rose-200">{currency(totalWithdrawals)}</td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold text-slate-900 dark:text-slate-100">Net: {currency(totalDeposits - totalWithdrawals)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 md:hidden">
              {transactions.map(({ id, transaction: row, entries, transfer }) => {
                const amounts = data ? groupAmounts(entries, data.transfers, accountFilter) : { deposit: 0, withdrawal: 0 }
                const account = data?.accounts.find((item) => item.id === row.account_id)
                const sourceAccount = transfer ? data?.accounts.find((item) => item.id === transfer.from_account_id) : undefined
                const destinationAccount = transfer ? data?.accounts.find((item) => item.id === transfer.to_account_id) : undefined
                const kind = row.transaction_type === 'transfer' ? 'transfer' : isDeposit(row.transaction_type) ? 'deposit' : 'withdrawal'
                const isExpanded = expandedTransferGroups.has(id)
                return (
                  <article key={id} className="transaction-row bg-white px-3 py-2 dark:bg-slate-800">
                    <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.description}</p>
                      <p className="mt-0.5 text-[11px] text-slate-700 dark:text-slate-300">{dateLabel(row.transaction_date)} · {kind === 'transfer' ? `${sourceAccount?.account_name ?? account?.account_name ?? '—'} → ${destinationAccount?.account_name ?? '—'}` : account?.account_name ?? 'Account'}</p>
                      {kind === 'deposit' && <p className="text-[11px] text-emerald-700 dark:text-emerald-300">From: External source (not recorded) · To: {account?.account_name ?? '—'}</p>}
                    </div>
<div className="shrink-0 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {amounts.deposit > 0 && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Deposit +{currency(amounts.deposit)}</p>}
                        {amounts.withdrawal > 0 && <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Withdrawal −{currency(amounts.withdrawal)}</p>}
                      </div>
                      <button type="button" onClick={() => openEdit(row)} aria-label={`Edit ${kind === 'transfer' ? 'transfer' : row.description}`} className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950">
                        <Edit className="h-3.5 w-3.5" /> Edit
                      </button>
                      {kind === 'transfer' && <button type="button" onClick={() => toggleTransferDetails(id)} aria-expanded={isExpanded} className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {entries.length} entries
                      </button>}
                    </div>
                    </div>
                    {kind === 'transfer' && isExpanded && <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700" aria-label="Paired transfer account entries">
                      {entries.map((entry) => {
                        const entryAccount = data?.accounts.find((item) => item.id === entry.account_id)
                        const entryMovement = data ? getTransactionMovement(entry, data.transfers) : 0
                        return <li key={entry.id} className="flex justify-between gap-3 text-[11px] text-slate-700 dark:text-slate-300">
                          <span>{entryAccount?.account_name ?? 'Account'} · Entry {entry.id}</span>
                          <span className={`shrink-0 font-semibold ${entryMovement < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{entryMovement < 0 ? '−' : '+'}{currency(Math.abs(entryMovement))} · Balance {currency(balances.get(entry.id) ?? 0)}</span>
                        </li>
                      })}
                    </ul>}
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>

      {operation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm dark:bg-blue-950/75" onMouseDown={(event) => { if (event.target === event.currentTarget) setOperation(null) }}>
          <form onSubmit={submitTransaction} className="my-6 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/25 dark:border-slate-700 dark:bg-popover dark:shadow-black/50" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
            <div className={`flex items-start justify-between border-b px-5 py-4 ${operation === 'deposit' ? 'border-emerald-100 bg-gradient-to-r from-emerald-50 to-white dark:border-emerald-900/60 dark:from-emerald-950/50 dark:to-slate-900' : operation === 'withdrawal' ? 'border-rose-100 bg-gradient-to-r from-rose-50 to-white dark:border-rose-900/60 dark:from-rose-950/50 dark:to-slate-900' : 'border-blue-100 bg-gradient-to-r from-blue-50 to-white dark:border-blue-900/60 dark:from-blue-950/50 dark:to-slate-900'}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 inline-flex rounded-xl p-2 ${operation === 'deposit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300' : operation === 'withdrawal' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-300'}`}>
                  {operation === 'deposit' ? <ArrowDownLeft className="h-4 w-4" /> : operation === 'withdrawal' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />}
                </span>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${operation === 'deposit' ? 'text-emerald-700 dark:text-emerald-300' : operation === 'withdrawal' ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300'}`}>Banking operation</p>
                  <h2 id="transaction-form-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{operation === 'deposit' ? 'Deposit money' : operation === 'withdrawal' ? 'Withdrawal money' : 'Transfer money'}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Balances update automatically after saving.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOperation(null)} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 bg-white p-5 sm:grid-cols-2 dark:bg-slate-900">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{operation === 'transfer' ? 'From account' : 'Account'}
                 <select required value={form.account_id} onChange={(event) => setForm({ ...form, account_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]">
                  <option value="">Select account</option>
                  {data?.accounts.filter((item) => item.status === 'active' || item.id === editForm.account_id).map((account) => <option key={account.id} value={account.id}>{account.account_name} · {account.bank_name}</option>)}
                </select>
              </label>
              {operation === 'transfer' && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">To account
                   <select required value={form.to_account_id} onChange={(event) => setForm({ ...form, to_account_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]">
                    <option value="">Select destination</option>
                    {data?.accounts.filter((item) => item.status === 'active' && item.id !== form.account_id).map((account) => <option key={account.id} value={account.id}>{account.account_name} · {account.bank_name}</option>)}
                  </select>
                </label>
              )}
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Date
<input
  required
  type="date"
  value={form.transaction_date}
  onChange={(event) => setForm({ ...form, transaction_date: event.target.value })}
  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]"
/>
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Amount
                 <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
              </label>
              {operation !== 'transfer' && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category
                   <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]">
                    <option value="">Select category (optional)</option>
                    {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
              )}
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description
                 <input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={operation === 'deposit' ? 'e.g. Salary received' : operation === 'withdrawal' ? 'e.g. Utility payment' : 'e.g. Transfer to savings'} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Reference number <span className="font-normal text-slate-400 dark:text-slate-500">Optional</span>
                 <input value={form.reference_number} onChange={(event) => setForm({ ...form, reference_number: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
              </label>
              {operation !== 'transfer' && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">Notes <span className="font-normal text-slate-400 dark:text-slate-500">Optional</span>
                   <textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
                </label>
              )}
              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
            </div>
             <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/70">
               <button type="button" onClick={() => setOperation(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
               <button type="submit" disabled={saving} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${operation === 'deposit' ? 'bg-emerald-700 shadow-emerald-950/20 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500' : operation === 'withdrawal' ? 'bg-rose-700 shadow-rose-950/20 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500' : 'bg-blue-700 shadow-blue-950/20 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500'}`}>{saving ? 'Saving…' : operation === 'deposit' ? 'Save deposit' : operation === 'withdrawal' ? 'Save withdrawal' : 'Transfer money'}</button>
             </div>
          </form>
         </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm dark:bg-blue-950/75" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelEdit() }}>
          <form onSubmit={submitEdit} className="my-6 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/25 dark:border-slate-700 dark:bg-popover dark:shadow-black/50" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-form-title">
            <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Edit Transaction</p>
                <h2 id="edit-transaction-form-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">Editing: {editingTransaction.description}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Balances update automatically after saving.</p>
              </div>
              <button type="button" onClick={cancelEdit} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 bg-white p-5 sm:grid-cols-2 dark:bg-slate-900">
              {editingTransaction.transaction_type === 'transfer' ? (
                <>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    From account
                    <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {data?.accounts.find((item) => item.id === editingTransfer?.from_account_id)?.account_name ?? '—'}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    To account
                    <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {data?.accounts.find((item) => item.id === editingTransfer?.to_account_id)?.account_name ?? '—'}
                    </p>
                  </div>
                </>
              ) : (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Account
                  <select required value={editForm.account_id} onChange={(event) => setEditForm({ ...editForm, account_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]">
                    <option value="">Select account</option>
                    {data?.accounts.filter((item) => item.status === 'active').map((account) => <option key={account.id} value={account.id}>{account.account_name} · {account.bank_name}</option>)}
                  </select>
                </label>
              )}
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Date
                 <input required type="date" min={editingDateMinimum} value={editForm.transaction_date} onChange={(event) => setEditForm({ ...editForm, transaction_date: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]" />
              </label>
              {editingTransaction.transaction_type !== 'transfer' && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Type
                   <select value={editForm.transaction_type} onChange={(event) => setEditForm({ ...editForm, transaction_type: event.target.value as 'income' | 'expense' })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]">
                    <option value="income">Income / Deposit</option>
                    <option value="expense">Expense / Withdrawal</option>
                  </select>
                </label>
              )}
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Amount
                 <input required type="number" min="0.01" step="0.01" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: Number(event.target.value) })} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
              </label>
              {editingTransaction.transaction_type !== 'transfer' && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Category
                   <select value={editForm.category_id ?? ''} onChange={(event) => setEditForm({ ...editForm, category_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]">
                    <option value="">Select category (optional)</option>
                    {data?.categories.filter((item) => item.is_active && (editForm.transaction_type === 'income' ? item.category_type === 'income' : item.category_type === 'expense')).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
              )}
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description
                 <input required value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Reference number <span className="font-normal text-slate-400 dark:text-slate-500">Optional</span>
                 <input value={editForm.reference_number} onChange={(event) => setEditForm({ ...editForm, reference_number: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
              </label>
              {editingTransaction.transaction_type !== 'transfer' && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">Notes <span className="font-normal text-slate-400 dark:text-slate-500">Optional</span>
                   <textarea rows={2} value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950" />
                </label>
              )}
              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/70">
               <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
               <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-950/20 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
function WalletIcon() {
  return (
    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      <ArrowLeftRight className="h-5 w-5" />
    </div>
  );
}
