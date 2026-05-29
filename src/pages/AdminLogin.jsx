import { useState } from 'react'
import { login } from '../lib/adminApi.js'

const ERROR_LABELS = {
  invalid_password: 'Senha incorreta.',
  auth_not_configured: 'Autenticação não configurada no servidor.',
  method_not_allowed: 'Requisição inválida.',
}

export default function AdminLogin({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setError(null)
    const { ok, status, error } = await login(password)
    setBusy(false)
    if (ok) {
      onSuccess?.()
      return
    }
    if (status === 0 || status >= 500) {
      setError(ERROR_LABELS[error] || 'Erro no servidor. Rode com `vercel dev` ou em produção.')
    } else {
      setError(ERROR_LABELS[error] || 'Não foi possível entrar.')
    }
    setPassword('')
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--c-paper2)', padding: 24,
    }}>
      <form onSubmit={submit} className="wf-box" style={{ padding: 32, width: 360, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="wf-spiral" />
          <span className="wf-label" style={{ fontSize: 12 }}>ASTELLA · ADMIN</span>
        </div>
        <h2 className="wf-h2" style={{ marginBottom: 4 }}>Entrar</h2>
        <div className="mute hand" style={{ fontSize: 13, marginBottom: 20 }}>
          Acesso restrito ao painel de vagas.
        </div>

        <div className="wf-label mute" style={{ marginBottom: 6 }}>SENHA</div>
        <input
          type="password"
          className="wf-input-el"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          style={{ width: '100%', marginBottom: 14 }}
          placeholder="••••••••"
        />

        {error && (
          <div className="hand" style={{
            fontSize: 12, color: '#C0392B', background: '#FEE',
            border: '1px solid rgba(192,57,43,0.3)', borderRadius: 8,
            padding: '8px 10px', marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="wf-btn wf-btn-primary"
          disabled={busy || !password}
          style={{ width: '100%', justifyContent: 'center', opacity: busy || !password ? 0.6 : 1 }}
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
