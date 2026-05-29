import { useState, useEffect } from 'react'
import { checkSession } from '../lib/adminApi.js'
import AdminLogin from '../pages/AdminLogin.jsx'

// Protege as rotas de admin. A proteção real acontece no servidor (cada /api de
// escrita valida a sessão); este gate é a camada de UX.
//
// Em `vite dev` as funções /api não rodam → o fetch falha e, só em DEV,
// liberamos o acesso para permitir desenvolver a UI. Em produção (e em
// `vercel dev`) a sessão é sempre verificada de verdade.
export default function RequireAuth({ children }) {
  const [state, setState] = useState('loading') // 'loading' | 'in' | 'out'

  useEffect(() => {
    let alive = true
    checkSession()
      .then(authed => { if (alive) setState(authed ? 'in' : 'out') })
      .catch(() => { if (alive) setState(import.meta.env.DEV ? 'in' : 'out') })
    return () => { alive = false }
  }, [])

  if (state === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--c-paper2)',
      }}>
        <span className="mute hand" style={{ fontSize: 13 }}>carregando…</span>
      </div>
    )
  }

  if (state === 'out') {
    return <AdminLogin onSuccess={() => setState('in')} />
  }

  return children
}
