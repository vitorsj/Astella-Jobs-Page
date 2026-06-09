import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { COMPANIES, COMPANY, JOBS, ALL_JOBS, RAW_JOBS_PAYLOAD } from '../data/jobs.js'
import syncLogData from '../data/sync_log.json'
import { logout, getClicks } from '../lib/adminApi.js'

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

const JOBS_PAGE_SIZE = 25

// Escapa um campo para CSV (aspas + vírgula + quebra de linha).
function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const SCRAPERS = [
  { name: 'LinkedIn', kind: 'Apify', freq: 'cron seg 9h + manual', count: `${COMPANIES.length} empresas`, status: 'ok' },
]

// Cada aba renderiza uma seção própria (ver `views` em AdminDashboard).
const NAV_ITEMS = [
  'Visão geral', 'Empresas investidas', 'Vagas', 'Fontes & scrapers',
  'Logs de sync', 'Métricas',
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
  const [clicks, setClicks] = useState({})
  useEffect(() => { getClicks().then(setClicks).catch(() => setClicks({})) }, [])

  const [jobQuery, setJobQuery] = useState('')
  const [jobPage, setJobPage] = useState(0)

  const totalClicks = useMemo(
    () => Object.values(clicks).reduce((sum, n) => sum + n, 0),
    [clicks],
  )
  // Metadata por id de TODAS as vagas que já existiram: ativas + manuais (ALL_JOBS)
  // + inativas que o sync mantém no payload (is_active:false). Permite atribuir
  // cliques históricos a uma vaga/empresa mesmo depois dela sair do board.
  const jobMeta = useMemo(() => {
    const map = {}
    for (const j of ALL_JOBS) {
      map[j.id] = {
        title: j.title?.pt || j.rawTitle || '—',
        companyId: j.company,
        companyName: COMPANY[j.company]?.name || j.company,
        active: true,
      }
    }
    for (const j of RAW_JOBS_PAYLOAD.jobs) {
      if (j.is_active || map[j.id]) continue
      map[j.id] = {
        title: j.title || '—',
        companyId: j.company_slug,
        companyName: COMPANY[j.company_slug]?.name || j.company_slug,
        active: false,
      }
    }
    return map
  }, [])
  const clicksByCompany = useMemo(() => {
    const out = {}
    for (const [id, n] of Object.entries(clicks)) {
      const meta = jobMeta[id]
      if (!n || !meta) continue // clique órfão (vaga sem metadata) não atribui a empresa
      out[meta.companyId] = (out[meta.companyId] || 0) + n
    }
    return out
  }, [clicks, jobMeta])
  const topJobs = useMemo(
    () => Object.entries(clicks)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => {
        const meta = jobMeta[id]
        return {
          id,
          count: n,
          title: meta?.title || 'Vaga removida',
          companyName: meta ? meta.companyName : '—',
          active: meta ? meta.active : false,
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    [clicks, jobMeta],
  )
  const companyClicksRanked = useMemo(
    () => COMPANIES
      .map(c => ({ c, n: clicksByCompany[c.id] || 0 }))
      .sort((a, b) => b.n - a.n),
    [clicksByCompany],
  )
  const jobsWithClicks = useMemo(
    () => Object.values(clicks).filter(n => n > 0).length,
    [clicks],
  )
  const sortedJobs = useMemo(
    () => [...ALL_JOBS].sort((a, b) =>
      (COMPANY[a.company]?.name || a.company).localeCompare(COMPANY[b.company]?.name || b.company) ||
      (a.title?.pt || a.rawTitle || '').localeCompare(b.title?.pt || b.rawTitle || '')
    ),
    [],
  )

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

  // ---- Blocos reutilizáveis (cada aba compõe os que precisa) ----

  const kpisBlock = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 22 }}>
      {[
        ['Vagas publicadas',  String(JOBS.length), `${ALL_JOBS.length} no total`],
        ['Empresas',          String(COMPANIES.length), `${sourceCount} fonte ativa`],
        ['Ocultas',           String(hiddenCount), 'fora do board público'],
        ['Editadas',          String(editedCount), 'com override do admin'],
        ['Cliques',           String(totalClicks), 'em vagas · total'],
      ].map(([label, val, sub]) => (
        <div key={label} className="wf-box" style={{ padding: 16 }}>
          <div className="wf-label mute" style={{ fontSize: 10 }}>{label}</div>
          <div className="hand" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.05, marginTop: 4 }}>{val}</div>
          <div className="mute hand" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
        </div>
      ))}
    </div>
  )

  const companiesTable = () => (
    <div className="wf-box" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
        <span className="wf-label">Empresas investidas</span>
        <span className="mute hand" style={{ fontSize: 12 }}>{COMPANIES.length} · clique p/ editar empresa</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.5fr 0.6fr 0.7fr 50px',
        fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
        fontFamily: 'var(--wf-hand)', fontWeight: 700, color: 'var(--c-mute)',
        padding: '8px 16px', borderBottom: '1px dashed var(--c-line3)',
      }}>
        <span>Empresa</span><span>Fonte</span><span>Vagas</span><span>Cliques</span><span>Status</span><span></span>
      </div>
      {COMPANIES.map(c => (
        <button
          key={c.id}
          onClick={() => navigate(`/admin/company/${c.id}`)}
          className="admin-company-row"
          style={{
            display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.5fr 0.6fr 0.7fr 50px',
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
          <span>{clicksByCompany[c.id] || 0}</span>
          <span><StatusBadge status={companyStatus(c.id)} /></span>
          <span className="mute">⋯</span>
        </button>
      ))}
    </div>
  )

  const syncLogBlock = () => (
    <div className="wf-box" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
        <span className="wf-label">Logs de sincronização</span>
        <span className="mute hand" style={{ fontSize: 12 }}>
          {latestRun ? `${relativeTime(latestRun.ts)} · ${latestRun.total_active} ativas` : 'sem sync registrado'}
        </span>
      </div>
      {!latestRun && (
        <div className="mute hand" style={{ padding: 16, fontSize: 12 }}>
          Nenhum sync registrado ainda. O cron roda toda segunda às 9h.
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
  )

  const topJobsBlock = () => (
    <div className="wf-box" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
        <span className="wf-label">Vagas mais clicadas</span>
        <span className="mute hand" style={{ fontSize: 12 }}>{totalClicks} cliques no total</span>
      </div>
      {topJobs.length === 0 && (
        <div className="mute hand" style={{ padding: 16, fontSize: 12 }}>
          Nenhum clique registrado ainda.
        </div>
      )}
      {topJobs.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 70px',
          fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          fontFamily: 'var(--wf-hand)', fontWeight: 700, color: 'var(--c-mute)',
          padding: '8px 16px', borderBottom: '1px dashed var(--c-line3)',
        }}>
          <span>Vaga</span><span>Empresa</span><span style={{ textAlign: 'right' }}>Cliques</span>
        </div>
      )}
      {topJobs.map(({ id, count, title, companyName, active }) => (
        <div key={id} style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 70px', alignItems: 'center',
          padding: '10px 16px', fontSize: 13, fontFamily: 'var(--wf-hand)',
          borderBottom: '1px dashed var(--c-line3)',
        }}>
          <span style={{ fontWeight: 700 }}>
            {title}
            {!active && <span className="mute" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>· encerrada</span>}
          </span>
          <span className="mute">{companyName}</span>
          <span className="hand" style={{ textAlign: 'right', fontWeight: 700 }}>{count}</span>
        </div>
      ))}
    </div>
  )

  const scrapersBlock = () => (
    <div className="wf-box" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="wf-label">Fontes & scrapers</span>
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
            <div className="hand" style={{ fontSize: 12 }}>{s.count} · {s.freq}</div>
          </div>
        ))}
      </div>
    </div>
  )

  const jobsTable = () => {
    const q = jobQuery.trim().toLowerCase()
    const filtered = q
      ? sortedJobs.filter(j =>
          (j.title?.pt || j.rawTitle || '').toLowerCase().includes(q) ||
          (COMPANY[j.company]?.name || j.company || '').toLowerCase().includes(q))
      : sortedJobs
    const pageCount = Math.max(1, Math.ceil(filtered.length / JOBS_PAGE_SIZE))
    const page = Math.min(jobPage, pageCount - 1)
    const pageJobs = filtered.slice(page * JOBS_PAGE_SIZE, (page + 1) * JOBS_PAGE_SIZE)
    return (
    <div className="wf-box" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
        <span className="wf-label">Vagas</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
          <input
            type="text"
            value={jobQuery}
            onChange={e => { setJobQuery(e.target.value); setJobPage(0) }}
            className="wf-input-el wf-input-sm"
            style={{ height: 28, fontSize: 12, width: 200 }}
            placeholder="buscar vaga ou empresa…"
          />
          <button type="button" className="wf-btn wf-btn-primary wf-btn-sm" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/edit/new')}>
            + nova vaga manual
          </button>
        </div>
      </div>
      <div style={{ padding: '6px 16px', fontSize: 11, fontFamily: 'var(--wf-hand)', color: 'var(--c-mute)', borderBottom: '1px dashed var(--c-line3)' }}>
        {filtered.length} de {ALL_JOBS.length} · {JOBS.length} publicadas · clique p/ editar
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.6fr 50px',
        fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
        fontFamily: 'var(--wf-hand)', fontWeight: 700, color: 'var(--c-mute)',
        padding: '8px 16px', borderBottom: '1px dashed var(--c-line3)',
      }}>
        <span>Vaga</span><span>Empresa</span><span>Status</span><span>Cliques</span><span></span>
      </div>
      {pageJobs.map(job => (
        <button
          key={job.id}
          onClick={() => navigate(`/admin/edit/${job.id}`)}
          className="admin-company-row"
          style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.6fr 50px',
            alignItems: 'center', padding: '10px 16px',
            fontSize: 13, fontFamily: 'var(--wf-hand)', width: '100%', textAlign: 'left',
            background: 'transparent', border: 'none', borderBottom: '1px dashed var(--c-line3)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.title?.pt || job.rawTitle || '—'}{job.hidden ? '  · oculta' : ''}
          </span>
          <span className="mute">{COMPANY[job.company]?.name || job.company}</span>
          <span>{job.status}</span>
          <span>{clicks[job.id] || 0}</span>
          <span className="mute">⋯</span>
        </button>
      ))}
      {pageJobs.length === 0 && (
        <div className="mute hand" style={{ padding: 16, fontSize: 12 }}>nenhuma vaga encontrada</div>
      )}
      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
          <button type="button" className="wf-chip wf-chip-sm" disabled={page === 0} style={{ cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }} onClick={() => setJobPage(page - 1)}>← anterior</button>
          <span className="mute hand" style={{ fontSize: 12 }}>{page + 1} / {pageCount}</span>
          <button type="button" className="wf-chip wf-chip-sm" disabled={page >= pageCount - 1} style={{ cursor: page >= pageCount - 1 ? 'default' : 'pointer', opacity: page >= pageCount - 1 ? 0.4 : 1 }} onClick={() => setJobPage(page + 1)}>próxima →</button>
        </div>
      )}
    </div>
    )
  }

  const clicksByCompanyTable = () => (
    <div className="wf-box" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
        <span className="wf-label">Cliques por empresa</span>
      </div>
      {companyClicksRanked.map(({ c, n }) => (
        <div key={c.id} style={{
          display: 'grid', gridTemplateColumns: '1fr 60px', alignItems: 'center',
          padding: '10px 16px', fontSize: 13, fontFamily: 'var(--wf-hand)',
          borderBottom: '1px dashed var(--c-line3)',
        }}>
          <span style={{ fontWeight: 700 }}>{c.name}</span>
          <span className="hand" style={{ textAlign: 'right', fontWeight: 700 }}>{n}</span>
        </div>
      ))}
    </div>
  )

  // Exporta os cliques (vaga, empresa, status, cliques) como CSV — client-side.
  function exportClicksCsv() {
    const rows = Object.entries(clicks)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => {
        const meta = jobMeta[id]
        return [meta?.title || 'Vaga removida', meta?.companyName || '—', meta?.active ? 'ativa' : 'encerrada', n]
      })
      .sort((a, b) => b[3] - a[3])
    const header = ['vaga', 'empresa', 'status', 'cliques']
    const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cliques-astella-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const metricsView = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button type="button" className="wf-btn wf-btn-ghost wf-btn-sm" style={{ cursor: 'pointer' }} disabled={totalClicks === 0} onClick={exportClicksCsv}>
          ↓ exportar CSV
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          ['Cliques · total',   String(totalClicks), 'em todas as vagas'],
          ['Vagas com clique',  String(jobsWithClicks), `de ${ALL_JOBS.length} vagas`],
          ['Empresa líder',     companyClicksRanked[0]?.n ? companyClicksRanked[0].c.name : '—', companyClicksRanked[0]?.n ? `${companyClicksRanked[0].n} cliques` : 'sem cliques ainda'],
        ].map(([label, val, sub]) => (
          <div key={label} className="wf-box" style={{ padding: 16 }}>
            <div className="wf-label mute" style={{ fontSize: 10 }}>{label}</div>
            <div className="hand" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.05, marginTop: 4 }}>{val}</div>
            <div className="mute hand" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
        {topJobsBlock()}
        {clicksByCompanyTable()}
      </div>
    </>
  )

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
            <div className="wf-label mute" style={{ marginBottom: 6 }}>ADMIN · {activeNav.toUpperCase()}</div>
            <h2 className="wf-h2">Job board <span className="mute" style={{ fontWeight: 400 }}>· {activeNav}</span></h2>
          </div>
        </div>

        {activeNav === 'Visão geral' && (
          <>
            {kpisBlock()}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
              {companiesTable()}
              {syncLogBlock()}
            </div>
            <div style={{ marginTop: 18 }}>{topJobsBlock()}</div>
            <div style={{ marginTop: 18 }}>{scrapersBlock()}</div>
          </>
        )}

        {activeNav === 'Empresas investidas' && companiesTable()}

        {activeNav === 'Vagas' && jobsTable()}

        {activeNav === 'Fontes & scrapers' && scrapersBlock()}

        {activeNav === 'Logs de sync' && syncLogBlock()}

        {activeNav === 'Métricas' && metricsView()}
      </main>

      <style>{`
        .admin-company-row:hover { background: var(--c-shade) !important; }
      `}</style>
    </div>
  )
}
