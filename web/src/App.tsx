import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { CompilerProvider } from './compiler/CompilerProvider'
import { DevEnginePage } from './features/dev/DevEnginePage'
import { SandboxPage } from './features/sandbox/SandboxPage'
import { ThemeProvider, useTheme, type Theme } from './theme/ThemeProvider'

const themes: { value: Theme; icon: LucideIcon }[] = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
]

function ThemeSwitch() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  return (
    <div className="seg" role="group" aria-label={t('theme.label')}>
      {themes.map(({ value, icon: Icon }) => (
        <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>
          <Icon size={14} aria-hidden="true" />
          <span className="seg-label">{t(`theme.${value}`)}</span>
        </button>
      ))}
    </div>
  )
}

function Shell() {
  const { t } = useTranslation()
  return (
    <>
      <header className="app-header">
        <span className="app-name">{t('app.name')}</span>
        <ThemeSwitch />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/sandbox" replace />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          {import.meta.env.DEV && <Route path="/dev/engine" element={<DevEnginePage />} />}
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <CompilerProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Shell />
        </BrowserRouter>
      </CompilerProvider>
    </ThemeProvider>
  )
}
