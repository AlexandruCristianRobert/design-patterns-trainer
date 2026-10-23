import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import catalog from '../locales/en/catalog.json'
import checks from '../locales/en/checks.json'
import common from '../locales/en/common.json'
import contract from '../locales/en/contract.json'
import diagnostics from '../locales/en/diagnostics.json'
import exam from '../locales/en/exam.json'
import exercise from '../locales/en/exercise.json'
import lesson from '../locales/en/lesson.json'
import progress from '../locales/en/progress.json'
import sandbox from '../locales/en/sandbox.json'

export const namespaces = ['common', 'sandbox', 'diagnostics', 'catalog', 'lesson', 'checks', 'contract', 'exercise', 'progress', 'exam'] as const

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: namespaces,
  defaultNS: 'common',
  resources: { en: { common, sandbox, diagnostics, catalog, lesson, checks, contract, exercise, progress, exam } },
  interpolation: { escapeValue: false },
  initAsync: false,
})

export default i18n
