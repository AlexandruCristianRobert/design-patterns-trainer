import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'dp.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

interface ThemeContextValue {
  theme: Theme
  setTheme(theme: Theme): void
  /** The theme actually shown, after resolving `system` against the OS preference. */
  resolved: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function subscribeToOsTheme(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => {}
  const mq = matchMedia(DARK_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const osPrefersDark = () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const prefersDark = useSyncExternalStore(subscribeToOsTheme, osPrefersDark, () => false)

  // Layout effect: the attribute must be set before children read the CSS variables (e.g. the Monaco theme).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode, blocked): the choice lasts for this visit only.
    }
  }

  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
  return <ThemeContext value={{ theme, setTheme, resolved }}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}
