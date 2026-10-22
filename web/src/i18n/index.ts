import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '../locales/en/common.json'
import diagnostics from '../locales/en/diagnostics.json'
import sandbox from '../locales/en/sandbox.json'

export const namespaces = ['common', 'sandbox', 'diagnostics'] as const

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: namespaces,
  defaultNS: 'common',
  resources: { en: { common, sandbox, diagnostics } },
  interpolation: { escapeValue: false },
  initAsync: false,
})

export default i18n
