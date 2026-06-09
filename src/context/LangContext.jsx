import { createContext, useContext, useEffect, useState } from 'react'
import { I18N } from '../data/i18n.js'

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState('pt')
  const t = I18N[lang]

  // Mantém o <html lang> em sincronia com o idioma (a11y + SEO).
  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
  }, [lang])
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
