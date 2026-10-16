import type { Database } from './database.types'
import { getSupabase, isSupabaseConfigured } from './supabase'

export type AccountRecord = Database['public']['Tables']['accounts']['Row']
export type CategoryRecord = Database['public']['Tables']['categories']['Row']
export type TransactionRecord = Database['public']['Tables']['transactions']['Row']
export type TransferRecord = Database['public']['Tables']['transfers']['Row']

export interface TransactionDisplayGroup {
  id: string
  transaction: TransactionRecord
  entries: TransactionRecord[]
  transfer: TransferRecord | undefined
}

export function compareTransactionEntrySequence(left: TransactionRecord, right: TransactionRecord): number {
  return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id)
}

export function compareTransactionsChronologically(left: TransactionRecord, right: TransactionRecord): number {
  return left.transaction_date.localeCompare(right.transaction_date) || compareTransactionEntrySequence(left, right)
}

export function groupTransactionEntries(rows: TransactionRecord[], transfers: TransferRecord[]): TransactionDisplayGroup[] {
  const transfersById = new Map(transfers.map((transfer) => [transfer.id, transfer]))
  const entriesByGroup = new Map<string, TransactionRecord[]>()

  for (const row of rows) {
    const groupId = row.transaction_type === 'transfer' && row.transfer_id
      ? `transfer:${row.transfer_id}`
      : `transaction:${row.id}`
    const entries = entriesByGroup.get(groupId) ?? []
    entries.push(row)
    entriesByGroup.set(groupId, entries)
  }

  return [...entriesByGroup].map(([id, entries]) => {
    const orderedEntries = entries.sort(compareTransactionsChronologically)
    const transferId = orderedEntries[0].transfer_id
    const transfer = transferId ? transfersById.get(transferId) : undefined
    const transaction = transfer
      ? orderedEntries.find((entry) => entry.account_id === transfer.from_account_id) ?? orderedEntries[0]
      : orderedEntries[0]
    return { id, transaction, entries: orderedEntries, transfer }
  }).sort((left, right) => compareTransactionsChronologically(left.transaction, right.transaction))
}

export interface FinanceData {
  accounts: AccountRecord[]
  categories: CategoryRecord[]
  transactions: TransactionRecord[]
  transfers: TransferRecord[]
}

export interface NewAccount {
  account_name: string
  bank_name: string
  account_type: string
  opening_balance: number
  opening_balance_date: string
  account_number?: string | null
  status?: string
  notes?: string | null
}

export interface NewTransaction {
  account_id: string
  transaction_date: string
  description: string
  transaction_type: string
  category_id: string | null
  amount: number
  reference_number: string | null
  notes: string | null
}

export interface UpdateTransaction {
  account_id: string
  transaction_date: string
  description: string
  transaction_type: 'income' | 'expense'
  category_id: string | null
  amount: number
  reference_number: string | null
  notes: string | null
}

export interface NewTransfer {
  from_account_id: string
  to_account_id: string
  transfer_date: string
  description: string
  amount: number
  reference_number: string | null
}

export interface NewCategory {
  name: string
  category_type: 'income' | 'expense' | 'transfer' | 'broker'
  parent_id?: string | null
  is_active?: boolean
}

export interface FinanceBackup {
  format: 'dmyac-finance-backup'
  version: 1
  exported_at?: string
  accounts: Array<Pick<AccountRecord, 'id' | 'account_name' | 'bank_name' | 'account_number' | 'account_type' | 'opening_balance' | 'opening_balance_date' | 'status' | 'notes'>>
  categories: Array<Pick<CategoryRecord, 'id' | 'name' | 'category_type' | 'parent_id' | 'is_active'>>
  transactions: Array<Pick<TransactionRecord, 'id' | 'account_id' | 'transaction_date' | 'description' | 'transaction_type' | 'category_id' | 'amount' | 'reference_number' | 'transfer_id' | 'notes'>>
  transfers: Array<Pick<TransferRecord, 'id' | 'from_account_id' | 'to_account_id' | 'transfer_date' | 'description' | 'amount' | 'reference_number'>>
}

