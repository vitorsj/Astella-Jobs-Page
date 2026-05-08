import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import CompanyLogo from '../components/CompanyLogo.jsx'
import ModeChip from '../components/ModeChip.jsx'
import { JOBS, COMPANIES, COMPANY } from '../data/jobs.js'
import { useLang } from '../context/LangContext.jsx'

const ALL_AREAS  = ['Engineering', 'Product', 'Design', 'Data', 'Sales', 'CS', 'Operations', 'Marketing']
const ALL_LEVELS = ['Junior', 'Mid', 'Senior', 'Lead']
const ALL_LOCS   = ['São Paulo', 'Remoto', 'Florianópolis', 'Curitiba', 'Rio de Janeiro', 'Joinville']
const ALL_MODES  = ['Remoto', 'Híbrido', 'Presencial']

function FilterSection({ title, items, selected, onToggle, renderLabel }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom: 18 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="hand"
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          fontWeight: 700, fontSize: 13, marginBottom: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--c-ink)',
        }}
      >
        <span>{title}</span>
        <span className="mute">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {items.map(item => (
            <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="wf-check"
                checked={selected.includes(item)}
                onChange={() => onToggle(item)}
              />
              <span className="hand" style={{ fontSize: 13, color: 'var(--c-mute)' }}>
                {renderLabel ? renderLabel(item) : item}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function JobBoardV1() {
  const { lang, t } = useLang()
  const [search,       setSearch]       = useState('')
  const [selCompanies, setSelCompanies] = useState([])
  const [selAreas,     setSelAreas]     = useState([])
  const [selLevels,    setSelLevels]    = useState([])
  const [selLocs,      setSelLocs]      = useState([])
  const [selModes,     setSelModes]     = useState([])
  const [showing,      setShowing]      = useState(12)

  const titleOf = j => j.title[lang] || j.title.pt
  const levelOf = l => t.levels[l] || l
  const areaOf  = a => t.areas[a]  || a

  const filtered = useMemo(() => JOBS.filter(j => {
    const q = search.toLowerCase()
    if (q && !titleOf(j).toLowerCase().includes(q) && !COMPANY[j.company].name.toLowerCase().includes(q)) return false
    if (selCompanies.length && !selCompanies.includes(j.company)) return false
    if (selAreas.length     && !selAreas.includes(j.area))        return false
    if (selLevels.length    && !selLevels.includes(j.level))      return false
    if (selLocs.length      && !selLocs.includes(j.loc))          return false
    if (selModes.length     && !selModes.includes(j.mode))        return false
    return true
  }), [search, selCompanies, selAreas, selLevels, selLocs, selModes, lang])

  const visible = filtered.slice(0, showing)

  const toggle = (setter, val) => setter(prev =>
    prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
  )
  const clearAll = () => {
    setSelCompanies([]); setSelAreas([]); setSelLevels([])
    setSelLocs([]);      setSelModes([]); setSearch('')
  }

  const activeChips = [
    ...selCompanies.map(v => ({ label: COMPANY[v].name, clear: () => toggle(setSelCompanies, v) })),
    ...selAreas.map(v     => ({ label: areaOf(v),        clear: () => toggle(setSelAreas, v) })),
    ...selLevels.map(v    => ({ label: levelOf(v),       clear: () => toggle(setSelLevels, v) })),
    ...selLocs.map(v      => ({ label: v,                clear: () => toggle(setSelLocs, v) })),
    ...selModes.map(v     => ({ label: t.modes[v] || v,  clear: () => toggle(setSelModes, v) })),
  ]

  return (
    <div style={{ background: 'var(--c-paper)', minHeight: '100vh' }}>
      <TopNav />

      {/* Hero */}
      <div style={{ padding: '32px 32px 18px' }}>
        <div className="wf-label mute" style={{ marginBottom: 8 }}>{t.hero_eyebrow}</div>
        <h1 className="wf-h1">
          <span className="wf-underline">{t.tagline}</span>
        </h1>
        <p className="mute" style={{ marginTop: 10, maxWidth: 620, fontFamily: 'var(--wf-body)' }}>{t.sub}</p>

        {/* Search row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              opacity: 0.4, fontSize: 16, pointerEvents: 'none',
            }}>⌕</span>
            <input
              type="text"
              className="wf-input-el"
              style={{ paddingLeft: 32 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.search}
            />
          </div>

          {/* View switcher */}
          <div style={{ display: 'flex', border: '1.5px solid var(--c-line)' }}>
            {[
              { to: '/',        label: t.list  },
              { to: '/jobs/v2', label: t.cards },
              { to: '/jobs/v3', label: t.table },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="hand"
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 700,
                  background: to === '/' ? 'var(--c-ink)' : 'transparent',
                  color: to === '/' ? '#fff' : 'var(--c-mute)',
                  textDecoration: 'none',
                  borderRight: to !== '/jobs/v3' ? '1.5px solid var(--c-line)' : 'none',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <span className="wf-label mute" style={{ marginRight: 4 }}>{t.filters}:</span>
            {activeChips.map((chip, i) => (
              <button
                key={i}
                onClick={chip.clear}
                className="wf-chip wf-chip-on"
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {chip.label} ×
              </button>
            ))}
            <button onClick={clearAll} className="wf-btn wf-btn-ghost wf-btn-sm">{t.clear}</button>
          </div>
        )}
      </div>

      {/* Main 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr' }}>
        {/* Filter sidebar */}
        <aside style={{
          borderTop: '1.5px solid var(--c-line)',
          borderRight: '1.5px solid var(--c-line)',
          padding: 20,
          background: 'var(--c-paper)',
          position: 'sticky',
          top: 0,
          maxHeight: 'calc(100vh - 56px)',
          overflowY: 'auto',
          alignSelf: 'start',
        }}>
          <div className="wf-label" style={{ marginBottom: 12 }}>{t.filters}</div>

          <FilterSection title={t.company}  items={COMPANIES.map(c => c.id)} selected={selCompanies} onToggle={v => toggle(setSelCompanies, v)} renderLabel={id => COMPANY[id].name} />
          <FilterSection title={t.role}     items={ALL_AREAS}                 selected={selAreas}     onToggle={v => toggle(setSelAreas, v)}     renderLabel={a => t.areas[a] || a} />
          <FilterSection title={t.level}    items={ALL_LEVELS}                selected={selLevels}    onToggle={v => toggle(setSelLevels, v)}    renderLabel={l => t.levels[l] || l} />
          <FilterSection title={t.location} items={ALL_LOCS}                  selected={selLocs}      onToggle={v => toggle(setSelLocs, v)} />
          <FilterSection title={t.mode}     items={ALL_MODES}                  selected={selModes}     onToggle={v => toggle(setSelModes, v)}     renderLabel={m => t.modes[m] || m} />

          {activeChips.length > 0 && (
            <button onClick={clearAll} className="wf-btn wf-btn-ghost wf-btn-sm" style={{ marginTop: 6 }}>{t.clear}</button>
          )}
        </aside>

        {/* Jobs list */}
        <div style={{ borderTop: '1.5px solid var(--c-line)' }}>
          {/* List header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '12px 24px',
            borderBottom: '1.5px solid var(--c-line3)',
          }}>
            <span className="hand" style={{ fontWeight: 700 }}>
              {filtered.length} <span className="mute" style={{ fontWeight: 400 }}>{t.jobs}</span>
            </span>
            <span style={{ flex: 1 }} />
            <span className="hand mute" style={{ fontSize: 13 }}>{t.sort_recent} ▾</span>
          </div>

          {/* Rows */}
          {visible.map(job => (
            <a
              key={job.id}
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 24px',
                borderBottom: '1.5px dashed var(--c-line3)',
                textDecoration: 'none',
                color: 'inherit',
              }}
              className="job-row"
            >
              <CompanyLogo id={job.company} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                  <span className="hand" style={{ fontWeight: 700, fontSize: 16 }}>{titleOf(job)}</span>
                  {job.posted === '1d' && (
                    <span className="wf-chip wf-chip-teal wf-chip-sm">{t.new_today}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }} className="mute hand">
                  <span style={{ fontWeight: 700, color: 'var(--c-ink)' }}>{COMPANY[job.company].name}</span>
                  <span>·</span><span>{areaOf(job.area)}</span>
                  <span>·</span><span>{levelOf(job.level)}</span>
                  <span>·</span><span>{job.loc}</span>
                </div>
              </div>
              <ModeChip mode={job.mode} sm />
              <span className="mute hand" style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{job.posted}</span>
              <span className="hand" style={{ fontWeight: 700, fontSize: 18, color: 'var(--c-mute)' }}>↗</span>
            </a>
          ))}

          {showing < filtered.length && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 24px' }}>
              <button onClick={() => setShowing(s => s + 12)} className="wf-btn wf-btn-ghost">
                {t.load_more}
              </button>
            </div>
          )}

          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <p className="hand mute">Nenhuma vaga encontrada.</p>
            </div>
          )}
        </div>
      </div>

      <style>{`.job-row:hover { background: var(--c-shade); }`}</style>
    </div>
  )
}
