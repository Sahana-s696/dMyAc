import { ShieldCheck, SlidersHorizontal } from 'lucide-react'

export const SettingsPage = () => (
  <div className="space-y-6">
    <div>
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">Settings</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">System preferences</h1>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">General</h2>
        </div>
        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <div className="flex items-center justify-between"><span>Currency</span><span className="font-medium text-slate-800">₹ INR</span></div>
          <div className="flex items-center justify-between"><span>Date format</span><span className="font-medium text-slate-800">DD/MM/YYYY</span></div>
          <div className="flex items-center justify-between"><span>Default account</span><span className="font-medium text-slate-800">CTZN</span></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        </div>
        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <label className="flex items-center justify-between"><span>Two-factor authentication</span><input type="checkbox" defaultChecked /></label>
          <label className="flex items-center justify-between"><span>Session persistence</span><input type="checkbox" defaultChecked /></label>
          <label className="flex items-center justify-between"><span>Audit log retention</span><input type="checkbox" defaultChecked /></label>
        </div>
      </div>
    </div>
  </div>
)
