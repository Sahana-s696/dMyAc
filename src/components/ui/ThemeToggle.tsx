import React, { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'

export const ThemeToggle: React.FC<{
  defaultTheme?: 'light' | 'dark' | 'system'
}> = ({ defaultTheme = 'system' }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(
    defaultTheme
  )

  useEffect(() => {
    const setInitialTheme = () => {
      if (theme !== 'system') {
        const htmlClass = document.documentElement.classList
        if (theme === 'dark') {
          htmlClass.add('dark')
        } else {
          htmlClass.remove('dark')
        }
      } else {
        // System preference
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches
        if (prefersDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    setInitialTheme()
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setInitialTheme()
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4"
          aria-label="Light mode"
        />) : (
        <Moon className="h-4 w-4"
          aria-label="Dark mode"
        />)}
    </button>
  )
}