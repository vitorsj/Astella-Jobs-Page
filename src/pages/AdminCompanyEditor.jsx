import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { COMPANY } from '../data/jobs.js'
import { getOverrides, saveCompany, logout } from '../lib/adminApi.js'

// Aceita http(s) ou vazio (links LinkedIn). logo_url pode ser caminho local
// (/logos/x.jpeg), então NÃO é validado aqui.
function isHttpUrlOrEmpty(value) {
  if (value == null || value === '') return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function buildForm(base, ov) {
  base = base || {}
  ov = ov || {}
  return {
    name: ov.name ?? base.name ?? '',
    logo_url: ov.logo_url ?? base.logo_url ?? '',
    linkedin_url: ov.linkedin_url ?? base.linkedin_url ?? '',
  }
}

// Editor de empresa — EDIÇÃO apenas (sem criação; ver restrição de produto).
export default function AdminCompanyEditor() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const base = COMPANY[slug] || null

  const [liveOverrides, setLiveOverrides] = useState(null)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    let alive = true
    getOverrides()
      .then(data => { if (alive) setLiveOverrides(data || { companies: {} }) })
      .catch(() => { if (alive) setLiveOverrides({ companies: {} }) })
    return () => { alive = false }
  }, [])

  const liveOv = liveOverrides?.companies?.[slug]
  const [form, setForm] = useState(() => buildForm(base, null))

  // Re-hidrata na troca de slug; quando os overrides vivos chegam (async), só
  // reaplica se o usuário ainda NÃO editou — senão sobrescreveria o que ele digitou.
  const dirtyRef = useRef(false)
  const prevSlugRef = useRef(slug)
  useEffect(() => {
    const slugChanged = prevSlugRef.current !== slug
    if (slugChanged) { prevSlugRef.current = slug; dirtyRef.current = false }
    if (slugChanged || !dirtyRef.current) setForm(buildForm(base, liveOv))
  }, [slug, liveOverrides]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { dirtyRef.current = true; setForm(f => ({ ...f, [k]: v })) }
  const linkedinValid = useMemo(() => isHttpUrlOrEmpty(form.linkedin_url), [form.linkedin_url])

  async function persist() {
    if (saving) return
    if (!form.name.trim()) { showToast('Nome é obrigatório.'); return }
    if (!linkedinValid) { showToast('LinkedIn inválido — use uma URL http(s).'); return }
    setSaving(true)
    // Campos opcionais vazios → null: o data layer (jobs.js stripEmpty) ignora,
    // mantendo o valor base de companies.json em vez de sobrescrever com vazio.
    const patch = {
      name: form.name.trim(),
      logo_url: form.logo_url.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
    }
    const { ok, status, error } = await saveCompany(slug, patch)
    setSaving(false)
    if (ok) {
      setLastSaved(new Date())
      setLiveOverrides(prev => ({ ...(prev || {}), companies: { ...(prev?.companies || {}), [slug]: { ...(prev?.companies?.[slug] || {}), ...patch } } }))
      showToast('Salvo. O painel e o site atualizam em ~1 min.')
    } else if (status === 401) {
      showToast('Sessão expirada — recarregue e entre de novo.')
    } else if (status === 0 || status >= 500) {
      showToast('Indisponível (rode com `vercel dev` ou em produção).')
    } else {
      showToast(`Erro ao salvar: ${error || status}`)
    }
  }

  const savedLabel = lastSaved
    ? `salvo às ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : (liveOv?.updated_at ? 'editada anteriormente' : 'sem edições')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--c-paper)' }}>
      {/* App bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', borderBottom: '1.5px solid var(--c-line)',
        background: 'var(--c-paper2)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/admin')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span className="wf-spiral" />
            <span className="wf-label">ASTELLA · ADMIN</span>
          </button>
          <span className="mute hand" style={{ fontSize: 12 }}>/ empresas / editar</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/admin')} className="wf-chip wf-chip-sm" style={{ cursor: 'pointer' }}>← dashboard</button>
          <button onClick={async () => { await logout(); window.location.reload() }} className="wf-chip wf-chip-sm" style={{ cursor: 'pointer' }}>sair</button>
        </div>
      </div>

      {!base ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="hand" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Empresa não encontrada</div>
            <div className="mute hand" style={{ fontSize: 13, marginBottom: 12 }}>O slug “{slug}” não está no portfólio.</div>
            <button onClick={() => navigate('/admin')} className="wf-btn wf-btn-ghost wf-btn-sm" style={{ cursor: 'pointer' }}>voltar ao dashboard</button>
          </div>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', padding: 28, maxWidth: 720, width: '100%', margin: '0 auto' }}>
          {/* Header com preview do logo */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 22 }}>
            <span style={{ width: 64, height: 64, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, background: '#225379', borderRadius: 2 }}>
              {form.logo_url
                ? <img src={form.logo_url} alt={form.name} onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span className="hand" style={{ color: '#fff', fontWeight: 700 }}>{(form.name || '?').slice(0, 2).toUpperCase()}</span>}
            </span>
            <div>
              <div className="wf-label mute">EMPRESA · {slug}</div>
              <h2 className="wf-h2" style={{ marginTop: 4 }}>{form.name || '(sem nome)'}</h2>
            </div>
          </div>

          <div className="wf-label mute" style={{ marginBottom: 6 }}>NOME</div>
          <input type="text" className="wf-input-el" value={form.name} onChange={e => set('name', e.target.value)} style={{ width: '100%', marginBottom: 18 }} />

          <div className="wf-label mute" style={{ marginBottom: 6 }}>LOGO (URL ou caminho /logos/…)</div>
          <input type="text" className="wf-input-el" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="/logos/empresa.jpeg" style={{ width: '100%', marginBottom: 18 }} />

          <div className="wf-label mute" style={{ marginBottom: 6 }}>LINKEDIN</div>
          <input
            type="url"
            className="wf-input-el"
            value={form.linkedin_url}
            onChange={e => set('linkedin_url', e.target.value)}
            placeholder="https://www.linkedin.com/company/…"
            style={{ width: '100%', marginBottom: 4, borderColor: linkedinValid ? undefined : '#E05145' }}
          />
          {!linkedinValid && <div className="hand" style={{ fontSize: 11, marginBottom: 18, color: '#E05145' }}>use uma URL http(s) válida</div>}
          <div className="mute hand" style={{ fontSize: 11, marginTop: 14, marginBottom: 24 }}>
            A URL de busca de vagas do scraper fica em <code>companies.json</code> e não é editável aqui.
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="wf-btn wf-btn-primary" disabled={saving} onClick={persist}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <span className="mute hand" style={{ fontSize: 12 }}>{savedLabel}</span>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }} className="toast-enter">
          <div className="wf-box hand" style={{ padding: '12px 18px', background: 'var(--c-ink)', color: '#fff', fontWeight: 700 }}>
            <span style={{ color: 'var(--c-teal)', marginRight: 10 }}>✓</span>{toast}
          </div>
        </div>
      )}
    </div>
  )
}
