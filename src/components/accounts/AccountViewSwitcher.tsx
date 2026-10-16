import { FileText, List } from 'lucide-react'
import { Link } from 'react-router-dom'

type AccountViewSwitcherProps = {
  accountId: string
  activeView: 'statement' | 'activity'
}

export const AccountViewSwitcher = ({ accountId, activeView }: AccountViewSwitcherProps) => {
  const linkClass = (view: AccountViewSwitcherProps['activeView']) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
      activeView === view
        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
    }`

  return (
    <nav aria-label="Account views" className="inline-flex rounded-md bg-slate-100 p-0.5 dark:bg-slate-800">
      <Link
        to={`/accounts/${encodeURIComponent(accountId)}`}
        aria-current={activeView === 'statement' ? 'page' : undefined}
        className={linkClass('statement')}
      >
        <FileText aria-hidden="true" className="h-3.5 w-3.5" />
        Account Statement
      </Link>
      <Link
        to={`/transactions?accountId=${encodeURIComponent(accountId)}`}
        aria-current={activeView === 'activity' ? 'page' : undefined}
        className={linkClass('activity')}
      >
        <List aria-hidden="true" className="h-3.5 w-3.5" />
        Account Activity
      </Link>
    </nav>
  )
}
