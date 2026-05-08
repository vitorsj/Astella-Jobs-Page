import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COMPANIES, JOBS } from '../data/jobs.js'

const SYNC_LOGS = [
  { time: '12:04', src: 'LinkedIn · RD Station',      status: 'ok', msg: '3 vagas / 0 alterações' },
  { time: '12:04', src: 'LinkedIn · Olist',           status: 'ok', msg: '3 vagas / 0 alterações' },
  { time: '12:03', src: 'LinkedIn · Conta Simples',   status: 'ok', msg: '2 vagas / 0 alterações' },
  { time: '12:02', src: 'LinkedIn · Asaas',           status: 'ok', msg: '2 vagas / 0 alterações' },
  { time: '12:01', src: 'LinkedIn · Dr. Consulta',    status: 'ok', msg: '1 vaga / 0 alterações' },
  { time: '12:00', src: 'LinkedIn · Trinks',          status: 'ok', msg: '1 vaga / 0 alterações' },
]

const SCRAPERS = [
  { name: 'LinkedIn', kind: 'fixture fake local', freq: '2x por dia no cron final', count: '6 empresas', status: 'ok' },
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

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const companyStatus = () => 'ok'
  const jobCount = id => JOBS.filter(j => j.company === id).length
  const sourceCount = [...new Set(JOBS.map(j => j.source))].length

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
        <div className="mute" style={{ fontSize: 11, padding: '0 10px', fontFamily: 'var(--wf-body)' }}>
          logado como<br />
          <span style={{ color: 'var(--c-ink)', fontWeight: 700, fontFamily: 'var(--wf-hand)' }}>daniel@astella.com.br</span>
        </div>
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
            <button onClick={() => showToast('Sincronização iniciada!')} className="wf-btn wf-btn-ghost wf-btn-sm">↻ Sincronizar agora</button>
            <button className="wf-btn wf-btn-primary">+ Nova empresa</button>
          </div>
        </div>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {[
            ['Vagas ativas',      String(JOBS.length), 'dados fake do sync local'],
            ['Empresas',          String(COMPANIES.length), `${sourceCount} fonte ativa`],
            ['Cliques (7d)',       '0', 'Plausible pendente'],
            ['Candidaturas (7d)', '0', 'via redirect'],
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
                onClick={() => navigate('/admin/edit/1')}
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
              <span className="mute hand" style={{ fontSize: 12 }}>últimas 24h</span>
            </div>
            {SYNC_LOGS.map(({ time, src, status, msg }, i) => (
              <div key={i} style={{
                padding: '9px 16px', borderBottom: '1px dashed var(--c-line3)',
                fontFamily: 'var(--wf-hand)', fontSize: 12,
                display: 'grid', gridTemplateColumns: '44px 1fr', gap: 10, alignItems: 'start',
              }}>
                <span className="mute">{time}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, display: 'inline-block', background: STATUS_DOT[status] || '#ccc', border: '1px solid var(--c-line)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700 }}>{src}</span>
                  </div>
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

      <style>{`
        .admin-company-row:hover { background: var(--c-shade) !important; }
      `}</style>
    </div>
  )
}
