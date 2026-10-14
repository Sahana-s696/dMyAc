export type TransactionType = 
  | 'income'
  | 'expense'
  | 'transfer'
  | 'broker_deposit'
  | 'broker_withdrawal'
  | 'interest'
  | 'ipo_payment'
  | 'loan_repayment'
  | 'bank_charge'
  | 'cash_deposit'
  | 'cash_withdrawal'
  | 'other'

export type CategoryType = 'income' | 'expense' | 'transfer' | 'broker'

export type AccountType = 
  | 'checking'
  | 'savings'
  | 'investment'
  | 'cash'
  | 'broker'
  | 'credit'
  | 'loan'
  | 'other'

export type AccountStatus = 'active' | 'inactive' | 'closed'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  currency: string | null
  date_format: string | null
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  account_name: string
  bank_name: string
  account_number: string | null
  account_type: AccountType
  opening_balance: number
  opening_balance_date: string
  current_balance: number
  status: AccountStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  category_type: CategoryType
  parent_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  transaction_date: string
  description: string
  transaction_type: TransactionType
  category_id: string | null
  subcategory_id: string | null
  amount: number
  reference_number: string | null
  transfer_id: string | null
  notes: string | null
  attachment_url: string | null
  created_at: string
  updated_at: string
  
  // Joined fields
  account?: Account
  category?: Category
  subcategory?: Category
  transfer?: Transfer
}

export interface Transfer {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string
  amount: number
  transfer_date: string
  description: string
  reference_number: string | null
  created_at: string
  
  // Joined fields
  from_account?: Account
  to_account?: Account
  from_transaction?: Transaction
  to_transaction?: Transaction
}

export interface Attachment {
  id: string
  user_id: string
  transaction_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: 'create' | 'update' | 'delete'
  entity_type: 'account' | 'transaction' | 'category' | 'transfer'
  entity_id: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  accountId?: string
  categoryId?: string
  transactionType?: TransactionType
  search?: string
  amountMin?: number
  amountMax?: number
  page: number
  pageSize: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DashboardStats {
  totalBalance: number
  totalIncome: number
  totalExpense: number
  totalTransfers: number
  brokerDeposits: number
  availableCash: number
}

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export interface MonthlySummary {
  month: string
  year: number
  openingBalance: number
  totalIncome: number
  totalExpense: number
  brokerDeposits: number
  brokerWithdrawals: number
  transfers: number
  netCashFlow: number
  closingBalance: number
}

export interface YearlySummary {
  year: number
  income: number
  expense: number
  netCashFlow: number
  closingBalance: number
}

export interface CategoryReportItem {
  categoryId: string
  categoryName: string
  categoryType: CategoryType
  transactionCount: number
  totalAmount: number
  percentage: number
}

export interface AccountStatement {
  accountId: string
  accountName: string
  openingBalance: number
  totalIncome: number
  totalExpense: number
  totalTransferIn: number
  totalTransferOut: number
  closingBalance: number
  transactions: Transaction[]
}

export interface ExcelImportPreview {
  headers: string[]
  rows: Record<string, unknown>[]
  totalRows: number
  sheetName: string
}

export interface ColumnMapping {
  date: string
  description: string
  amount: string
  category?: string
  account?: string
  type?: string
  reference?: string
  notes?: string
}

export interface ImportResult {
  success: number
  skipped: number
  errors: string[]
  duplicates: number
}

export interface BackupData {
  version: string
  exportedAt: string
  userId: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
}

export interface AppSettings {
  currency: string
  dateFormat: string
  theme: 'light' | 'dark' | 'system'
  defaultAccountId: string | null
  autoBackup: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
}

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}