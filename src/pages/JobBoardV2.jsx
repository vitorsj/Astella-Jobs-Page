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

export default function JobBoardV2() {
  const { lang, t } = useLang()
  const [search,   setSearch]   = useState('')
  const [selArea,  setSelArea]  = useState('')
  const [selLevel, setSelLevel] = useState('')
  const [selLoc,   setSelLoc]   = useState('')
  const [selMode,  setSelMode]  = useState('')
  const [expanded, setExpanded] = useState({})

  const titleOf = j => j.title[lang] || j.title.pt
  const levelOf = l => t.levels[l] || l
  const areaOf  = a => t.areas[a]  || a
  const allLocs = [...new Set(JOBS.map(j => j.loc))]

  const filteredJobs = useMemo(() => JOBS.filter(j => {
    const q = search.toLowerCase()
    if (q && !titleOf(j).toLowerCase().includes(q) && !COMPANY[j.company].name.toLowerCase().includes(q)) return false
    if (selArea  && j.area  !== selArea)  return false
    if (selLevel && j.level !== selLevel) return false
    if (selLoc   && j.loc   !== selLoc)   return false
    if (selMode  && j.mode  !== selMode)  return false
    return true
  }), [search, selArea, selLevel, selLoc, selMode, lang])

  const grouped = useMemo(() => {
    const g = {}
    filteredJobs.forEach(j => { (g[j.company] = g[j.company] || []).push(j) })
    return g
  }, [filteredJobs])

  const companyIds = COMPANIES.map(c => c.id).filter(id => grouped[id]?.length)
  const clearAll = () => { setSearch(''); setSelArea(''); setSelLevel(''); setSelLoc(''); setSelMode('') }

  return (
    <div style={{ background: 'var(--c-paper)', minHeight: '100vh' }}>
      <TopNav />

      {/* Editorial hero — 2 cols */}
      <div style={{ padding: '40px 40px 24px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40, alignItems: 'end' }}>
        <div>
          <div className="wf-label mute" style={{ marginBottom: 10 }}>{t.hero_eyebrow}</div>
          <h1 className="wf-h1" style={{ fontSize: 46, lineHeight: 1.05 }}>
            {lang === 'pt' ? <>Trabalhe nas<br /><span className="wf-underline">empresas que investimos.</span></> : <>Work at the<br /><span className="wf-underline">companies we back.</span></>}
          </h1>
        </div>
        <div className="mute" style={{ fontSize: 15, paddingBottom: 8, fontFamily: 'var(--wf-body)' }}>
          {t.sub}
          <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
            <div>
              <span className="hand" style={{ fontWeight: 700, fontSize: 28, color: 'var(--c-ink)' }}>{JOBS.length}</span>{' '}
              <span className="mute">{t.jobs}</span>
            </div>
            <div>
              <span className="hand" style={{ fontWeight: 700, fontSize: 28, color: 'var(--c-ink)' }}>{COMPANIES.length}</span>{' '}
              <span className="mute">{t.companies}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top filter bar */}
      <div style={{ padding: '0 40px 16px', borderBottom: '1.5px solid var(--c-line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280, maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 16, pointerEvents: 'none' }}>⌕</span>
            <input type="text" className="wf-input-el" style={{ paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} />
          </div>

          {[
            { val: selArea,  setter: setSelArea,  opts: ALL_AREAS,  label: t.role,     render: a => t.areas[a] || a },
            { val: selLevel, setter: setSelLevel, opts: ALL_LEVELS, label: t.level,    render: l => t.levels[l] || l },
            { val: selLoc,   setter: setSelLoc,   opts: allLocs,    label: t.location, render: x => x },
            { val: selMode,  setter: setSelMode,  opts: ALL_MODES,  label: t.mode,     render: m => t.modes[m] || m },
          ].map(({ val, setter, opts, label, render }) => (
            <div key={label} style={{ position: 'relative', minWidth: 130 }}>
              <select className="wf-select-el" value={val} onChange={e => setter(e.target.value)}>
                <option value="">{label}</option>
                {opts.map(o => <option key={o} value={o}>{render(o)}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 11, opacity: 0.5 }}>▾</span>
            </div>
          ))}

          {/* View switcher */}
          <div style={{ display: 'flex', border: '1.5px solid var(--c-line)', marginLeft: 'auto' }}>
            {[
              { to: '/',        label: t.list  },
              { to: '/jobs/v2', label: t.cards },
              { to: '/jobs/v3', label: t.table },
            ].map(({ to, label }) => (
              <Link key={to} to={to} className="hand" style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 700,
                background: to === '/jobs/v2' ? 'var(--c-ink)' : 'transparent',
                color: to === '/jobs/v2' ? '#fff' : 'var(--c-mute)',
                textDecoration: 'none',
                borderRight: to !== '/jobs/v3' ? '1.5px solid var(--c-line)' : 'none',
                display: 'flex', alignItems: 'center',
              }}>
                {label}
              </Link>
            ))}
          </div>

          {(search || selArea || selLevel || selLoc || selMode) && (
            <button onClick={clearAll} className="wf-btn wf-btn-ghost wf-btn-sm">{t.clear}</button>
          )}
        </div>
      </div>

      {/* Company cards grid */}
      <div style={{ padding: 24 }}>
        {companyIds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p className="hand mute">Nenhuma empresa com vagas para os filtros selecionados.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {companyIds.map(cid => {
              const c = COMPANY[cid]
              const jobs = grouped[cid]
              const isExpanded = expanded[cid]
              const displayJobs = isExpanded ? jobs : jobs.slice(0, 4)
              const remaining = jobs.length - 4

              return (
                <div key={cid} className="wf-box" style={{ padding: 20 }}>
                  {/* Company header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <CompanyLogo id={cid} size="lg" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="hand" style={{ fontWeight: 700, fontSize: 18 }}>{c.name}</div>
                      <div className="mute hand" style={{ display: 'flex', gap: 8, fontSize: 12, marginTop: 2 }}>
                        <span>{c.stage}</span>
                        <span>·</span>
                        <span>{jobs.length} {t.jobs}</span>
                      </div>
                    </div>
                    <span className="mute hand" style={{ fontSize: 12 }}>via {c.source}</span>
                  </div>

                  <div className="wf-divider-thin" />

                  {/* Job rows */}
                  <div>
                    {displayJobs.map((job, i) => (
                      <a
                        key={job.id}
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 0',
                          borderBottom: i < displayJobs.length - 1 ? '1px dashed var(--c-line3)' : 'none',
                          textDecoration: 'none', color: 'inherit',
                        }}
                        className="job-row-card"
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="hand wf-truncate" style={{ fontWeight: 700, fontSize: 14 }}>{titleOf(job)}</div>
                          <div className="mute hand" style={{ display: 'flex', gap: 6, fontSize: 12, marginTop: 2 }}>
                            <span>{areaOf(job.area)}</span><span>·</span>
                            <span>{levelOf(job.level)}</span><span>·</span>
                            <span>{job.loc}</span>
                          </div>
                        </div>
                        <ModeChip mode={job.mode} sm />
                        <span className="hand" style={{ color: 'var(--c-mute)' }}>↗</span>
                      </a>
                    ))}
                  </div>

                  {remaining > 0 && !isExpanded && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => setExpanded(e => ({ ...e, [cid]: true }))}
                        className="wf-btn wf-btn-ghost wf-btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        + {remaining} {t.jobs}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`.job-row-card:hover { background: var(--c-shade); margin: 0 -4px; padding-left: 4px; padding-right: 4px; }`}</style>
    </div>
  )
}