export interface FinanceBackupImportResult {
  imported: { accounts: number; categories: number; transactions: number; transfers: number }
  skipped: { accounts: number; categories: number; transactions: number; transfers: number }
  errors: string[]
}

const storageKey = 'flowpilot.finance.demo.v1'
const demoUserId = 'demo-user'
const today = new Date().toISOString().slice(0, 10)
const makeId = () => crypto.randomUUID()

const demoAccounts = (): AccountRecord[] => [
  { id: 'demo-ctzn', user_id: demoUserId, account_name: 'CTZN', bank_name: 'Citizens Bank', account_number: null, account_type: 'checking', opening_balance: 150000, opening_balance_date: '2026-04-30', current_balance: 150000, status: 'active', notes: null, created_at: today, updated_at: today },
  { id: 'demo-prime', user_id: demoUserId, account_name: 'Prime', bank_name: 'Prime Commercial Bank', account_number: null, account_type: 'savings', opening_balance: 132430, opening_balance_date: '2026-04-30', current_balance: 132430, status: 'active', notes: null, created_at: today, updated_at: today },
  { id: 'demo-cash', user_id: demoUserId, account_name: 'Cash', bank_name: 'Cash Account', account_number: null, account_type: 'cash', opening_balance: 125570, opening_balance_date: '2026-04-30', current_balance: 125570, status: 'active', notes: null, created_at: today, updated_at: today },
  { id: 'demo-broker', user_id: demoUserId, account_name: 'Broker Account', bank_name: 'Demat Account', account_number: null, account_type: 'broker', opening_balance: 68320, opening_balance_date: '2026-04-30', current_balance: 68320, status: 'active', notes: null, created_at: today, updated_at: today },
]

const demoCategories = (): CategoryRecord[] => [
  ...['Salary', 'Interest', 'Money Received', 'Refund', 'Cash Deposit'].map((name, index) => ({ id: `demo-deposit-${index}`, user_id: demoUserId, name, category_type: 'income', parent_id: null, is_active: true, created_at: today, updated_at: today })),
  ...['ATM Withdrawal', 'House Rent', 'Electricity', 'Mobile Recharge', 'Grocery', 'IPO', 'Bank Charge', 'Other Expense'].map((name, index) => ({ id: `demo-withdrawal-${index}`, user_id: demoUserId, name, category_type: 'expense', parent_id: null, is_active: true, created_at: today, updated_at: today })),
  { id: 'demo-transfer-category', user_id: demoUserId, name: 'Account Transfer', category_type: 'transfer', parent_id: null, is_active: true, created_at: today, updated_at: today },
]

const demoTransactions = (): TransactionRecord[] => [
  ['May 12', 'Money Received', 'Salary', 'income', 50000, 'demo-ctzn'],
  ['May 10', 'House Rent', 'House Rent', 'expense', 25000, 'demo-ctzn'],
  ['May 8', 'Transfer to Prime', 'Account Transfer', 'transfer', 50000, 'demo-ctzn'],
  ['May 5', 'ATM Withdrawal', 'ATM Withdrawal', 'expense', 10000, 'demo-ctzn'],
  ['May 2', 'Mobile Recharge', 'Mobile Recharge', 'expense', 1500, 'demo-cash'],
  ['Apr 28', 'Broker Withdrawal', 'Money Received', 'income', 30000, 'demo-broker'],
  ['Apr 25', 'Electricity Bill', 'Electricity', 'expense', 3200, 'demo-ctzn'],
].map(([date, description, category, type, amount, accountId], index) => {
  const [month, day] = (date as string).split(' ')
  const monthNumber = month === 'Apr' ? '04' : '05'
  const transactionType = type as TransactionRecord['transaction_type']
  const categoryRecord = demoCategories().find((item) => item.name === category)
  return {
    id: `demo-transaction-${index}`,
    user_id: demoUserId,
    account_id: accountId as string,
    transaction_date: `2026-${monthNumber}-${day.padStart(2, '0')}`,
    description: description as string,
    transaction_type: transactionType,
    category_id: categoryRecord?.id ?? null,
    subcategory_id: null,
    amount: amount as number,
    reference_number: null,
    transfer_id: transactionType === 'transfer' ? 'demo-transfer-1' : null,
    notes: null,
    attachment_url: null,
    created_at: today,
    updated_at: today,
  }
})

