import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router'
import { CompilerProvider } from './compiler/CompilerProvider'
import { CatalogPage } from './features/catalog/CatalogPage'
import { DevEnginePage } from './features/dev/DevEnginePage'
import { DevVisualsPage } from './features/dev/DevVisualsPage'
import { PlaceholderPage } from './features/placeholder/PlaceholderPage'
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

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link')

function MainNav() {
  const { t } = useTranslation()
  // Lessons and Exercises sit under the Catalog, so its tab stays highlighted there.
  const inPattern = useLocation().pathname.startsWith('/patterns/')
  return (
    <nav className="app-nav" aria-label={t('nav.label')}>
      <NavLink to="/" end className={({ isActive }) => navClass({ isActive: isActive || inPattern })}>
        {t('nav.catalog')}
      </NavLink>
      <NavLink to="/sandbox" className={navClass}>
        {t('nav.sandbox')}
      </NavLink>
      <NavLink to="/progress" className={navClass}>
        {t('nav.progress')}
      </NavLink>
    </nav>
  )
}

function Shell() {
  const { t } = useTranslation()
  return (
    <>
      <header className="app-header">
        <span className="app-name">{t('app.name')}</span>
        <MainNav />
        <ThemeSwitch />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/patterns/:patternId" element={<PlaceholderPage page="lesson" />} />
          <Route path="/patterns/:patternId/practice/:exerciseId" element={<PlaceholderPage page="exercise" />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/progress" element={<PlaceholderPage page="progress" />} />
          {import.meta.env.DEV && <Route path="/dev/engine" element={<DevEnginePage />} />}
          {import.meta.env.DEV && <Route path="/dev/visuals" element={<DevVisualsPage />} />}
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
