import { useMemo, useState, type ChangeEvent } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, UploadCloud, HelpCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { createTransaction, importFinanceBackup, loadFinanceData, type FinanceBackup, type FinanceData } from '../lib/financeData'

type Mapping = { date: string; description: string; amount: string; deposit: string; withdrawal: string; type: string; category: string; reference: string }
type PreviewRow = { line: number; values: unknown[]; valid: boolean; reason: string; transaction?: { transaction_date: string; description: string; amount: number; transaction_type: 'income' | 'expense'; category_id: string | null; reference_number: string | null } }

const nextDate = (date: string) => {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}
const statementTransactionKey = (transaction: {
  account_id: string
  transaction_date: string
  description: string
  amount: number
  transaction_type: string
  reference_number: string | null
}) => [
  transaction.account_id,
  transaction.transaction_date,
  transaction.transaction_type,
  transaction.amount,
  transaction.reference_number?.trim().toLowerCase() ?? '',
  transaction.description.trim().toLowerCase(),
].join('|')

const mapHeader = (headers: string[], aliases: string[]) => headers.find((header) => aliases.some((alias) => header.toLowerCase().includes(alias))) ?? ''
const normalizeDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) return null
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  if (typeof value !== 'string' || !value.trim()) return null
  const input = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/.exec(input)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}
const parseMoney = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.trim().replace(/^(?:rs\.?|npr)\s*/i, '').replace(/[₹$€£,\s]/g, '').replace(/^\((.*)\)$/, '-$1')
  const amount = Number(cleaned)
  return Number.isFinite(amount) ? amount : null
}
const parseType = (value: unknown, amount: number): 'income' | 'expense' => {
  const text = String(value ?? '').toLowerCase()
  if (['deposit', 'credit', 'income', 'received', 'cr'].some((type) => text.includes(type))) return 'income'
  if (['withdrawal', 'debit', 'expense', 'paid', 'dr'].some((type) => text.includes(type))) return 'expense'
  return amount < 0 ? 'expense' : 'income'
}
const errorText = (error: unknown) => error instanceof Error ? error.message : 'An unexpected error occurred.'
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nullableCsvText = (value: unknown) => value === null || value === undefined || value === '' ? null : String(value)
const csvNumber = (value: unknown) => parseMoney(value)

const getAliasesForKey = (key: string): string[] => {
  const aliases: Record<string, string[]> = {
    date: ['date', 'time', 'tran', 'value date', 'posting date'],
    description: ['description', 'details', 'narration', 'particular', 'memo', 'remarks'],
    amount: ['amount', 'value', 'amt', 'transaction amount'],
    deposit: ['deposit', 'credit', 'deposits', 'credits', 'cr'],
    withdrawal: ['withdrawal', 'debit', 'withdrawals', 'debits', 'dr'],
    type: ['type', 'debit/credit', 'dr/cr', 'debit credit', 'transaction type', 'd/c'],
    category: ['category', 'cat', 'category name', 'expense category'],
    reference: ['reference', 'ref no', 'ref', 'cheque', 'cheque no', 'transaction id', 'txn id', 'utr'],
  }
  return aliases[key] ?? []
}