const demoTransfer: TransferRecord = {
  id: 'demo-transfer-1',
  user_id: demoUserId,
  from_account_id: 'demo-ctzn',
  to_account_id: 'demo-prime',
  amount: 50000,
  transfer_date: '2026-05-08',
  description: 'Transfer to Prime',
  reference_number: null,
  created_at: today,
}

const sampleData = (): FinanceData => {
  const accounts = demoAccounts()
  const categories = demoCategories()
  const transactions = demoTransactions()
  const prime = accounts.find((item) => item.id === 'demo-prime')
  if (prime) prime.current_balance += 50000
  const ctzn = accounts.find((item) => item.id === 'demo-ctzn')
  if (ctzn) ctzn.current_balance += 50000 - 25000 - 50000 - 10000 - 3200
  const cash = accounts.find((item) => item.id === 'demo-cash')
  if (cash) cash.current_balance -= 1500
  const broker = accounts.find((item) => item.id === 'demo-broker')
  if (broker) broker.current_balance += 30000
  transactions.push({
    ...transactions[2],
    id: 'demo-transaction-transfer-in',
    account_id: 'demo-prime',
  })
  return { accounts, categories, transactions, transfers: [demoTransfer] }
}

const readDemoData = (): FinanceData => {
  const saved = localStorage.getItem(storageKey)
  if (!saved) {
    const initial = sampleData()
    localStorage.setItem(storageKey, JSON.stringify(initial))
    return initial
  }

  let parsed: FinanceData
  try {
    parsed = JSON.parse(saved) as FinanceData
  } catch {
    throw new Error('Saved demo finance data could not be read. Clear the site data to reset demo mode.')
  }
  let needsSave = false
  if (!parsed.transfers) {
    parsed.transfers = []
    needsSave = true
  }
  const normalizeDate = (value: string) => {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value)
    if (!match) return value
    const normalized = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
    const date = new Date(`${normalized}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
      throw new Error(`Saved demo data contains an invalid date: ${value}`)
    }
    return normalized
  }
  parsed.transactions = parsed.transactions.map((transaction) => {
    const transactionDate = normalizeDate(transaction.transaction_date)
    if (transactionDate !== transaction.transaction_date) needsSave = true
    return { ...transaction, transaction_date: transactionDate }
  })
  parsed.transfers = parsed.transfers.map((transfer) => {
    const transferDate = normalizeDate(transfer.transfer_date)
    if (transferDate !== transfer.transfer_date) needsSave = true
    return { ...transfer, transfer_date: transferDate }
  })
  if (needsSave) saveDemoData(parsed)
  return parsed
}

const saveDemoData = (data: FinanceData) => localStorage.setItem(storageKey, JSON.stringify(data))

export async function loadFinanceData(userId: string, includeInactiveCategories = false): Promise<FinanceData> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    return { ...data, transactions: [...data.transactions].sort(compareTransactionsChronologically) }
  }

  const client = getSupabase()
  const categoriesQuery = includeInactiveCategories
    ? client.from('categories').select('*').eq('user_id', userId).order('name')
    : client.from('categories').select('*').eq('user_id', userId).eq('is_active', true).order('name')
  const [accountsResult, categoriesResult, transactionsResult, transfersResult] = await Promise.all([
    client.from('accounts').select('*').eq('user_id', userId).order('account_name'),
    categoriesQuery,
    client.from('transactions').select('*').eq('user_id', userId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    client.from('transfers').select('*').eq('user_id', userId),
  ])
  if (accountsResult.error) throw accountsResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (transactionsResult.error) throw transactionsResult.error
  if (transfersResult.error) throw transfersResult.error
  return { accounts: accountsResult.data, categories: categoriesResult.data, transactions: transactionsResult.data, transfers: transfersResult.data }
}

export async function loadAccounts(userId: string): Promise<AccountRecord[]> {
  if (!isSupabaseConfigured) return readDemoData().accounts

  const { data, error } = await getSupabase()
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('account_name')
  if (error) throw error
  return data
}

export async function createAccount(userId: string, input: NewAccount): Promise<string> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const newAccount: AccountRecord = {
      id: makeId(), user_id: userId, account_number: null, current_balance: input.opening_balance,
      status: 'active', notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...input,
    }
    data.accounts.push(newAccount)
    saveDemoData(data)
    return newAccount.id
  }
  const { data, error } = await getSupabase().from('accounts').insert({ ...input, user_id: userId, current_balance: input.opening_balance }).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateAccount(userId: string, accountId: string, input: Partial<NewAccount>): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const account = data.accounts.find((item) => item.id === accountId && item.user_id === userId)
    if (!account) throw new Error('Account not found.')
    Object.assign(account, input, { updated_at: new Date().toISOString() })
    saveDemoData(data)
    return
  }
  const { error } = await getSupabase().from('accounts').update(input).eq('id', accountId).eq('user_id', userId)
  if (error) throw error
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    if (data.transactions.some((transaction) => transaction.account_id === accountId)) {
      throw new Error('This account has transactions and cannot be deleted. Keep it in your records or mark it closed.')
    }
    data.accounts = data.accounts.filter((item) => item.id !== accountId || item.user_id !== userId)
    saveDemoData(data)
    return
  }
  const { error } = await getSupabase().from('accounts').delete().eq('id', accountId).eq('user_id', userId)
  if (error) throw error
}

export async function createCategory(userId: string, input: NewCategory): Promise<string> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    if (data.categories.some((item) => item.user_id === userId && item.category_type === input.category_type && item.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new Error('A category with this name already exists.')
    }
    const category: CategoryRecord = { id: makeId(), user_id: userId, parent_id: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...input, name: input.name.trim() }
    data.categories.push(category)
    saveDemoData(data)
    return category.id
  }
  const { data, error } = await getSupabase().from('categories').insert({ ...input, user_id: userId }).select('id').single()
  if (error) throw error
  return data.id
}

export async function updateCategory(userId: string, categoryId: string, input: NewCategory): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const category = data.categories.find((item) => item.id === categoryId && item.user_id === userId)
    if (!category) throw new Error('Category not found.')
    if (data.categories.some((item) => item.id !== categoryId && item.user_id === userId && item.category_type === input.category_type && item.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new Error('A category with this name already exists.')
    }
    Object.assign(category, input, { name: input.name.trim(), updated_at: new Date().toISOString() })
    saveDemoData(data)
    return
  }
  const { error } = await getSupabase().from('categories').update(input).eq('id', categoryId).eq('user_id', userId)
  if (error) throw error
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    data.categories = data.categories.filter((item) => item.id !== categoryId || item.user_id !== userId)
    data.transactions = data.transactions.map((transaction) => transaction.category_id === categoryId ? { ...transaction, category_id: null } : transaction)
    saveDemoData(data)
    return
  }
  const { error } = await getSupabase().from('categories').delete().eq('id', categoryId).eq('user_id', userId)
  if (error) throw error
}

export async function createTransaction(userId: string, input: NewTransaction): Promise<string> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const account = data.accounts.find((item) => item.id === input.account_id && item.user_id === userId)
    if (!account) throw new Error('Select a valid account.')
    if (input.transaction_date < account.opening_balance_date) throw new Error('Transaction date cannot predate the account opening balance date.')
    const transaction: TransactionRecord = {
      id: makeId(), user_id: userId, subcategory_id: null, transfer_id: null, attachment_url: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...input,
    }
    data.transactions.push(transaction)
    recalculateDemoBalances(data)
    saveDemoData(data)
    return transaction.id
  }
  const { data, error } = await getSupabase().from('transactions').insert({ ...input, user_id: userId }).select('id').single()
  if (error) throw error
  return data.id
}

export async function createTransfer(userId: string, input: NewTransfer): Promise<string> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    if (input.from_account_id === input.to_account_id) throw new Error('Choose two different accounts.')
    const fromAccount = data.accounts.find((account) => account.id === input.from_account_id && account.user_id === userId && account.status === 'active')
    const toAccount = data.accounts.find((account) => account.id === input.to_account_id && account.user_id === userId && account.status === 'active')
    if (!fromAccount || !toAccount) throw new Error('Select active source and destination accounts.')
    if (input.transfer_date < fromAccount.opening_balance_date || input.transfer_date < toAccount.opening_balance_date) throw new Error('Transfer date cannot predate either account opening date.')
    const transferId = makeId()
    const transfer: TransferRecord = {
      id: transferId,
      user_id: userId,
      from_account_id: input.from_account_id,
      to_account_id: input.to_account_id,
      amount: input.amount,
      transfer_date: input.transfer_date,
      description: input.description,
      reference_number: input.reference_number,
      created_at: new Date().toISOString(),
    }
    const base = {
      user_id: userId, transaction_date: input.transfer_date, transaction_type: 'transfer',
      category_id: null, subcategory_id: null, amount: input.amount, reference_number: input.reference_number,
      transfer_id: transferId, notes: null, attachment_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    data.transactions.push(
      { ...base, id: makeId(), account_id: input.from_account_id, description: input.description },
      { ...base, id: makeId(), account_id: input.to_account_id, description: input.description },
    )
    data.transfers.push(transfer)
    recalculateDemoBalances(data)
    saveDemoData(data)
    return transferId
  }
  const { data, error } = await getSupabase().rpc('create_account_transfer', {
    p_from_account_id: input.from_account_id,
    p_to_account_id: input.to_account_id,
    p_transfer_date: input.transfer_date,
    p_description: input.description,
    p_amount: input.amount,
    p_reference_number: input.reference_number,
  })
  if (error) throw error
  return data
}

export async function importFinanceBackup(userId: string, backup: FinanceBackup): Promise<FinanceBackupImportResult> {
  const current = await loadFinanceData(userId, true)
  const result: FinanceBackupImportResult = {
    imported: { accounts: 0, categories: 0, transactions: 0, transfers: 0 },
    skipped: { accounts: 0, categories: 0, transactions: 0, transfers: 0 },
    errors: [],
  }
  const accountIds = new Map<string, string>()
  const categoryIds = new Map<string, string>()
  const createdCategories = new Set<string>()
  const accountKey = (name: string, bank: string, type: string, number: string | null) =>
    `${name.trim().toLowerCase()}|${bank.trim().toLowerCase()}|${type.trim().toLowerCase()}|${number?.trim() ?? ''}`
  const categoryKey = (name: string, type: string) => `${name.trim().toLowerCase()}|${type.trim().toLowerCase()}`
  const transferKey = (from: string, to: string, date: string, description: string, amount: number, reference: string | null) =>
    `${from}|${to}|${date}|${description.trim().toLowerCase()}|${amount}|${reference ?? ''}`
  const transactionKey = (account: string, date: string, description: string, type: string, amount: number, reference: string | null, category: string | null, notes: string | null) =>
    `${account}|${date}|${description.trim().toLowerCase()}|${type}|${amount}|${reference ?? ''}|${category ?? ''}|${notes?.trim().toLowerCase() ?? ''}`
  const accountKeys = new Map(current.accounts.map((item) => [accountKey(item.account_name, item.bank_name, item.account_type, item.account_number), item.id]))
  const categoryKeys = new Map(current.categories.map((item) => [categoryKey(item.name, item.category_type), item.id]))
  const transferKeys = new Set(current.transfers.map((item) => transferKey(item.from_account_id, item.to_account_id, item.transfer_date, item.description, item.amount, item.reference_number)))
  const transactionKeys = new Set(current.transactions
    .filter((item) => item.transaction_type !== 'transfer')
    .map((item) => transactionKey(item.account_id, item.transaction_date, item.description, item.transaction_type, item.amount, item.reference_number, item.category_id, item.notes)))

  for (const account of backup.accounts) {
    try {
      const key = accountKey(account.account_name, account.bank_name, account.account_type, account.account_number)
      const existingId = accountKeys.get(key)
      if (existingId) {
        accountIds.set(account.id, existingId)
        result.skipped.accounts += 1
        continue
      }
      const id = await createAccount(userId, {
        account_name: account.account_name,
        bank_name: account.bank_name,
        account_type: account.account_type,
        opening_balance: account.opening_balance,
        opening_balance_date: account.opening_balance_date,
        account_number: account.account_number,
        status: account.status,
        notes: account.notes,
      })
      accountIds.set(account.id, id)
      accountKeys.set(key, id)
      result.imported.accounts += 1
    } catch (error) {
      result.errors.push(`Account "${account.account_name}": ${error instanceof Error ? error.message : 'Unable to import account.'}`)
    }
  }

  for (const category of backup.categories) {
    try {
      const key = categoryKey(category.name, category.category_type)
      const existingId = categoryKeys.get(key)
      if (existingId) {
        categoryIds.set(category.id, existingId)
        result.skipped.categories += 1
        continue
      }
      if (!['income', 'expense', 'transfer', 'broker'].includes(category.category_type)) {
        throw new Error(`Unsupported category type "${category.category_type}".`)
      }
      const id = await createCategory(userId, {
        name: category.name,
        category_type: category.category_type as NewCategory['category_type'],
        parent_id: null,
        is_active: category.is_active,
      })
      categoryIds.set(category.id, id)
      categoryKeys.set(key, id)
      createdCategories.add(category.id)
      result.imported.categories += 1
    } catch (error) {
      result.errors.push(`Category "${category.name}": ${error instanceof Error ? error.message : 'Unable to import category.'}`)
    }
  }

  for (const category of backup.categories) {
    if (!createdCategories.has(category.id) || !category.parent_id) continue
    const categoryId = categoryIds.get(category.id)
    const parentId = categoryIds.get(category.parent_id)
    if (!categoryId || !parentId) {
      result.errors.push(`Category "${category.name}": its parent category could not be matched.`)
      continue
    }
    try {
      await updateCategory(userId, categoryId, {
        name: category.name,
        category_type: category.category_type as NewCategory['category_type'],
        parent_id: parentId,
        is_active: category.is_active,
      })
    } catch (error) {
      result.errors.push(`Category "${category.name}": ${error instanceof Error ? error.message : 'Unable to restore category parent.'}`)
    }
  }

  for (const transfer of backup.transfers) {
    try {
      const fromAccountId = accountIds.get(transfer.from_account_id)
      const toAccountId = accountIds.get(transfer.to_account_id)
      if (!fromAccountId || !toAccountId) throw new Error('Source or destination account could not be matched.')
      const key = transferKey(fromAccountId, toAccountId, transfer.transfer_date, transfer.description, transfer.amount, transfer.reference_number)
      if (transferKeys.has(key)) {
        result.skipped.transfers += 1
        continue
      }
      await createTransfer(userId, {
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        transfer_date: transfer.transfer_date,
        description: transfer.description,
        amount: transfer.amount,
        reference_number: transfer.reference_number,
      })
      transferKeys.add(key)
      result.imported.transfers += 1
    } catch (error) {
      result.errors.push(`Transfer "${transfer.description}": ${error instanceof Error ? error.message : 'Unable to import transfer.'}`)
    }
  }

  for (const transaction of backup.transactions) {
    if (transaction.transaction_type === 'transfer') continue
    try {
      const accountId = accountIds.get(transaction.account_id)
      if (!accountId) throw new Error('The transaction account could not be matched.')
      const categoryId = transaction.category_id ? categoryIds.get(transaction.category_id) ?? null : null
      if (transaction.category_id && !categoryId) throw new Error('The transaction category could not be matched.')
      const key = transactionKey(accountId, transaction.transaction_date, transaction.description, transaction.transaction_type, transaction.amount, transaction.reference_number, categoryId, transaction.notes)
      if (transactionKeys.has(key)) {
        result.skipped.transactions += 1
        continue
      }
      await createTransaction(userId, {
        account_id: accountId,
        transaction_date: transaction.transaction_date,
        description: transaction.description,
        transaction_type: transaction.transaction_type,
        category_id: categoryId,
        amount: transaction.amount,
        reference_number: transaction.reference_number,
        notes: transaction.notes,
      })
      transactionKeys.add(key)
      result.imported.transactions += 1
    } catch (error) {
      result.errors.push(`Transaction "${transaction.description}": ${error instanceof Error ? error.message : 'Unable to import transaction.'}`)
    }
  }

  return result
}

export function getTransactionMovement(transaction: TransactionRecord, transfers: TransferRecord[]): number {
  if (transaction.transaction_type === 'transfer') {
    const transfer = transfers.find((item) => item.id === transaction.transfer_id)
    if (!transfer) return 0
    return transaction.account_id === transfer.from_account_id ? -transaction.amount : transaction.amount
  }
  if (['income', 'interest', 'cash_deposit', 'broker_withdrawal'].includes(transaction.transaction_type)) return transaction.amount
  return -transaction.amount
}

export function calculateOpeningBalance(data: FinanceData, startDate?: string, accountId?: string): number {
  return data.accounts
    .filter((account) => !accountId || account.id === accountId)
    .reduce((total, account) => {
      if (startDate && account.opening_balance_date > startDate) return total
      const movementBeforeStart = startDate
        ? data.transactions
          .filter((transaction) => transaction.account_id === account.id
            && transaction.transaction_date >= account.opening_balance_date
            && transaction.transaction_date < startDate)
          .reduce((balance, transaction) => balance + getTransactionMovement(transaction, data.transfers), 0)
        : 0
      return total + account.opening_balance + movementBeforeStart
    }, 0)
}

export function calculateBalanceAsOf(data: FinanceData, endDate: string, accountId?: string): number {
  return data.accounts
    .filter((account) => (!accountId || account.id === accountId) && account.opening_balance_date <= endDate)
    .reduce((total, account) => {
      const movement = data.transactions
        .filter((transaction) => transaction.account_id === account.id
          && transaction.transaction_date >= account.opening_balance_date
          && transaction.transaction_date <= endDate)
        .reduce((balance, transaction) => balance + getTransactionMovement(transaction, data.transfers), 0)
      return total + account.opening_balance + movement
    }, 0)
}

function recalculateDemoBalances(data: FinanceData) {
  for (const account of data.accounts) {
    account.current_balance = account.opening_balance + data.transactions
      .filter((transaction) => transaction.account_id === account.id && transaction.transaction_date >= account.opening_balance_date)
      .reduce((balance, transaction) => balance + getTransactionMovement(transaction, data.transfers), 0)
  }
}

export function getDemoFinanceSnapshot(): FinanceData {
  return readDemoData()
}

export function saveDemoFinanceSnapshot(data: FinanceData) {
  saveDemoData(data)
}

export async function updateTransaction(userId: string, transactionId: string, input: UpdateTransaction): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const transactionIndex = data.transactions.findIndex((item) => item.id === transactionId && item.user_id === userId)
    if (transactionIndex === -1) throw new Error('Transaction not found.')
    const transaction = data.transactions[transactionIndex]
    const account = data.accounts.find((item) => item.id === input.account_id && item.user_id === userId)
    if (!account) throw new Error('Select a valid account.')
    if (transaction.transaction_type === 'transfer') throw new Error('Use the transfer editor to update a transfer.')
    if (input.transaction_date < account.opening_balance_date) throw new Error('Transaction date cannot predate the account opening balance date.')
    
    const updatedTransaction = { ...transaction, ...input, updated_at: new Date().toISOString() }
    data.transactions[transactionIndex] = updatedTransaction
    recalculateDemoBalances(data)
    saveDemoData(data)
    return
  }
  const { error } = await getSupabase().from('transactions').update(input).eq('id', transactionId).eq('user_id', userId)
  if (error) throw error
}

export async function updateTransfer(userId: string, transferId: string, input: Omit<NewTransfer, 'from_account_id' | 'to_account_id'>): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const transferIndex = data.transfers.findIndex((item) => item.id === transferId && item.user_id === userId)
    if (transferIndex === -1) throw new Error('Transfer not found.')
    const transfer = data.transfers[transferIndex]
    const fromAccount = data.accounts.find((item) => item.id === transfer.from_account_id && item.user_id === userId && item.status === 'active')
    const toAccount = data.accounts.find((item) => item.id === transfer.to_account_id && item.user_id === userId && item.status === 'active')
    if (!fromAccount || !toAccount) throw new Error('Source or destination account not found or inactive.')
    if (input.transfer_date < fromAccount.opening_balance_date || input.transfer_date < toAccount.opening_balance_date) throw new Error('Transfer date cannot predate either account opening date.')
    
    const updatedTransfer = { ...transfer, ...input }
    data.transfers[transferIndex] = updatedTransfer
    
    // Update linked transactions
    const linkedTransactions = data.transactions.filter((t) => t.transfer_id === transferId)
    for (const tx of linkedTransactions) {
      tx.transaction_date = input.transfer_date
      tx.description = input.description
      tx.amount = input.amount
      tx.reference_number = input.reference_number
      tx.updated_at = new Date().toISOString()
      if (tx.account_id === transfer.to_account_id) {
        tx.account_id = transfer.to_account_id
      }
    }
    
    recalculateDemoBalances(data)
    saveDemoData(data)
    return
  }
  const { error } = await getSupabase().rpc('update_account_transfer', {
    p_transfer_id: transferId,
    p_transfer_date: input.transfer_date,
    p_description: input.description,
    p_amount: input.amount,
    p_reference_number: input.reference_number,
  })
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new Error('Transfer editing is not enabled in the database yet. Apply the 20261012000000_update_account_transfer.sql migration, then retry.')
  }
  if (error) throw error
}

export async function deleteTransfer(userId: string, transferId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const transferIndex = data.transfers.findIndex((item) => item.id === transferId && item.user_id === userId)
    if (transferIndex === -1) throw new Error('Transfer not found.')
    data.transfers.splice(transferIndex, 1)
    data.transactions = data.transactions.filter((transaction) => transaction.transfer_id !== transferId)
    recalculateDemoBalances(data)
    saveDemoData(data)
    return
  }
  const { error } = await getSupabase().rpc('delete_account_transfer', { p_transfer_id: transferId })
  if (error) throw error
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const data = readDemoData()
    const transactionIndex = data.transactions.findIndex((item) => item.id === transactionId && item.user_id === userId)
    if (transactionIndex === -1) throw new Error('Transaction not found.')
    const transaction = data.transactions[transactionIndex]
    
    // Transfers are managed as a pair; delete both ledger entries and the transfer.
    if (transaction.transaction_type === 'transfer' && transaction.transfer_id) {
      data.transfers = data.transfers.filter((t) => t.id !== transaction.transfer_id)
      data.transactions = data.transactions.filter((t) => t.transfer_id !== transaction.transfer_id)
    } else {
      data.transactions.splice(transactionIndex, 1)
    }
    
    recalculateDemoBalances(data)
    saveDemoData(data)
    return
  }
  // First check if it's a transfer
  const { data: tx, error: txError } = await getSupabase().from('transactions').select('*').eq('id', transactionId).eq('user_id', userId).single()
  if (txError) throw txError
  
  if (tx.transaction_type === 'transfer' && tx.transfer_id) {
    await deleteTransfer(userId, tx.transfer_id)
  } else {
    const { error } = await getSupabase().from('transactions').delete().eq('id', transactionId).eq('user_id', userId)
    if (error) throw error
  }
}
