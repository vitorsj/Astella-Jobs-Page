import { createContext, useContext, useState } from 'react'
import { I18N } from '../data/i18n.js'

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState('pt')
  const t = I18N[lang]
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
