import { useState, type FormEvent } from 'react'
import { Bell, ChevronDown, LogOut, Menu, Search, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.tsx'
import { ThemeToggle } from '../ui/ThemeToggle'

export const Header = ({ isMobile, setIsMobile }: {
  isMobile: boolean
  setIsMobile: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const name = profile?.full_name
    ?? (typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : 'Account user')
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(`/transactions${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`)
  }

  const handleSignOut = async () => {
    setSignOutError('')
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Unable to sign out.')
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex h-11 items-center justify-between gap-2 px-2.5 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button type="button" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 md:hidden" onClick={() => setIsMobile(!isMobile)} aria-label="Toggle menu">
            <Menu className="h-5 w-5" />
          </button>
          <form onSubmit={submitSearch} className="relative w-full max-w-[340px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transactions, description, reference..."
              aria-label="Search transactions, description, reference"
              className="w-full rounded-md border border-slate-200 bg-slate-50/70 py-1 pl-8 pr-2.5 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
          </form>
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <ThemeToggle />
          <button type="button" className="relative rounded-lg p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Notifications">
            <Bell className="h-[17px] w-[17px]" />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
          </button>
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} className="flex items-center gap-1.5 rounded-md p-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-200">{initials || <UserRound className="h-3.5 w-3.5" />}</span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-28 truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">{name}</span>
              <span className="block max-w-28 truncate text-[9px] text-slate-500 dark:text-slate-400">{profile?.email ?? user?.email}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <button type="button" onClick={() => { navigate('/settings'); setMenuOpen(false) }} className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">Settings</button>
              <button type="button" onClick={() => void handleSignOut()} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
              {signOutError && <p role="alert" className="px-2.5 py-1.5 text-xs text-rose-700">{signOutError}</p>}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
