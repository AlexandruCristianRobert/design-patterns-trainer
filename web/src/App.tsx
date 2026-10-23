import { ArrowLeft, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router'
import { IdeProvider } from './editor/ide/IdeProvider'
import { CompilerProvider } from './compiler/CompilerProvider'
import { ExamBanner } from './exam/ExamBanner'
import { ExamWatchContext } from './exam/ExamWatchContext'
import { useExamWatcher } from './exam/useExamWatcher'
import { CatalogPage } from './features/catalog/CatalogPage'
import { DevEnginePage } from './features/dev/DevEnginePage'
import { DevVisualsPage } from './features/dev/DevVisualsPage'
import { ExamReportPage } from './features/exam/ExamReportPage'
import { ExamSessionPage } from './features/exam/ExamSessionPage'
import { ExamSetupPage } from './features/exam/ExamSetupPage'
import { ExercisePage } from './features/exercise/ExercisePage'
import { LessonPage } from './features/lesson/LessonPage'
import { ProgressPage } from './features/progress/ProgressPage'
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
      <NavLink to="/exam" className={navClass}>
        {t('nav.exam')}
      </NavLink>
      <NavLink to="/progress" className={navClass}>
        {t('nav.progress')}
      </NavLink>
    </nav>
  )
}

function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="page-head lesson-soon">
      <h1 className="page-title">{t('notFound.title')}</h1>
      <p className="page-intro">{t('notFound.body')}</p>
      <p>
        <Link className="back-link" to="/">
          <ArrowLeft size={14} aria-hidden="true" />
          {t('notFound.back')}
        </Link>
      </p>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/patterns/:patternId" element={<LessonPage />} />
      <Route path="/patterns/:patternId/practice/:exerciseId" element={<ExercisePage />} />
      <Route path="/sandbox" element={<SandboxPage />} />
      <Route path="/exam" element={<ExamSetupPage />} />
      <Route path="/exam/:sessionId" element={<ExamSessionPage />} />
      <Route path="/exam/:sessionId/report" element={<ExamReportPage />} />
      <Route path="/progress" element={<ProgressPage />} />
      {import.meta.env.DEV && <Route path="/dev/engine" element={<DevEnginePage />} />}
      {import.meta.env.DEV && <Route path="/dev/visuals" element={<DevVisualsPage />} />}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function Shell() {
  const { t } = useTranslation()
  const { pathname, hash } = useLocation()
  const examWatch = useExamWatcher()
  // The window scrolls, so a new page would otherwise open at the old page's scroll position. A hash link scrolls itself.
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
    // Only a new path is a new page; the hash is read, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  return (
    <>
      <header className="app-header">
        <span className="app-name">{t('app.name')}</span>
        <MainNav />
        <ThemeSwitch />
      </header>
      <ExamWatchContext.Provider value={examWatch}>
        <ExamBanner watch={examWatch} />
        <main className="app-main">
          <AppRoutes />
        </main>
      </ExamWatchContext.Provider>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <CompilerProvider>
        <IdeProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Shell />
          </BrowserRouter>
        </IdeProvider>
      </CompilerProvider>
    </ThemeProvider>
  )
}
