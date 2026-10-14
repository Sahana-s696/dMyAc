import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { AccountStatementPage } from './pages/AccountStatementPage'
import { useAuth } from './context/AuthContext.tsx'
import { AuthPage } from './pages/AuthPage'
import { AccountsPage } from './pages/AccountsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { ExcelExportPage } from './pages/ExcelExportPage'
import { ExcelImportPage } from './pages/ExcelImportPage'
import { MonthlySummaryPage } from './pages/MonthlySummaryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { TransfersPage } from './pages/TransfersPage'
import { YearlySummaryPage } from './pages/YearlySummaryPage'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading...</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><AuthPage /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><MainLayout><DashboardPage /></MainLayout></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><MainLayout><AccountsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/accounts/:accountId" element={<ProtectedRoute><MainLayout><AccountStatementPage /></MainLayout></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><MainLayout><TransactionsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/transfers" element={<ProtectedRoute><MainLayout><TransfersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><MainLayout><CategoriesPage /></MainLayout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><MainLayout><ReportsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/monthly-summary" element={<ProtectedRoute><MainLayout><MonthlySummaryPage /></MainLayout></ProtectedRoute>} />
      <Route path="/yearly-summary" element={<ProtectedRoute><MainLayout><YearlySummaryPage /></MainLayout></ProtectedRoute>} />
      <Route path="/excel-import" element={<ProtectedRoute><MainLayout><ExcelImportPage /></MainLayout></ProtectedRoute>} />
      <Route path="/excel-export" element={<ProtectedRoute><MainLayout><ExcelExportPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App