function backupRecordFromCsv(type: string, row: Record<string, unknown>) {
  if (type === 'account') {
    const openingBalance = csvNumber(row.opening_balance)
    if (openingBalance === null) throw new Error('CSV account has an invalid opening balance.')
    return {
      id: String(row.id ?? ''),
      account_name: String(row.account_name ?? ''),
      bank_name: String(row.bank_name ?? ''),
      account_number: nullableCsvText(row.account_number),
      account_type: String(row.account_type ?? ''),
      opening_balance: openingBalance,
      opening_balance_date: String(row.opening_balance_date ?? ''),
      status: String(row.status ?? ''),
      notes: nullableCsvText(row.notes),
    }
  }
  if (type === 'category') {
    const active = row.is_active === true || ['true', '1', 'yes'].includes(String(row.is_active ?? '').toLowerCase())
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      category_type: String(row.category_type ?? ''),
      parent_id: nullableCsvText(row.parent_id),
      is_active: active,
    }
  }
  if (type === 'transaction') {
    const amount = csvNumber(row.amount)
    if (amount === null) throw new Error('CSV transaction has an invalid amount.')
    return {
      id: String(row.id ?? ''),
      account_id: String(row.account_id ?? ''),
      transaction_date: String(row.transaction_date ?? ''),
      description: String(row.description ?? ''),
      transaction_type: String(row.transaction_type ?? ''),
      category_id: nullableCsvText(row.category_id),
      amount,
      reference_number: nullableCsvText(row.reference_number),
      transfer_id: nullableCsvText(row.transfer_id),
      notes: nullableCsvText(row.notes),
    }
  }
  if (type === 'transfer') {
    const amount = csvNumber(row.amount)
    if (amount === null) throw new Error('CSV transfer has an invalid amount.')
    return {
      id: String(row.id ?? ''),
      from_account_id: String(row.from_account_id ?? ''),
      to_account_id: String(row.to_account_id ?? ''),
      transfer_date: String(row.transfer_date ?? ''),
      description: String(row.description ?? ''),
      amount,
      reference_number: nullableCsvText(row.reference_number),
    }
  }
  throw new Error(`Unknown backup record type "${type}".`)
}

function parseFinanceBackup(value: unknown): FinanceBackup {
  if (!isRecord(value) || value.format !== 'dmyac-finance-backup' || value.version !== 1) {
    throw new Error('This is not a supported DMyAc finance backup (version 1).')
  }
  for (const key of ['accounts', 'categories', 'transactions', 'transfers']) {
    if (!Array.isArray(value[key]) || !value[key].every(isRecord)) throw new Error(`The backup has an invalid "${key}" collection.`)
  }
  const accounts = value.accounts as Record<string, unknown>[]
  const categories = value.categories as Record<string, unknown>[]
  const transactions = value.transactions as Record<string, unknown>[]
  const transfers = value.transfers as Record<string, unknown>[]
  const isText = (row: Record<string, unknown>, key: string) => typeof row[key] === 'string' && row[key].trim().length > 0
  const isNullableText = (row: Record<string, unknown>, key: string) => row[key] === null || typeof row[key] === 'string'
  const isDate = (row: Record<string, unknown>, key: string) => {
    if (!isText(row, key) || !/^\d{4}-\d{2}-\d{2}$/.test(row[key] as string)) return false
    const [year, month, day] = (row[key] as string).split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
  }
  const isAmount = (row: Record<string, unknown>) => typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount > 0
  if (!accounts.every((row) => ['id', 'account_name', 'bank_name', 'account_type', 'status'].every((key) => isText(row, key))
    && isDate(row, 'opening_balance_date') && isNullableText(row, 'account_number') && isNullableText(row, 'notes')
    && typeof row.opening_balance === 'number' && Number.isFinite(row.opening_balance))) throw new Error('The backup contains an invalid account record.')
  if (!categories.every((row) => ['id', 'name', 'category_type'].every((key) => isText(row, key))
    && (row.parent_id === null || typeof row.parent_id === 'string') && typeof row.is_active === 'boolean')) throw new Error('The backup contains an invalid category record.')
  if (!transactions.every((row) => ['id', 'account_id', 'description', 'transaction_type'].every((key) => isText(row, key))
    && isDate(row, 'transaction_date') && isNullableText(row, 'category_id') && isNullableText(row, 'reference_number')
    && isNullableText(row, 'transfer_id') && isNullableText(row, 'notes') && isAmount(row))) {
    throw new Error('The backup contains an invalid transaction record.')
  }
  if (!transfers.every((row) => ['id', 'from_account_id', 'to_account_id', 'description'].every((key) => isText(row, key))
    && isDate(row, 'transfer_date') && isNullableText(row, 'reference_number') && isAmount(row))) {
    throw new Error('The backup contains an invalid transfer record.')
  }
  const accountIds = new Set(accounts.map((row) => row.id))
  const categoryIds = new Set(categories.map((row) => row.id))
  const transferIds = new Set(transfers.map((row) => row.id))
  if (!transactions.every((row) => accountIds.has(row.account_id) && (row.category_id === null || categoryIds.has(row.category_id)))) {
    throw new Error('The backup contains transactions that refer to missing accounts or categories.')
  }
  if (!categories.every((row) => row.parent_id === null || categoryIds.has(row.parent_id))) {
    throw new Error('The backup contains categories that refer to missing parent categories.')
  }
  if (!transfers.every((row) => accountIds.has(row.from_account_id) && accountIds.has(row.to_account_id))) {
    throw new Error('The backup contains transfers that refer to missing accounts.')
  }
  if (!transactions.every((row) => row.transfer_id === null || transferIds.has(row.transfer_id))) {
    throw new Error('The backup contains transaction entries that refer to missing transfers.')
  }
  return {
    format: 'dmyac-finance-backup',
    version: 1,
    exported_at: typeof value.exported_at === 'string' ? value.exported_at : undefined,
    accounts: accounts as unknown as FinanceBackup['accounts'],
    categories: categories as unknown as FinanceBackup['categories'],
    transactions: transactions as unknown as FinanceBackup['transactions'],
    transfers: transfers as unknown as FinanceBackup['transfers'],
  }
}

