import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import catalog from '../locales/en/catalog.json'
import common from '../locales/en/common.json'
import diagnostics from '../locales/en/diagnostics.json'
import lesson from '../locales/en/lesson.json'
import sandbox from '../locales/en/sandbox.json'

export const namespaces = ['common', 'sandbox', 'diagnostics', 'catalog', 'lesson'] as const

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: namespaces,
  defaultNS: 'common',
  resources: { en: { common, sandbox, diagnostics, catalog, lesson } },
  interpolation: { escapeValue: false },
  initAsync: false,
})

export default i18n
