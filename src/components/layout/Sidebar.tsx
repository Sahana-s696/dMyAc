import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  Download,
  Landmark,
  LayoutDashboard,
  Settings,
  Tags,
  Upload,
  Wallet,
  X,
  Banknote,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Accounts', href: '/accounts', icon: Landmark },
  { label: 'Transactions', href: '/transactions', icon: Wallet },
  { label: 'Transfers', href: '/transfers', icon: ArrowLeftRight },
  { label: 'Categories', href: '/categories', icon: Tags },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Monthly', href: '/monthly-summary', icon: CalendarDays },
  { label: 'Yearly', href: '/yearly-summary', icon: CalendarDays },
  { label: 'Import', href: '/excel-import', icon: Upload },
  { label: 'Export', href: '/excel-export', icon: Download },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export const Sidebar = ({ isMobile, setIsMobile }: {
  isMobile: boolean
  setIsMobile: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <>
      {isMobile && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/30 dark:bg-blue-950/60 md:hidden"
          onClick={() => setIsMobile(false)}
          aria-label="Close navigation"
        />
      )}
       <aside className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-48 flex-col border-r border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0',
          isMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}>
         <div className="flex h-11 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700">
           <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-left">
             <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-800 text-white"><Banknote className="h-4 w-4" /></span>
             <span>
                <span className="block text-[13px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">My Finance</span>
                <span className="block text-[9px] text-slate-500 dark:text-slate-400">Manage your money</span>
             </span>
           </button>
            <button type="button" onClick={() => setIsMobile(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-700" aria-label="Close menu"><X className="h-4 w-4" /></button>
         </div>

         <nav aria-label="Main navigation" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
             <p className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-400">Workspace</p>
           {navItems.map(({ label, href, icon: Icon }) => {
             const active = location.pathname === href || (href !== '/' && location.pathname.startsWith(`${href}/`))
             return (
               <button
                 key={label}
                 type="button"
                 aria-current={active ? 'page' : undefined}
                 onClick={() => {
                   navigate(href)
                   setIsMobile(false)
                 }}
                 className={cn(
                   'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors',
                   active
                     ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-100'
                     : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-600 dark:hover:text-slate-100',
                 )}
               >
                  <Icon className={cn('h-[16px] w-[16px]', active ? 'text-blue-700 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200')} />
                 {label}
               </button>
             )
           })}
         </nav>

         <div className="border-t border-slate-100 p-2 dark:border-slate-700">
            <div className="flex items-start gap-2 rounded-md bg-slate-50 dark:bg-slate-900/50 px-2 py-2">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">Your data is secure</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">Powered by Supabase</p>
              </div>
            </div>
          </div>
       </aside>
     </>
   )
}