export const ExcelImportPage = () => {
  const { user } = useAuth()
  const [fileName, setFileName] = useState('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [sheetName, setSheetName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<unknown[][]>([])
  const [finance, setFinance] = useState<FinanceData | null>(null)
  const [mapping, setMapping] = useState<Mapping>({ date: '', description: '', amount: '', deposit: '', withdrawal: '', type: '', category: '', reference: '' })
  const [accountId, setAccountId] = useState('')
  const [importStartDate, setImportStartDate] = useState('')
  const [importEndDate, setImportEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [backup, setBackup] = useState<FinanceBackup | null>(null)

  const getSampleValues = (header: string, count: number): string[] => {
    const colIndex = headers.indexOf(header)
    if (colIndex === -1) return []
    const samples: string[] = []
    for (let i = 0; i < rows.length && samples.length < count; i++) {
      const val = rows[i][colIndex]
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        samples.push(String(val).trim())
      }
    }
    return samples
  }

  const loadFinance = async () => {
    if (!user) return
    try {
      setFinance(await loadFinanceData(user.id))
    } catch (loadError) {
      setError(errorText(loadError))
    }
  }

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    setSummary('')
    setBackup(null)
    setHeaders([])
    setRows([])
    setSheetNames([])
    setSheetName('')
    setImportStartDate('')
    setImportEndDate('')
    try {
      let workbook: XLSX.WorkBook
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsedJson: unknown = JSON.parse(await file.text())
        if (isRecord(parsedJson) && parsedJson.format === 'dmyac-finance-backup') {
          const parsedBackup = parseFinanceBackup(parsedJson)
          setFileName(file.name)
          setBackup(parsedBackup)
          return
        }
        if (Array.isArray(parsedJson) && parsedJson.every(isRecord)) {
          workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(parsedJson), 'Transactions')
        } else {
          throw new Error('JSON import expects a DMyAc backup or an array of transaction records.')
        }
      } else {
        workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      }
      if (!workbook.SheetNames.length) throw new Error('The workbook does not contain any sheets.')
      const requiredBackupSheets = ['Accounts', 'Categories', 'Transactions', 'Transfers']
      if (requiredBackupSheets.every((name) => workbook.SheetNames.includes(name))) {
        const rowsForSheet = (name: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: null, raw: true })
        const parsedBackup = parseFinanceBackup({
          format: 'dmyac-finance-backup',
          version: 1,
          accounts: rowsForSheet('Accounts'),
          categories: rowsForSheet('Categories'),
          transactions: rowsForSheet('Transactions'),
          transfers: rowsForSheet('Transfers'),
        })
        setFileName(file.name)
        setBackup(parsedBackup)
        return
      }
      if (file.name.toLowerCase().endsWith('.csv')) {
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: true })
        const headings = (matrix[0] ?? []).map((item) => String(item).trim().toLowerCase())
        const recordTypeIndex = headings.indexOf('record_type')
        const payloadIndex = headings.indexOf('payload')
        if (recordTypeIndex !== -1) {
          const collections: Record<string, unknown[]> = { account: [], category: [], transaction: [], transfer: [] }
          matrix.slice(1).forEach((line, index) => {
            const type = String(line[recordTypeIndex] ?? '').trim().toLowerCase()
            const collection = collections[type]
            if (!collection) throw new Error(`CSV row ${index + 2} has an unknown record type "${type}".`)
            if (payloadIndex !== -1) {
              try {
                collection.push(JSON.parse(String(line[payloadIndex] ?? '')) as unknown)
              } catch {
                throw new Error(`CSV row ${index + 2} contains invalid JSON in its payload.`)
              }
            } else {
              const record = Object.fromEntries(headings.map((header, columnIndex) => [header, line[columnIndex] ?? '']))
              try {
                collection.push(backupRecordFromCsv(type, record))
              } catch (csvError) {
                throw new Error(`CSV row ${index + 2}: ${errorText(csvError)}`)
              }
            }
          })
          setFileName(file.name)
          setBackup(parseFinanceBackup({
            format: 'dmyac-finance-backup',
            version: 1,
            accounts: collections.account,
            categories: collections.category,
            transactions: collections.transaction,
            transfers: collections.transfer,
          }))
          return
        }
      }
      setFileName(file.name)
      setSheetNames(workbook.SheetNames)
      const firstSheet = workbook.SheetNames[0]
      setSheetName(firstSheet)
      const data = await loadFinanceData(user?.id ?? 'demo-user')
      setFinance(data)
      const firstAccount = data.accounts[0]
      setAccountId(firstAccount?.id ?? '')
      const latestDate = firstAccount && data.transactions
        .filter((transaction) => transaction.account_id === firstAccount.id)
        .reduce((latest, transaction) => transaction.transaction_date > latest ? transaction.transaction_date : latest, '')
      setImportStartDate(latestDate ? nextDate(latestDate) : firstAccount?.opening_balance_date ?? '')
      loadSheet(workbook, firstSheet)
    } catch (fileError) {
      setError(errorText(fileError))
      setFileName('')
      setSheetNames([])
      setHeaders([])
      setRows([])
      setBackup(null)
    } finally {
      setLoading(false)
    }
  }

  const loadSheet = (workbook: XLSX.WorkBook, selected: string) => {
    const sheet = workbook.Sheets[selected]
    if (!sheet) throw new Error(`The selected sheet "${selected}" was not found.`)
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true })
    const firstRow = matrix[0] ?? []
    let nextHeaders = firstRow.map((value, index) => String(value || `Column ${index + 1}`))
    let nextRows = matrix.slice(1).filter((row) => row.some((value) => String(value ?? '').trim() !== ''))
    const hasAmount = nextHeaders.some((header) => ['amount', 'value'].some((alias) => header.toLowerCase().includes(alias)))
    const depositIndex = nextHeaders.findIndex((header) => header.toLowerCase().trim() === 'deposit')
    const withdrawalIndex = nextHeaders.findIndex((header) => header.toLowerCase().trim() === 'withdrawal')
    const creditIndex = nextHeaders.findIndex((header) => header.toLowerCase().trim() === 'credit')
    const debitIndex = nextHeaders.findIndex((header) => header.toLowerCase().trim() === 'debit')
    const hasSeparateDepositWithdrawal = !hasAmount && (depositIndex !== -1 || withdrawalIndex !== -1)
    const hasSeparateCreditDebit = !hasAmount && (creditIndex !== -1 || debitIndex !== -1)
    if (hasSeparateDepositWithdrawal) {
      const amountHeader = 'Import Amount'
      const typeHeader = 'Import Type'
      nextHeaders = [...nextHeaders, amountHeader, typeHeader]
      nextRows = nextRows
        .filter((row) => String(row[depositIndex] ?? '').trim() !== '' || String(row[withdrawalIndex] ?? '').trim() !== '')
        .map((row) => {
          const isDepositRow = String(row[depositIndex] ?? '').trim() !== ''
          const amount = row[isDepositRow ? depositIndex : withdrawalIndex]
          return [...row, amount, isDepositRow ? 'Deposit' : 'Withdrawal']
        })
    } else if (hasSeparateCreditDebit) {
      const amountHeader = 'Import Amount'
      const typeHeader = 'Import Type'
      nextHeaders = [...nextHeaders, amountHeader, typeHeader]
      nextRows = nextRows
        .filter((row) => String(row[creditIndex] ?? '').trim() !== '' || String(row[debitIndex] ?? '').trim() !== '')
        .map((row) => {
          const isDepositRow = String(row[creditIndex] ?? '').trim() !== ''
          const amount = row[isDepositRow ? creditIndex : debitIndex]
          return [...row, amount, isDepositRow ? 'Deposit' : 'Withdrawal']
        })
    }
    setHeaders(nextHeaders)
    setRows(nextRows)
    setMapping({
      date: mapHeader(nextHeaders, ['date', 'time']),
      description: mapHeader(nextHeaders, ['description', 'details', 'narration', 'particular']),
      amount: mapHeader(nextHeaders, ['amount', 'value']),
      deposit: mapHeader(nextHeaders, ['deposit', 'credit']),
      withdrawal: mapHeader(nextHeaders, ['withdrawal', 'debit']),
      type: mapHeader(nextHeaders, ['type', 'debit/credit', 'transaction']),
      category: mapHeader(nextHeaders, ['category']),
      reference: mapHeader(nextHeaders, ['reference', 'ref no', 'cheque', 'transaction id']),
    })
  }

  const parsedRows = useMemo<PreviewRow[]>(() => {
    const index = (name: string) => headers.indexOf(name)
    const existingTransactions = new Set((finance?.transactions ?? [])
      .map((transaction) => statementTransactionKey(transaction)))
    const seenTransactions = new Set(existingTransactions)
    return rows.map((values, rowIndex) => {
      if (importStartDate && importEndDate && importStartDate > importEndDate) {
        return { line: rowIndex + 2, values, valid: false, reason: 'Import start date must be on or before the end date.' }
      }
      const date = normalizeDate(values[index(mapping.date)])
      const description = String(values[index(mapping.description)] ?? '').trim()
      const hasSeparateDepositWithdrawal = mapping.deposit && mapping.withdrawal && mapping.deposit !== mapping.withdrawal
      let amount: number | null = null
      let transactionType: 'income' | 'expense' = 'income'
      if (hasSeparateDepositWithdrawal) {
        const depositVal = parseMoney(values[index(mapping.deposit)])
        const withdrawalVal = parseMoney(values[index(mapping.withdrawal)])
        if (depositVal !== null && depositVal > 0) {
          amount = depositVal
          transactionType = 'income'
        } else if (withdrawalVal !== null && withdrawalVal > 0) {
          amount = withdrawalVal
          transactionType = 'expense'
        } else {
          amount = null
        }
      } else {
        amount = parseMoney(values[index(mapping.amount)])
        if (amount !== null) {
          transactionType = parseType(values[index(mapping.type)], amount)
        }
      }
      if (!date) return { line: rowIndex + 2, values, valid: false, reason: 'Date is missing or invalid.' }
      if (importStartDate && date < importStartDate || importEndDate && date > importEndDate) {
        return { line: rowIndex + 2, values, valid: false, reason: 'Date is outside the selected import range.' }
      }
      if (!description) return { line: rowIndex + 2, values, valid: false, reason: 'Description is missing.' }
      if (amount === null || amount === 0) return { line: rowIndex + 2, values, valid: false, reason: 'Amount must be a valid non-zero number.' }
      const categoryName = mapping.category ? String(values[index(mapping.category)] ?? '').trim().toLowerCase() : ''
      if (String(values[index(mapping.type)] ?? '').toLowerCase().includes('transfer')) {
        return { line: rowIndex + 2, values, valid: false, reason: 'Transfer rows must be entered using the transfer workflow.' }
      }
      const category = categoryName ? finance?.categories.find((item) => item.name.toLowerCase() === categoryName && item.category_type === (transactionType === 'income' ? 'income' : 'expense')) : undefined
      if (categoryName && !category) return { line: rowIndex + 2, values, valid: false, reason: `Category "${categoryName}" was not found.` }
      const categoryId = category?.id ?? null
      const reference = mapping.reference ? String(values[index(mapping.reference)] ?? '').trim() : ''
      const transaction = {
        transaction_date: date,
        description,
        amount: Math.abs(amount),
        transaction_type: transactionType,
        category_id: categoryId,
        reference_number: reference || null,
      }
      const key = statementTransactionKey({ ...transaction, account_id: accountId })
      if (seenTransactions.has(key)) {
        return { line: rowIndex + 2, values, valid: false, reason: 'Duplicate transaction already exists or appears earlier in this file.' }
      }
      seenTransactions.add(key)
      return {
        line: rowIndex + 2,
        values,
        valid: true,
        reason: '',
        transaction,
      }
    })
  }, [accountId, finance, headers, importEndDate, importStartDate, mapping, rows])

  const changeTargetAccount = (nextAccountId: string) => {
    setAccountId(nextAccountId)
    const latestDate = finance?.transactions
      .filter((transaction) => transaction.account_id === nextAccountId)
      .reduce((latest, transaction) => transaction.transaction_date > latest ? transaction.transaction_date : latest, '')
    const targetAccount = finance?.accounts.find((account) => account.id === nextAccountId)
    setImportStartDate(latestDate ? nextDate(latestDate) : targetAccount?.opening_balance_date ?? '')
  }

  const updateSheet = async (selected: string) => {
    if (!fileName) return
    setSheetName(selected)
    setLoading(true)
    setError('')
    try {
      const input = document.querySelector<HTMLInputElement>('#statement-file')?.files?.[0]
      if (!input) throw new Error('Please reselect the workbook before changing sheets.')
      const workbook = XLSX.read(await input.arrayBuffer(), { type: 'array', cellDates: true })
      loadSheet(workbook, selected)
    } catch (sheetError) {
      setError(errorText(sheetError))
    } finally {
      setLoading(false)
    }
  }

  const importRows = async () => {
    if (!user || !accountId) return setError('Select the account to receive these transactions.')
    const hasSeparateDepositWithdrawal = mapping.deposit && mapping.withdrawal
    const hasSingleAmount = mapping.amount
    if (!hasSeparateDepositWithdrawal && !hasSingleAmount) {
      return setError('Map either both Deposit and Withdrawal columns, or a single Amount column.')
    }
    const validRows = parsedRows.filter((row) => row.valid && row.transaction)
    if (!validRows.length) return setError('There are no valid rows to import.')
    setImporting(true)
    setError('')
    setSummary('')
    let imported = 0
    const failures: string[] = []
    try {
      for (const row of validRows) {
        const transaction = row.transaction
        if (!transaction) continue
        try {
          await createTransaction(user.id, {
            ...transaction,
            account_id: accountId,
            reference_number: transaction.reference_number,
            notes: `Imported from ${fileName}, row ${row.line}`,
          })
          imported += 1
        } catch (rowError) {
          failures.push(`Row ${row.line}: ${errorText(rowError)}`)
        }
      }
      setSummary(`${imported} of ${validRows.length} valid rows imported.${failures.length ? ` ${failures.length} failed: ${failures.slice(0, 3).join(' ')}` : ''}`)
      if (imported) await loadFinance()
    } finally {
      setImporting(false)
    }
  }

  const importBackup = async () => {
    if (!user || !backup) return
    if (importStartDate && importEndDate && importStartDate > importEndDate) {
      setError('Import start date must be on or before the end date.')
      return
    }
    setImporting(true)
    setError('')
    setSummary('')
    try {
      const inRange = (date: string) =>
        (!importStartDate || date >= importStartDate)
        && (!importEndDate || date <= importEndDate)
      const result = await importFinanceBackup(user.id, {
        ...backup,
        transactions: backup.transactions.filter((transaction) => inRange(transaction.transaction_date)),
        transfers: backup.transfers.filter((transfer) => inRange(transfer.transfer_date)),
      })
      const importedTotal = Object.values(result.imported).reduce((sum, count) => sum + count, 0)
      const skippedTotal = Object.values(result.skipped).reduce((sum, count) => sum + count, 0)
      setSummary(`Imported ${importedTotal} records in the selected date range; skipped ${skippedTotal} records already present. Accounts and categories were merged as backup metadata.${result.errors.length ? ` ${result.errors.length} items could not be imported: ${result.errors.slice(0, 3).join(' ')}` : ''}`)
      await loadFinance()
    } catch (backupError) {
      setError(errorText(backupError))
    } finally {
      setImporting(false)
    }
  }

  const validCount = parsedRows.filter((row) => row.valid).length
  const hasValidMapping = (mapping.deposit && mapping.withdrawal) || mapping.amount
  const hasValidImportRange = !importStartDate || !importEndDate || importStartDate <= importEndDate

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50/60 px-5 py-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Data portability</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Import data</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Import a bank statement or merge a local backup in CSV, Excel, or JSON format.</p>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {summary && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{summary}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {['1. Upload CSV, Excel, or JSON', '2. Preview and validate', '3. Map statement columns', '4. Import data or backup'].map((step, index) => <div key={step} className={`rounded-lg border px-3 py-3 text-sm ${index === 0 || fileName && index < 4 ? 'border-blue-200 bg-blue-50/60 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}><span className="font-medium">{step}</span></div>)}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div className="flex items-center gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><FileSpreadsheet className="h-4 w-4" /></span><div><h2 className="font-semibold text-slate-900 dark:text-slate-100">Upload statement or backup</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Files are validated before anything is imported.</p></div></div></div>
        <div className="p-5">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-blue-500 dark:hover:bg-blue-950/30">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"><UploadCloud className="h-5 w-5" /></span>
            <span className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">{fileName || 'Choose a statement or finance backup'}</span>
            <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">Statements: .xlsx, .xls, .csv · Backups: .xlsx, .csv, .json</span>
            <input id="statement-file" type="file" accept=".xlsx,.xls,.csv,.json,application/json" onChange={(event) => void selectFile(event)} className="sr-only" />
          </label>
          {loading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Reading file…</p>}
        </div>
      </section>

      {backup && (
        <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm dark:border-blue-900 dark:bg-slate-900">
          <div className="border-b border-blue-100 bg-blue-50/60 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/30">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Finance backup detected</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Import is additive: existing records are kept. Matching accounts, categories, transactions, and transfers are skipped. The selected date range applies to transactions and transfers; account and category metadata are merged as needed.</p>
          </div>
          <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-2 dark:border-slate-700">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Import from<input aria-label="Backup import from date" type="date" value={importStartDate} max={importEndDate || undefined} onChange={(event) => setImportStartDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]" /></label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Import through<input aria-label="Backup import through date" type="date" value={importEndDate} min={importStartDate || undefined} onChange={(event) => setImportEndDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]" /></label>
            {!hasValidImportRange && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 sm:col-span-2">Import start date must be on or before the end date.</p>}
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-4">
            {[
              ['Accounts', backup.accounts.length],
              ['Categories', backup.categories.length],
              ['Transactions', backup.transactions.length],
              ['Transfers', backup.transfers.length],
            ].map(([label, count]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{count}</p></div>)}
          </div>
          <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/50">
            <button type="button" disabled={importing || loading || !hasValidImportRange} onClick={() => void importBackup()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500">{importing ? 'Importing backup…' : 'Merge backup into my data'}</button>
          </div>
        </section>
      )}

      {headers.length > 0 && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Column Mapping</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Map your file's columns to the application's statement fields. Required fields are marked with <span className="text-rose-500">*</span>.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Auto-detected</span>
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"><HelpCircle className="h-3 w-3" /> Hover for details</span>
              </div>
            </div>

            <div className="space-y-3">
              {(() => {
                const targetFields: Array<{ key: keyof Mapping; label: string; required: boolean; description: string; appHeader: string }> = [
                  { key: 'date', label: 'Date', required: true, description: 'Transaction date (e.g., 15/01/2026, 2026-01-15, 15-Jan-2026)', appHeader: 'Date' },
                  { key: 'description', label: 'Description', required: true, description: 'Transaction description/narration (e.g., "Salary Credit", "Rent Payment")', appHeader: 'Description' },
                  { key: 'deposit', label: 'Deposit (Credit)', required: false, description: 'Deposit/Credit amount column. Map your Credit column here. Either this or Withdrawal is required.', appHeader: 'Deposit' },
                  { key: 'withdrawal', label: 'Withdrawal (Debit)', required: false, description: 'Withdrawal/Debit amount column. Map your Debit column here. Either this or Deposit is required.', appHeader: 'Withdrawal' },
                  { key: 'amount', label: 'Amount (Single Column)', required: false, description: 'Single amount column (use with Type column below). Use this OR Deposit/Withdrawal above, not both.', appHeader: 'Deposit / Withdrawal' },
                  { key: 'type', label: 'Type (Debit/Credit)', required: false, description: 'Indicates deposit or withdrawal. Keywords: deposit/credit/income/cr → Deposit; withdrawal/debit/expense/dr → Withdrawal', appHeader: 'Type' },
                  { key: 'category', label: 'Category', required: false, description: 'Category name (must match existing categories in app). Leave empty to categorize later.', appHeader: 'Category' },
                  { key: 'reference', label: 'Reference Number', required: false, description: 'Cheque number, transaction ID, or reference (e.g., CHQ12345, TXN789)', appHeader: 'Reference' },
                ]

                return targetFields.map(({ key, label, required, description, appHeader }) => {
                  const mappedHeader = mapping[key]
                  const sampleValues = mappedHeader ? getSampleValues(mappedHeader, 3) : []
                  const isAutoMapped = mappedHeader && mapHeader(headers, getAliasesForKey(key)).toLowerCase() === mappedHeader.toLowerCase()

                  return (
                    <div key={key} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{label}{required && <span className="text-rose-500 ml-1">*</span>}</span>
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Target: {appHeader}</span>
                            {isAutoMapped && <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Auto-mapped</span>}
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            required={required}
                            value={mappedHeader}
                            onChange={(event) => setMapping({ ...mapping, [key]: event.target.value })}
                            className="w-full sm:w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-950 dark:[color-scheme:dark]"
                          >
                            <option value="">{required ? 'Select source column…' : 'Do not map'}</option>
                            {headers.map((header, index) => (
                              <option key={`${header}-${index}`} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {mappedHeader && sampleValues.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Sample values from your file:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sampleValues.map((val, i) => (
                              <span key={i} className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded font-mono text-slate-700 dark:text-slate-200">{val}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Worksheet<select value={sheetName} onChange={(event) => void updateSheet(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]">{sheetNames.map((sheet) => <option key={sheet}>{sheet}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Target account<select value={accountId} onChange={(event) => changeTargetAccount(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"><option value="">Select account</option>{finance?.accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name} · {account.bank_name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Import from<input aria-label="Import from date" type="date" value={importStartDate} max={importEndDate || undefined} onChange={(event) => setImportStartDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Import through<input aria-label="Import through date" type="date" value={importEndDate} min={importStartDate || undefined} onChange={(event) => setImportEndDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]" /></label>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">The start date is suggested as the day after the latest transaction already in this account. Dates are inclusive; rows outside this window and duplicate transactions are excluded from import.</p>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:px-5">
              <div><h2 className="font-semibold text-slate-900 dark:text-slate-100">Import preview</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{validCount} valid to import · {parsedRows.length - validCount} excluded by date range, duplicates, or validation · first 10 rows shown</p></div>
              <button type="button" disabled={importing || loading || !accountId || !validCount || !hasValidMapping} onClick={() => void importRows()} className="rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500">{importing ? 'Importing…' : `Import ${validCount} valid rows`}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="px-4 py-3 font-semibold">Row</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Validation</th></tr></thead>
                <tbody>{parsedRows.slice(0, 10).map((row) => <tr key={row.line} className="transaction-row border-t border-slate-100 odd:bg-slate-50/50 dark:border-slate-800 dark:odd:bg-slate-800/40"><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.line}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.transaction?.transaction_date ?? String(row.values[headers.indexOf(mapping.date)] ?? '—')}</td><td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.transaction?.description ?? String(row.values[headers.indexOf(mapping.description)] ?? '—')}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.transaction?.transaction_type === 'income' ? 'Deposit' : row.transaction?.transaction_type === 'expense' ? 'Withdrawal' : '—'}</td><td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 dark:text-slate-200">{row.transaction ? `Rs. ${row.transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td><td className={`px-4 py-3 text-xs ${row.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{row.valid ? 'Ready' : row.reason}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
