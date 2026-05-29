import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COMPANIES, JOBS, ALL_JOBS } from '../data/jobs.js'
import syncLogData from '../data/sync_log.json'
import { logout, triggerSync, addCompany } from '../lib/adminApi.js'

function relativeTime(iso) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.round(hrs / 24)}d`
}

const activeJobCount = companyId => ALL_JOBS.filter(j => j.company === companyId).length
const visibleJobCount = companyId => JOBS.filter(j => j.company === companyId).length
const firstJobOfCompany = companyId => ALL_JOBS.find(j => j.company === companyId)

const SCRAPERS = [
  { name: 'LinkedIn', kind: 'Apify', freq: 'cron seg 9h + manual', count: `${COMPANIES.length} empresas`, status: 'ok' },
]

const NAV_ITEMS = [
  'Visão geral', 'Empresas investidas', 'Vagas', 'Fontes & scrapers',
  'Logs de sync', 'Métricas', 'Equipe', 'Configurações',
]

const STATUS_DOT = { ok: '#56BBC2', warn: '#F3AF8A', err: '#E05145' }
const STATUS_BADGE = {
  ok:     { background: 'rgba(86,187,194,0.15)', color: '#1a7a82',   border: 'rgba(86,187,194,0.4)' },
  err:    { background: '#FEE',                   color: '#C0392B',   border: 'rgba(192,57,43,0.3)' },
  warn:   { background: '#FFF8E1',                color: '#B45309',   border: 'rgba(180,83,9,0.3)' },
  pausado:{ background: 'var(--c-shade)',          color: 'var(--c-mute)', border: 'var(--c-line3)' },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.pausado
  const labels = { ok: 'ok', err: 'erro', warn: 'atenção', pausado: 'pausado' }
  return (
    <span className="wf-chip wf-chip-sm" style={{ background: s.background, color: s.color, borderColor: s.border }}>
      {labels[status] || status}
    </span>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('Visão geral')
  const [toast, setToast] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [showNewCompany, setShowNewCompany] = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  async function onSync() {
    if (syncing) return
    setSyncing(true)
    const { ok, status, error } = await triggerSync()
    setSyncing(false)
    if (ok) showToast('Sync disparado no GitHub Actions (~2-3 min até atualizar).')
    else if (status === 0 || status >= 500) showToast('Indisponível (rode com `vercel dev` ou em produção).')
    else showToast(`Erro ao disparar sync: ${error || status}`)
  }

  const companyStatus = companyId => {
    const total = activeJobCount(companyId)
    if (total === 0) return 'pausado'
    if (visibleJobCount(companyId) === 0) return 'warn'
    return 'ok'
  }
  const jobCount = activeJobCount
  const sourceCount = [...new Set(JOBS.map(j => j.source))].length
  const hiddenCount = ALL_JOBS.filter(j => j.hidden).length
  const editedCount = ALL_JOBS.filter(j => j.edited).length
  const latestRun = syncLogData.runs?.[0] || null
  const syncLogs = (latestRun?.lines || []).map(line => {
    const isSkip = line.startsWith('skip ')
    const colon = line.indexOf(':')
    const head = colon >= 0 ? line.slice(0, colon) : line
    const msg = colon >= 0 ? line.slice(colon + 1).trim() : ''
    return {
      status: isSkip ? 'warn' : 'ok',
      src: head.replace(/^(ok|skip)\s+/, ''),
      msg,
    }
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100vh', background: 'var(--c-paper2)' }}>
      {/* Sidebar */}
      <aside style={{
        borderRight: '1.5px solid var(--c-line)',
        background: 'var(--c-paper2)',
        padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: 4,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span className="wf-spiral" />
          <span className="wf-label" style={{ fontSize: 12 }}>ASTELLA · ADMIN</span>
        </div>

        {NAV_ITEMS.map(item => (
          <button
            key={item}
            onClick={() => setActiveNav(item)}
            className={`hand ${activeNav === item ? 'wf-nav-active' : 'wf-nav-item'}`}
            style={{ padding: '8px 10px', fontSize: 13, textAlign: 'left', background: activeNav === item ? '#fff' : 'transparent', cursor: 'pointer' }}
          >
            {item}
          </button>
        ))}

        <div className="wf-divider-dash" style={{ margin: '16px 0' }} />
        <div className="mute" style={{ fontSize: 11, padding: '0 10px 10px', fontFamily: 'var(--wf-body)' }}>
          sessão de admin
        </div>
        <button
          onClick={async () => { await logout(); window.location.reload() }}
          className="hand wf-nav-item"
          style={{ padding: '8px 10px', fontSize: 13, textAlign: 'left', background: 'transparent', cursor: 'pointer' }}
        >
          ↩ Sair
        </button>
      </aside>

      {/* Main content */}
      <main style={{ overflowY: 'auto', padding: 28 }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div className="wf-label mute" style={{ marginBottom: 6 }}>ADMIN · VISÃO GERAL</div>
            <h2 className="wf-h2">Job board <span className="mute" style={{ fontWeight: 400 }}>· Dashboard</span></h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={onSync} disabled={syncing} className="wf-btn wf-btn-ghost wf-btn-sm">{syncing ? '↻ disparando…' : '↻ Sincronizar agora'}</button>
            <button onClick={() => setShowNewCompany(true)} className="wf-btn wf-btn-primary">+ Nova empresa</button>
          </div>
        </div>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {[
            ['Vagas publicadas',  String(JOBS.length), `${ALL_JOBS.length} no total`],
            ['Empresas',          String(COMPANIES.length), `${sourceCount} fonte ativa`],
            ['Ocultas',           String(hiddenCount), 'fora do board público'],
            ['Editadas',          String(editedCount), 'com override do admin'],
          ].map(([label, val, sub]) => (
            <div key={label} className="wf-box" style={{ padding: 16 }}>
              <div className="wf-label mute" style={{ fontSize: 10 }}>{label}</div>
              <div className="hand" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.05, marginTop: 4 }}>{val}</div>
              <div className="mute hand" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* 2-col body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
          {/* Companies table */}
          <div className="wf-box" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
              <span className="wf-label">Empresas investidas</span>
              <span className="mute hand" style={{ fontSize: 12 }}>{COMPANIES.length} · ver todas</span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.6fr 0.7fr 60px',
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              fontFamily: 'var(--wf-hand)', fontWeight: 700, color: 'var(--c-mute)',
              padding: '8px 16px', borderBottom: '1px dashed var(--c-line3)',
            }}>
              <span>Empresa</span><span>Fonte</span><span>Vagas</span><span>Status</span><span></span>
            </div>
            {COMPANIES.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  const job = firstJobOfCompany(c.id)
                  if (job) navigate(`/admin/edit/${job.id}`)
                  else showToast(`${c.name} não tem vagas para editar.`)
                }}
                className="admin-company-row"
                style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.6fr 0.7fr 60px',
                  alignItems: 'center', padding: '10px 16px',
                  fontSize: 13, fontFamily: 'var(--wf-hand)', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none', borderBottom: '1px dashed var(--c-line3)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="wf-logo wf-logo-sm">{c.name.split(' ').map(w => w[0]).slice(0,2).join('')}</span>
                  <span style={{ fontWeight: 700 }}>{c.name}</span>
                </span>
                <span>{c.source}</span>
                <span>{jobCount(c.id)}</span>
                <span><StatusBadge status={companyStatus(c.id)} /></span>
                <span className="mute">⋯</span>
              </button>
            ))}
          </div>

          {/* Sync log */}
          <div className="wf-box" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
              <span className="wf-label">Logs de sincronização</span>
              <span className="mute hand" style={{ fontSize: 12 }}>
                {latestRun ? `${relativeTime(latestRun.ts)} · ${latestRun.total_active} ativas` : 'sem sync registrado'}
              </span>
            </div>
            {!latestRun && (
              <div className="mute hand" style={{ padding: 16, fontSize: 12 }}>
                Nenhum sync registrado ainda. Rode "Sincronizar agora" ou aguarde o cron.
              </div>
            )}
            {syncLogs.map(({ src, status, msg }, i) => (
              <div key={i} style={{
                padding: '9px 16px', borderBottom: '1px dashed var(--c-line3)',
                fontFamily: 'var(--wf-hand)', fontSize: 12,
                display: 'grid', gridTemplateColumns: '14px 1fr', gap: 10, alignItems: 'start',
              }}>
                <span style={{ width: 8, height: 8, marginTop: 4, display: 'inline-block', background: STATUS_DOT[status] || '#ccc', border: '1px solid var(--c-line)' }} />
                <div>
                  <span style={{ fontWeight: 700 }}>{src}</span>
                  <div className="mute" style={{ marginTop: 2 }}>{msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrapers */}
        <div style={{ marginTop: 18 }}>
          <div className="wf-box" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="wf-label">Fontes & scrapers</span>
              <button className="wf-btn wf-btn-ghost wf-btn-sm">+ adicionar fonte</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {SCRAPERS.map(s => (
                <div key={s.name} className="wf-box-paper" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="hand" style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mute hand" style={{ fontSize: 12, marginBottom: 8 }}>{s.kind}</div>
                  <div className="wf-divider-thin" />
                  <div className="hand" style={{ fontSize: 12, marginBottom: 8 }}>{s.count} · {s.freq}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="wf-btn wf-btn-ghost wf-btn-sm">configurar</button>
                    <button className="wf-btn wf-btn-ghost wf-btn-sm">↻ rodar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }} className="toast-enter">
          <div className="wf-box hand" style={{ padding: '12px 18px', background: 'var(--c-ink)', color: '#fff', fontWeight: 700 }}>
            <span style={{ color: 'var(--c-teal)', marginRight: 10 }}>✓</span>{toast}
          </div>
        </div>
      )}

      {showNewCompany && (
        <NewCompanyModal
          onClose={() => setShowNewCompany(false)}
          onCreated={company => {
            setShowNewCompany(false)
            showToast(`Empresa "${company.name}" adicionada. Entra no próximo sync.`)
          }}
        />
      )}

      <style>{`
        .admin-company-row:hover { background: var(--c-shade) !important; }
      `}</style>
    </div>
  )
}

function NewCompanyModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', linkedin_url: '', linkedin_search_url: '', logo_url: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (busy || !form.name.trim()) return
    setBusy(true)
    setError(null)
    const { ok, status, company, error } = await addCompany(form)
    setBusy(false)
    if (ok) { onCreated(company); return }
    if (error === 'company_exists') setError('Já existe uma empresa com esse slug.')
    else if (status === 0 || status >= 500) setError('Indisponível (rode com `vercel dev` ou em produção).')
    else setError(`Erro ao adicionar: ${error || status}`)
  }

  const field = (label, key, placeholder, hint) => (
    <div style={{ marginBottom: 12 }}>
      <div className="wf-label mute" style={{ marginBottom: 6 }}>{label}</div>
      <input
        type="text"
        className="wf-input-el"
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />
      {hint && <div className="mute hand" style={{ fontSize: 11, marginTop: 4 }}>{hint}</div>}
    </div>
  )

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="wf-box" style={{ padding: 28, width: 460, maxWidth: '100%', background: 'var(--c-paper2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h2 className="wf-h2">Nova empresa</h2>
          <button type="button" onClick={onClose} className="hand mute" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div className="mute hand" style={{ fontSize: 13, marginBottom: 18 }}>
          Adiciona em <code>companies.json</code>. O sync passa a buscar vagas dela no próximo run.
        </div>

        {field('NOME', 'name', 'Ex: Acme Tech')}
        {field('URL DA EMPRESA NO LINKEDIN', 'linkedin_url', 'https://www.linkedin.com/company/acme/')}
        {field('URL DE BUSCA DE VAGAS (LINKEDIN)', 'linkedin_search_url', 'https://www.linkedin.com/jobs/search?f_C=...', 'Sem isso o sync não busca vagas dela.')}
        {field('LOGO (URL OU /logos/…)', 'logo_url', '/logos/acme.jpeg')}

        {error && (
          <div className="hand" style={{ fontSize: 12, color: '#C0392B', background: '#FEE', border: '1px solid rgba(192,57,43,0.3)', borderRadius: 8, padding: '8px 10px', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} className="wf-btn wf-btn-ghost wf-btn-sm">cancelar</button>
          <button type="submit" className="wf-btn wf-btn-primary wf-btn-sm" disabled={busy || !form.name.trim()} style={{ opacity: busy || !form.name.trim() ? 0.6 : 1 }}>
            {busy ? 'Adicionando…' : 'Adicionar empresa'}
          </button>
        </div>
      </form>
    </div>
  )
}
