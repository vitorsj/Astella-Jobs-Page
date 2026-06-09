import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { COMPANIES, ALL_JOBS } from '../data/jobs.js'
import { getOverrides, saveManualJob, logout } from '../lib/adminApi.js'
import { isHttpUrlOrEmpty, saveErrorMessage } from '../lib/adminShared.js'

const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead']
const MODES = ['Remoto', 'Híbrido', 'Presencial']
const STATUSES = ['rascunho', 'publicada', 'arquivada']

// id casa com JOB_ID_RE (/^[A-Za-z0-9:_-]{1,80}$/) e é único contra ALL_JOBS +
// manual_jobs vivos. charset 'manual:<slug>:<base36>' ⊂ RE, bem abaixo de 80.
function genManualId(companySlug, existingIds) {
  const base = `manual:${companySlug}:${Date.now().toString(36)}`
  let id = base
  let n = 2
  while (existingIds.has(id)) id = `${base}-${n++}`
  return id
}

const BLANK = {
  company: '', title_pt: '', title_en: '', area: '', level: 'Mid',
  loc: '', mode: 'Presencial', status: 'rascunho', url: '',
  featured: false, bilingual: false, confidential: false, hidden: false,
}

// Criação de VAGA MANUAL. Página própria (não usa o editor, que depende de uma
// vaga existente). Empresa vem do select das existentes — não cria empresa.
export default function AdminManualJobEditor() {
  const navigate = useNavigate()
  const [liveOverrides, setLiveOverrides] = useState(null)
  const [form, setForm] = useState({ ...BLANK, company: COMPANIES[0]?.id || '' })
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [createdNote, setCreatedNote] = useState(null)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    let alive = true
    getOverrides().then(d => { if (alive) setLiveOverrides(d || {}) }).catch(() => { if (alive) setLiveOverrides({}) })
    return () => { alive = false }
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const urlValid = isHttpUrlOrEmpty(form.url)
  const canSave = !!form.company && !!form.title_pt.trim() && urlValid && !saving

  async function persist() {
    if (!canSave) {
      if (!form.company) showToast('Selecione a empresa.')
      else if (!form.title_pt.trim()) showToast('Título (PT) é obrigatório.')
      else if (!urlValid) showToast('Link inválido — use uma URL http(s).')
      return
    }
    setSaving(true)
    const existing = new Set([...ALL_JOBS.map(j => j.id), ...((liveOverrides?.manual_jobs || []).map(j => j.id))])
    const job = {
      id: genManualId(form.company, existing),
      company: form.company,
      title_pt: form.title_pt.trim(),
      title_en: form.title_en.trim() || form.title_pt.trim(),
      area: form.area.trim() || 'Outros',
      level: form.level,
      loc: form.loc.trim(),
      mode: form.mode,
      status: form.status,
      url: form.url.trim(),
      featured: form.featured,
      bilingual: form.bilingual,
      confidential: form.confidential,
      hidden: form.hidden,
      source: 'Manual',
    }
    const { ok, status, error } = await saveManualJob(job)
    setSaving(false)
    if (ok) {
      // NÃO redireciona para /admin/edit/:id — o id só entra no bundle no próximo
      // build (~1 min); até lá não está em ALL_JOBS. Mostramos confirmação aqui.
      setCreatedNote(job.title_pt)
      setForm({ ...BLANK, company: form.company })
      showToast('Vaga manual criada.')
    } else {
      showToast(saveErrorMessage(status, error, 'criar'))
    }
  }

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
          <span className="mute hand" style={{ fontSize: 12 }}>/ vagas / nova manual</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/admin')} className="wf-chip wf-chip-sm" style={{ cursor: 'pointer' }}>← dashboard</button>
          <button onClick={async () => { await logout(); window.location.reload() }} className="wf-chip wf-chip-sm" style={{ cursor: 'pointer' }}>sair</button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', padding: 28, maxWidth: 720, width: '100%', margin: '0 auto' }}>
        <div className="wf-label mute">VAGA · manual</div>
        <h2 className="wf-h2" style={{ marginTop: 4, marginBottom: 20 }}>{form.title_pt || 'Nova vaga manual'}</h2>

        {createdNote && (
          <div className="wf-box" style={{ padding: 14, marginBottom: 20, borderColor: 'var(--c-teal)' }}>
            <div className="hand" style={{ fontSize: 13, fontWeight: 700 }}>“{createdNote}” criada.</div>
            <div className="mute hand" style={{ fontSize: 12, marginTop: 4 }}>
              Aparece no painel e no site em ~1 min (após o rebuild). Você pode criar outra abaixo ou
              <button onClick={() => navigate('/admin')} className="hand" style={{ background: 'none', border: 'none', color: 'var(--c-teal)', cursor: 'pointer', padding: '0 4px', fontWeight: 700 }}>voltar ao painel</button>.
            </div>
          </div>
        )}

        <div className="wf-label mute" style={{ marginBottom: 6 }}>EMPRESA *</div>
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <select className="wf-select-el" style={{ width: '100%' }} value={form.company} onChange={e => set('company', e.target.value)}>
            {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 11, opacity: 0.5 }}>▾</span>
        </div>

        <div className="wf-label mute" style={{ marginBottom: 6 }}>TÍTULO (PT-BR) *</div>
        <input type="text" className="wf-input-el" value={form.title_pt} onChange={e => set('title_pt', e.target.value)} style={{ width: '100%', marginBottom: 18 }} />

        <div className="wf-label mute" style={{ marginBottom: 6 }}>TÍTULO (EN)</div>
        <input type="text" className="wf-input-el" value={form.title_en} onChange={e => set('title_en', e.target.value)} placeholder="(usa o PT se vazio)" style={{ width: '100%', marginBottom: 18 }} />

        {/* metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div>
            <div className="wf-label mute" style={{ marginBottom: 6 }}>ÁREA</div>
            <input type="text" className="wf-input-el" style={{ width: '100%', height: 36 }} value={form.area} onChange={e => set('area', e.target.value)} placeholder="Outros" />
          </div>
          <div>
            <div className="wf-label mute" style={{ marginBottom: 6 }}>SENIORIDADE</div>
            <div style={{ position: 'relative' }}>
              <select className="wf-select-el" style={{ width: '100%' }} value={form.level} onChange={e => set('level', e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 11, opacity: 0.5 }}>▾</span>
            </div>
          </div>
          <div>
            <div className="wf-label mute" style={{ marginBottom: 6 }}>LOCALIZAÇÃO</div>
            <input type="text" className="wf-input-el" style={{ width: '100%', height: 36 }} value={form.loc} onChange={e => set('loc', e.target.value)} />
          </div>
          <div>
            <div className="wf-label mute" style={{ marginBottom: 6 }}>MODELO</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {MODES.map(m => (
                <button type="button" key={m} onClick={() => set('mode', m)} className={`wf-chip wf-chip-sm${form.mode === m ? ' wf-chip-on' : ''}`} style={{ flex: 1, cursor: 'pointer', justifyContent: 'center', border: form.mode === m ? 'none' : undefined }}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="wf-label mute" style={{ marginBottom: 6 }}>LINK DE CANDIDATURA</div>
        <input
          type="url"
          className="wf-input-el"
          value={form.url}
          onChange={e => set('url', e.target.value)}
          placeholder="https://…"
          style={{ width: '100%', marginBottom: 4, borderColor: urlValid ? undefined : '#E05145' }}
        />
        {!urlValid && <div className="hand" style={{ fontSize: 11, marginBottom: 14, color: '#E05145' }}>use uma URL http(s) válida</div>}

        {/* status + sinais */}
        <div className="wf-label mute" style={{ margin: '18px 0 8px' }}>STATUS</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {STATUSES.map(s => (
            <button type="button" key={s} onClick={() => set('status', s)} className={`wf-chip wf-chip-sm${form.status === s ? ' wf-chip-on' : ''}`} style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', border: form.status === s ? 'none' : undefined }}>{s}</button>
          ))}
        </div>

        <div className="wf-label mute" style={{ marginBottom: 8 }}>SINAIS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {[
            { key: 'featured', label: '★ Em destaque (homepage)' },
            { key: 'bilingual', label: 'Bilíngue (mostrar EN)' },
            { key: 'confidential', label: 'Vaga sigilosa (ocultar empresa)' },
            { key: 'hidden', label: 'Ocultar do board público' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" className="wf-check" checked={form[key]} onChange={() => set(key, !form[key])} />
              <span className="hand" style={{ fontSize: 13 }}>{label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="wf-btn wf-btn-primary" disabled={!canSave} onClick={persist}>
            {saving ? 'Criando…' : 'Criar vaga manual'}
          </button>
          <span className="mute hand" style={{ fontSize: 12 }}>obrigatórios: empresa e título (PT)</span>
        </div>
      </div>

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
