import { useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(false)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-700">
        Please sign in to access the application.
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="flex min-h-screen">
        <Sidebar isMobile={isMobile} setIsMobile={setIsMobile} />
        <div className="flex min-w-0 flex-1 flex-col md:ml-0 md:pl-0">
          <Header isMobile={isMobile} setIsMobile={setIsMobile} />
          <main className="min-w-0 flex-1 overflow-x-auto bg-background p-2 md:p-3">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
