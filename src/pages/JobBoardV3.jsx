import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import CompanyLogo from '../components/CompanyLogo.jsx'
import ModeChip from '../components/ModeChip.jsx'
import { JOBS, COMPANIES, COMPANY } from '../data/jobs.js'
import { useLang } from '../context/LangContext.jsx'

const ALL_AREAS  = ['Engineering', 'Product', 'Design', 'Data', 'Sales', 'CS', 'Operations', 'Marketing']
const ALL_LEVELS = ['Junior', 'Mid', 'Senior', 'Lead']
const ALL_MODES  = ['Remoto', 'Híbrido', 'Presencial']
const PAGE_SIZE  = 14

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`wf-chip wf-chip-sm${active ? ' wf-chip-on' : ''}`}
      style={{ cursor: 'pointer', border: active ? 'none' : undefined }}
    >
      {label}
    </button>
  )
}

export default function JobBoardV3() {
  const { lang, t } = useLang()
  const [selCompany, setSelCompany] = useState('')
  const [selArea,    setSelArea]    = useState('')
  const [selLevel,   setSelLevel]   = useState('')
  const [selMode,    setSelMode]    = useState('')
  const [page,       setPage]       = useState(1)

  const titleOf = j => j.title[lang] || j.title.pt
  const levelOf = l => t.levels[l] || l
  const areaOf  = a => t.areas[a]  || a

  const filtered = useMemo(() => JOBS.filter(j => {
    if (selCompany && j.company !== selCompany) return false
    if (selArea    && j.area    !== selArea)    return false
    if (selLevel   && j.level   !== selLevel)   return false
    if (selMode    && j.mode    !== selMode)    return false
    return true
  }), [selCompany, selArea, selLevel, selMode])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const chipToggle = (val, setter, cur) => { setter(cur === val ? '' : val); setPage(1) }

  const COL = '1.7fr 1.4fr 0.8fr 0.7fr 1fr 0.8fr 60px'

  return (
    <div style={{ background: 'var(--c-paper)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNav />

      {/* Compact hero */}
      <div style={{
        padding: '28px 32px 18px',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto',
        gap: 32, alignItems: 'center',
        borderBottom: '1.5px solid var(--c-line)',
      }}>
        <div>
          <div className="hand" style={{ fontWeight: 700, fontSize: 64, lineHeight: 1, color: 'var(--c-ink)' }}>{JOBS.length}</div>
          <div className="wf-label mute">{t.jobs} {t.open_roles}</div>
        </div>
        <div>
          <div className="wf-label mute" style={{ marginBottom: 6 }}>{t.hero_eyebrow}</div>
          <h2 className="wf-h2">{t.tagline}</h2>
          <p className="mute" style={{ marginTop: 6, fontSize: 13, fontFamily: 'var(--wf-body)' }}>{t.sub}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="wf-label mute">{t.updated}</div>
          <div className="hand" style={{ fontWeight: 700, marginTop: 4 }}>{t.ago} 12 min</div>
          <div className="hand mute" style={{ fontSize: 11, marginTop: 2 }}>LinkedIn · Gupy · Lever</div>
        </div>
      </div>

      {/* Inline chip filters */}
      <div style={{ padding: '14px 32px', borderBottom: '1.5px solid var(--c-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: t.company, items: COMPANIES.map(c => ({ val: c.id, label: c.name })), cur: selCompany, setter: setSelCompany },
          { label: t.role,    items: ALL_AREAS.map(a => ({ val: a, label: t.areas[a] || a })),   cur: selArea,    setter: setSelArea },
          { label: t.level,   items: ALL_LEVELS.map(l => ({ val: l, label: t.levels[l] || l })), cur: selLevel,   setter: setSelLevel },
          { label: t.mode,    items: ALL_MODES.map(m => ({ val: m, label: t.modes[m] || m })),   cur: selMode,    setter: setSelMode },
        ].map(({ label, items, cur, setter }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="wf-label mute" style={{ width: 90, flexShrink: 0 }}>{label}</span>
            <Chip label={t.all} active={!cur} onClick={() => chipToggle('', setter, cur)} />
            {items.map(({ val, label: lbl }) => (
              <Chip key={val} label={lbl} active={cur === val} onClick={() => chipToggle(val, setter, cur)} />
            ))}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: COL, alignItems: 'center',
          padding: '10px 32px',
          borderBottom: '1.5px solid var(--c-line)',
          background: 'var(--c-paper2)',
          fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          fontFamily: 'var(--wf-hand)', fontWeight: 700,
        }}>
          <span>{lang === 'pt' ? 'Vaga' : 'Role'} ↑</span>
          <span>{t.company}</span>
          <span>{t.role}</span>
          <span>{t.level}</span>
          <span>{t.location}</span>
          <span>{t.mode}</span>
          <span style={{ textAlign: 'right' }}>{lang === 'pt' ? 'Há' : 'Ago'}</span>
        </div>

        {visible.map(job => (
          <a
            key={job.id}
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'grid', gridTemplateColumns: COL,
              alignItems: 'center', padding: '10px 32px', fontSize: 13,
              borderBottom: '1px dashed var(--c-line3)',
              textDecoration: 'none', color: 'inherit', cursor: 'pointer',
            }}
            className="table-row-hover"
          >
            <span className="hand wf-truncate" style={{ fontWeight: 700 }}>{titleOf(job)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <CompanyLogo id={job.company} size="sm" />
              <span className="hand wf-truncate">{COMPANY[job.company].name}</span>
            </span>
            <span className="hand">{areaOf(job.area)}</span>
            <span className="hand">{levelOf(job.level)}</span>
            <span className="hand wf-truncate">{job.loc}</span>
            <span><ModeChip mode={job.mode} sm /></span>
            <span className="hand mute" style={{ textAlign: 'right' }}>{job.posted}</span>
          </a>
        ))}

        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p className="hand mute">Nenhuma vaga encontrada.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 32px', borderTop: '1.5px solid var(--c-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="hand mute" style={{ fontSize: 13 }}>
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* View switcher */}
          <div style={{ display: 'flex', border: '1.5px solid var(--c-line)', marginRight: 8 }}>
            {[
              { to: '/',        label: t.list  },
              { to: '/jobs/v2', label: t.cards },
              { to: '/jobs/v3', label: t.table },
            ].map(({ to, label }) => (
              <Link key={to} to={to} className="hand" style={{
                padding: '5px 10px', fontSize: 12, fontWeight: 700,
                background: to === '/jobs/v3' ? 'var(--c-ink)' : 'transparent',
                color: to === '/jobs/v3' ? '#fff' : 'var(--c-mute)',
                textDecoration: 'none',
                borderRight: to !== '/jobs/v3' ? '1.5px solid var(--c-line)' : 'none',
                display: 'flex', alignItems: 'center',
              }}>
                {label}
              </Link>
            ))}
          </div>

          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="wf-btn wf-btn-ghost wf-btn-sm" style={{ opacity: page === 1 ? 0.3 : 1 }}>←</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`wf-chip wf-chip-sm${p === page ? ' wf-chip-on' : ''}`}
              style={{ cursor: 'pointer', border: p === page ? 'none' : undefined }}>
              {p}
            </button>
          ))}

          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="wf-btn wf-btn-ghost wf-btn-sm" style={{ opacity: page === totalPages ? 0.3 : 1 }}>→</button>
        </div>
      </div>

      <style>{`.table-row-hover:hover { background: var(--c-shade); }`}</style>
    </div>
  )
}
