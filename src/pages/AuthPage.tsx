import { useState, type FormEvent } from 'react'
import { ArrowRight, Banknote, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export const AuthPage = () => {
  const { signIn, signUp } = useAuth()
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(isSupabaseConfigured ? '' : 'demo@finance.local')
  const [password, setPassword] = useState(isSupabaseConfigured ? '' : 'demo12345')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      if (isCreatingAccount) {
        const { error: signUpError } = await signUp(email, password, fullName)
        if (signUpError) setError(signUpError.message)
        else {
          setNotice('Account created. Check your email if confirmation is enabled, then sign in.')
          setIsCreatingAccount(false)
        }
      } else {
        const { error: signInError } = await signIn(email, password)
        if (signInError) setError(signInError.message)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to complete the request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6fa] px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.28)] md:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between border-b border-slate-200 bg-[#f8fafc] p-7 sm:p-10 md:border-b-0 md:border-r">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white"><Banknote className="h-5 w-5" /></span>
              <div>
                <p className="text-base font-semibold text-slate-900">My Finance</p>
                <p className="text-xs text-slate-500">Personal banking workspace</p>
              </div>
            </div>
            <p className="mt-12 text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">Simple. Clear. In control.</p>
            <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">Manage your accounts with confidence.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">A clear view of your balances, deposits, withdrawals, transfers, and bank statements in one secure place.</p>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your banking at a glance</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-50/70 p-3"><p className="text-xs text-slate-500">Deposits</p><p className="mt-1 text-sm font-semibold text-emerald-800">Tracked</p></div>
              <div className="rounded-lg bg-rose-50/70 p-3"><p className="text-xs text-slate-500">Withdrawals</p><p className="mt-1 text-sm font-semibold text-rose-800">Recorded</p></div>
              <div className="rounded-lg bg-blue-50/70 p-3"><p className="text-xs text-slate-500">Transfers</p><p className="mt-1 text-sm font-semibold text-blue-800">Balanced</p></div>
            </div>
            <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3">
              {['Account-level balances', 'Statement-style transaction history', 'Import and export workflows'].map((feature) => (
                <div key={feature} className="flex items-center gap-2.5 text-sm text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-700" />{feature}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-7 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-7 flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-700"><LockKeyhole className="h-[18px] w-[18px]" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secure access</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{isCreatingAccount ? 'Create your account' : 'Welcome back'}</h2>
                <p className="mt-1 text-sm text-slate-500">{isCreatingAccount ? 'Create a profile to manage your finances.' : 'Sign in to continue to your accounts.'}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isCreatingAccount && (
                <label className="block text-sm font-medium text-slate-700">Full name
                  <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" autoComplete="name" required />
                </label>
              )}
              <label className="block text-sm font-medium text-slate-700">Email address
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="you@example.com" autoComplete="email" required />
              </label>
              <label className="block text-sm font-medium text-slate-700">Password
                <input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="At least 8 characters" autoComplete={isCreatingAccount ? 'new-password' : 'current-password'} required />
              </label>
              {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</div>}
              {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{notice}</div>}
              <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Please wait…' : isCreatingAccount ? 'Create account' : 'Sign in'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {isSupabaseConfigured && (
              <button type="button" onClick={() => { setIsCreatingAccount(!isCreatingAccount); setError(''); setNotice('') }} className="mt-4 w-full text-sm font-medium text-blue-700 hover:text-blue-900">
                {isCreatingAccount ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </button>
            )}

            <div className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              {isSupabaseConfigured ? 'Your account is protected by Supabase authentication and row-level data access.' : 'Demo mode is on. Your sample finance records stay in this browser.'}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
