import { Home } from 'lucide-react'
import { Link } from 'react-router-dom'

export const NotFoundPage = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
        <Home className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The route you requested is not available in the current finance workspace.</p>
      <Link to="/" className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500">Back to dashboard</Link>
    </div>
  </div>
)
