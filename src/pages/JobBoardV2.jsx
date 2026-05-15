import { useState, useMemo } from 'react'
import CompanyLogo from '../components/CompanyLogo.jsx'
import { JOBS, COMPANIES, COMPANY, AREAS, LEVELS, LOCS, MODES } from '../data/jobs.js'
import { useLang } from '../context/LangContext.jsx'

const INITIAL_VISIBLE = 3

export default function JobBoardV2() {
  const { lang, t, setLang } = useLang()
  const [search,     setSearch]     = useState('')
  const [selCompany, setSelCompany] = useState('')
  const [selArea,    setSelArea]    = useState('')
  const [selLevel,   setSelLevel]   = useState('')
  const [selMode,    setSelMode]    = useState('')
  const [selLoc,     setSelLoc]     = useState('')
  const [expanded,   setExpanded]   = useState({})

  const titleOf = j => j.title[lang] || j.title.pt
  const levelOf = l => t.levels[l] || l
  const modeOf  = m => t.modes[m]  || m

  const filteredJobs = useMemo(() => JOBS.filter(j => {
    const q = search.toLowerCase()
    if (q && !titleOf(j).toLowerCase().includes(q) && !COMPANY[j.company].name.toLowerCase().includes(q)) return false
    if (selCompany && j.company !== selCompany) return false
    if (selArea    && j.area    !== selArea)    return false
    if (selLevel   && j.level   !== selLevel)   return false
    if (selMode    && j.mode    !== selMode)    return false
    if (selLoc     && j.loc     !== selLoc)     return false
    return true
  }), [search, selCompany, selArea, selLevel, selMode, selLoc, lang])

  const grouped = useMemo(() => {
    const g = {}
    filteredJobs.forEach(j => { (g[j.company] = g[j.company] || []).push(j) })
    return g
  }, [filteredJobs])

  const companyIds = COMPANIES.map(c => c.id).filter(id => grouped[id]?.length)
  const totalJobs = filteredJobs.length
  const totalCompanies = companyIds.length

  const generatedAt = new Date(JOBS[0]?.lastSeenAt || Date.now())
  const daysAgo = Math.max(0, Math.round((Date.now() - generatedAt.getTime()) / 86400000))
  const updatedLabel = daysAgo === 0
    ? (lang === 'pt' ? 'atualizado hoje' : 'updated today')
    : (lang === 'pt' ? `atualizado há ${daysAgo}d` : `updated ${daysAgo}d ago`)

  return (
    <div className="jbv2-root">
      {/* NAV */}
      <nav className="jbv2-nav">
        <a href="#" className="jbv2-brand">
          <span className="jbv2-mark">
            <svg viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1.5C7.5 1.5 3 4.5 3 9C3 11.5 5 13.5 7.5 13.5C10 13.5 12 11.5 12 9C12 4.5 7.5 1.5 7.5 1.5Z" stroke="#56BBC2" strokeWidth="1.2" fill="none"/>
              <path d="M7.5 1.5V9" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M4.5 7C5.5 7.8 7.5 8.5 7.5 8.5C7.5 8.5 9.5 7.8 10.5 7" stroke="#56BBC2" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="jbv2-wordmark"><em>astella</em> careers</span>
        </a>
        <ul className="jbv2-nav-links">
          <li><a href="#" className="active">{t.nav.jobs}</a></li>
          <li><a href="#">{t.nav.companies}</a></li>
          <li><a href="#">{t.nav.about}</a></li>
        </ul>
        <div className="jbv2-nav-spacer" />
        <button className="jbv2-lang" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}>
          {lang === 'pt' ? 'PT · EN' : 'EN · PT'}
        </button>
      </nav>

      {/* HERO */}
      <section className="jbv2-hero">
        <div className="jbv2-hero-inner">
          <div>
            <div className="jbv2-eyebrow">{lang === 'pt' ? 'Portfólio Astella' : 'Astella Portfolio'}</div>
            <h1 className="jbv2-h1">
              {lang === 'pt' ? (
                <>Trabalhe nas empresas<br/><span className="accent">em que acreditamos</span></>
              ) : (
                <>Work at the companies<br/><span className="accent">we back</span></>
              )}
            </h1>
            <p className="jbv2-sub">
              {lang === 'pt'
                ? 'Vagas abertas nas startups do portfólio. Atualizado toda semana diretamente do LinkedIn.'
                : 'Open roles at our portfolio startups. Updated weekly directly from LinkedIn.'}
            </p>
          </div>
          <div className="jbv2-hero-stats">
            <div className="jbv2-hstat">
              <div className="jbv2-hstat-num">{JOBS.length}</div>
              <div className="jbv2-hstat-label">{lang === 'pt' ? 'vagas abertas' : 'open roles'}</div>
            </div>
            <div className="jbv2-hstat">
              <div className="jbv2-hstat-num">{COMPANIES.length}</div>
              <div className="jbv2-hstat-label">{lang === 'pt' ? 'empresas' : 'companies'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* FILTER BAR */}
      <div className="jbv2-filterbar">
        <div className="jbv2-filterbar-inner">
          <div className="jbv2-fsearch">
            <svg viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.search}
            />
          </div>
          <div className="jbv2-fpills">
            <PillSelect value={selCompany} onChange={setSelCompany} label={t.company}>
              {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </PillSelect>
            <PillSelect value={selArea} onChange={setSelArea} label={t.role}>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </PillSelect>
            <PillSelect value={selLevel} onChange={setSelLevel} label={t.level}>
              {LEVELS.map(l => <option key={l} value={l}>{levelOf(l)}</option>)}
            </PillSelect>
            <PillSelect value={selMode} onChange={setSelMode} label={t.mode}>
              {MODES.map(m => <option key={m} value={m}>{modeOf(m)}</option>)}
            </PillSelect>
            <PillSelect value={selLoc} onChange={setSelLoc} label={t.location}>
              {LOCS.map(l => <option key={l} value={l}>{l}</option>)}
            </PillSelect>
          </div>
          <div className="jbv2-fcount">
            <strong>{totalJobs}</strong> {t.jobs} · {totalCompanies} {t.companies}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <main className="jbv2-main">
        <div className="jbv2-section-intro">
          <span className="jbv2-section-title">
            {lang === 'pt' ? 'Todas as vagas' : 'All open roles'}
          </span>
          <span className="jbv2-section-meta">{updatedLabel}</span>
        </div>

        {companyIds.length === 0 ? (
          <div className="jbv2-empty">
            {lang === 'pt' ? 'Nenhuma vaga para os filtros selecionados.' : 'No jobs match the selected filters.'}
          </div>
        ) : companyIds.map(cid => {
          const c = COMPANY[cid]
          const jobs = grouped[cid]
          const isExpanded = expanded[cid]
          const displayJobs = isExpanded ? jobs : jobs.slice(0, INITIAL_VISIBLE)
          const remaining = jobs.length - INITIAL_VISIBLE

          return (
            <div key={cid} className="jbv2-co-block">
              <div className="jbv2-co-header">
                <div>
                  <div className="jbv2-co-name">{c.name}</div>
                </div>
                <span className="jbv2-co-count">{jobs.length} {t.jobs}</span>
              </div>

              {displayJobs.map(job => (
                <a
                  key={job.id}
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="jbv2-job-row"
                >
                  <CompanyLogo id={job.company} />
                  <div className="jbv2-jleft">
                    <div className="jbv2-jtitle">{titleOf(job)}</div>
                    <div className="jbv2-jmeta">
                      <span className="jbv2-jmeta-text">{job.loc}</span>
                      <span className="jbv2-dot">·</span>
                      <span className="jbv2-tag jbv2-tag-level">{levelOf(job.level)}</span>
                      <span className={`jbv2-tag jbv2-tag-${modeKey(job.mode)}`}>{modeOf(job.mode)}</span>
                      <span className="jbv2-tag">{job.area}</span>
                    </div>
                  </div>
                  <div className="jbv2-jright">
                    <span className="jbv2-jposted">{relTime(job.posted, lang)}</span>
                    <span className="jbv2-jbtn">
                      {lang === 'pt' ? 'Ver vaga' : 'View role'}
                      <svg viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5h7M5.5 2l3.5 3.5L5.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                </a>
              ))}

              {remaining > 0 && !isExpanded && (
                <div className="jbv2-expand-row">
                  <button
                    className="jbv2-expand-btn"
                    onClick={() => setExpanded(e => ({ ...e, [cid]: true }))}
                  >
                    + {remaining} {t.jobs} →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </main>

      {/* FOOTER */}
      <footer className="jbv2-footer">
        <div className="jbv2-footer-brand"><span>astella</span> careers</div>
        <div className="jbv2-footer-links">
          <a href="https://astella.com.br" target="_blank" rel="noopener noreferrer">
            {lang === 'pt' ? 'Sobre a Astella' : 'About Astella'}
          </a>
          <a href="https://www.linkedin.com/company/astellavc/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </footer>

      <style>{CSS}</style>
    </div>
  )
}

function PillSelect({ value, onChange, label, children }) {
  return (
    <div className={`jbv2-fpill ${value ? 'on' : ''}`}>
      <span className="jbv2-fpill-label">{label}</span>
      <svg viewBox="0 0 10 6" fill="none">
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{label}</option>
        {children}
      </select>
    </div>
  )
}

function modeKey(mode) {
  if (mode === 'Remoto') return 'remote'
  if (mode === 'Híbrido') return 'hybrid'
  return 'onsite'
}

function relTime(posted, lang) {
  // posted is "1d", "5d", etc.
  if (!posted) return ''
  const num = parseInt(posted, 10)
  if (Number.isNaN(num)) return posted
  if (lang === 'pt') {
    if (num === 1) return 'há 1 dia'
    if (num < 7) return `há ${num} dias`
    if (num < 14) return 'há 1 sem'
    return `há ${Math.round(num / 7)} sem`
  }
  if (num === 1) return '1d ago'
  if (num < 7) return `${num}d ago`
  if (num < 14) return '1w ago'
  return `${Math.round(num / 7)}w ago`
}

const CSS = `
.jbv2-root {
  --navy:       #225379;
  --navy-dark:  #162f43;
  --navy-mid:   #1c3d57;
  --teal:       #56BBC2;
  --teal-dark:  #3a9da4;
  --ink:        #1A1A1A;
  --paper:      #FBFAF6;
  --paper2:     #F2F0E8;
  --white:      #ffffff;
  --muted:      rgba(26,26,26,0.46);
  --line:       rgba(26,26,26,0.09);
  --line-med:   rgba(26,26,26,0.14);
  font-family: 'DM Sans', sans-serif;
  background: var(--paper);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
}
.jbv2-root *, .jbv2-root *::before, .jbv2-root *::after { box-sizing: border-box; }

.jbv2-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: var(--navy-dark);
  height: 52px;
  display: flex; align-items: center; padding: 0 40px; gap: 32px;
}
.jbv2-brand { display: flex; align-items: center; gap: 9px; text-decoration: none; flex-shrink: 0; }
.jbv2-mark {
  width: 26px; height: 26px;
  border: 1.5px solid rgba(86,187,194,0.55);
  display: flex; align-items: center; justify-content: center;
}
.jbv2-mark svg { width: 15px; height: 15px; }
.jbv2-wordmark {
  font-family: 'Kalam', cursive; font-weight: 700;
  font-size: 15.5px; color: var(--white); letter-spacing: 0.02em;
}
.jbv2-wordmark em { color: var(--teal); font-style: normal; }
.jbv2-nav-links { display: flex; list-style: none; margin: 0 0 0 8px; padding: 0; }
.jbv2-nav-links a {
  font-size: 13px; font-weight: 400;
  color: rgba(255,255,255,0.45);
  text-decoration: none; padding: 4px 12px; transition: color .15s;
}
.jbv2-nav-links a:hover { color: rgba(255,255,255,0.80); }
.jbv2-nav-links a.active { color: var(--teal); }
.jbv2-nav-spacer { flex: 1; }
.jbv2-lang {
  font-size: 11.5px; font-weight: 500;
  color: rgba(255,255,255,0.38);
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  padding: 3px 10px; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: all .15s;
}
.jbv2-lang:hover { border-color: var(--teal); color: var(--teal); }

.jbv2-hero {
  margin-top: 52px;
  background: var(--navy-dark);
  padding: 52px 40px 48px;
  position: relative; overflow: hidden;
}
.jbv2-hero::before {
  content: ''; position: absolute;
  top: -80px; right: -80px;
  width: 420px; height: 420px;
  background: radial-gradient(circle, rgba(86,187,194,0.09) 0%, transparent 65%);
  pointer-events: none;
}
.jbv2-hero::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1.5px;
  background: linear-gradient(90deg, var(--teal) 0%, rgba(86,187,194,0.1) 55%, transparent 100%);
}
.jbv2-hero-inner {
  max-width: 1080px; margin: 0 auto;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 48px;
}
.jbv2-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--teal); margin-bottom: 14px;
}
.jbv2-eyebrow::before {
  content: ''; display: block; width: 22px; height: 1.5px; background: var(--teal);
}
.jbv2-h1 {
  font-family: 'Caveat', cursive; font-weight: 700;
  font-size: 52px; line-height: 1.02;
  color: var(--white); margin: 0 0 14px;
}
.jbv2-h1 .accent { color: var(--teal); }
.jbv2-sub {
  font-size: 14px; color: rgba(255,255,255,0.45);
  line-height: 1.65; max-width: 380px; margin: 0;
}
.jbv2-hero-stats { display: flex; align-items: flex-end; flex-shrink: 0; }
.jbv2-hstat {
  text-align: right; padding: 0 28px;
  border-left: 1px solid rgba(255,255,255,0.10);
}
.jbv2-hstat:first-child { padding-right: 28px; border-left: none; padding-left: 0; }
.jbv2-hstat-num {
  font-family: 'Caveat', cursive; font-size: 46px; font-weight: 700;
  color: var(--white); line-height: 1;
}
.jbv2-hstat-label {
  font-size: 11px; color: rgba(255,255,255,0.35);
  text-transform: uppercase; letter-spacing: 0.09em; margin-top: 3px;
}

.jbv2-filterbar {
  position: sticky; top: 52px; z-index: 90;
  background: var(--white);
  border-bottom: 1.5px solid var(--line-med);
}
.jbv2-filterbar-inner {
  max-width: 1080px; margin: 0 auto;
  padding: 0 40px;
  display: flex; align-items: stretch; height: 50px;
}
.jbv2-fsearch {
  flex: 1; display: flex; align-items: center; gap: 9px;
  border-right: 1.5px solid var(--line);
  padding-right: 20px;
}
.jbv2-fsearch svg { color: var(--muted); width: 14px; height: 14px; flex-shrink: 0; }
.jbv2-fsearch input {
  flex: 1; border: none; background: transparent;
  font-family: 'DM Sans', sans-serif; font-size: 13.5px;
  color: var(--ink); outline: none;
}
.jbv2-fsearch input::placeholder { color: var(--muted); }
.jbv2-fpills { display: flex; align-items: stretch; }
.jbv2-fpill {
  display: flex; align-items: center; gap: 5px;
  padding: 0 16px;
  border-right: 1.5px solid var(--line);
  background: transparent;
  font-family: 'DM Sans', sans-serif; font-size: 13px;
  color: var(--muted);
  cursor: pointer; transition: color .12s, background .12s;
  white-space: nowrap;
  position: relative;
}
.jbv2-fpill:hover { color: var(--ink); background: var(--paper); }
.jbv2-fpill.on { color: var(--navy); font-weight: 500; }
.jbv2-fpill svg { width: 9px; height: 9px; opacity: 0.5; flex-shrink: 0; }
.jbv2-fpill select {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  opacity: 0; cursor: pointer;
  border: none; background: transparent;
}
.jbv2-fcount {
  display: flex; align-items: center; padding-left: 18px;
  font-size: 12.5px; color: var(--muted); white-space: nowrap;
}
.jbv2-fcount strong { color: var(--navy); font-weight: 600; margin-right: 2px; }

.jbv2-main {
  max-width: 1080px; margin: 0 auto;
  padding: 0 40px 80px;
}
.jbv2-section-intro {
  padding: 28px 0 4px;
  display: flex; align-items: baseline; justify-content: space-between;
}
.jbv2-section-title {
  font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700;
  color: var(--ink);
}
.jbv2-section-meta { font-size: 12px; color: var(--muted); }

.jbv2-co-block { margin-bottom: 8px; }
.jbv2-co-header {
  display: flex; align-items: center; gap: 11px;
  padding: 18px 0 6px;
  border-top: 1.5px solid var(--line);
}
.jbv2-co-name {
  font-family: 'Kalam', cursive; font-size: 15.5px; font-weight: 700;
  color: var(--ink);
}
.jbv2-co-count {
  margin-left: auto;
  font-size: 12px; color: var(--muted); font-weight: 500;
}

.jbv2-job-row {
  display: grid; grid-template-columns: auto 1fr auto;
  align-items: center; gap: 14px 16px;
  padding: 11px 10px 11px 0;
  border-left: 3px solid transparent;
  color: inherit; text-decoration: none;
  transition: border-color .15s, background .15s, padding-left .15s;
  cursor: pointer;
}
.jbv2-job-row:hover {
  border-left-color: var(--teal);
  background: rgba(86,187,194,0.04);
  padding-left: 2px;
}

.jlogo {
  width: 52px; height: 52px;
  background: transparent;
  border: 1px solid var(--line-med);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  vertical-align: middle;
}
.jlogo img { width: 100%; height: 100%; object-fit: cover; }
.jlogo.jlogo-fallback {
  border: none;
  font-family: 'Kalam', cursive; font-weight: 700;
  font-size: 17px; color: var(--white);
}

.jbv2-jtitle {
  font-size: 14px; font-weight: 500;
  color: var(--ink); margin-bottom: 5px;
  transition: color .12s;
}
.jbv2-job-row:hover .jbv2-jtitle { color: var(--navy); }
.jbv2-jmeta { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.jbv2-jmeta-text { font-size: 12.5px; color: var(--muted); }
.jbv2-dot { color: rgba(26,26,26,0.18); font-size: 9px; }
.jbv2-tag {
  display: inline-block; font-size: 11px; font-weight: 500;
  padding: 1.5px 7px;
  border: 1px solid var(--line-med);
  color: var(--muted);
}
.jbv2-tag-level { color: var(--navy); border-color: rgba(34,83,121,0.22); background: rgba(34,83,121,0.04); }
.jbv2-tag-remote { color: #2a8b92; border-color: rgba(86,187,194,0.35); background: rgba(86,187,194,0.07); }
.jbv2-tag-hybrid { color: #7a6520; border-color: rgba(160,140,50,0.30); background: rgba(160,140,50,0.06); }
.jbv2-tag-onsite { }

.jbv2-jright { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
.jbv2-jposted { font-size: 12px; color: var(--muted); white-space: nowrap; }
.jbv2-jbtn {
  display: inline-flex; align-items: center; gap: 5px;
  height: 30px; padding: 0 13px;
  background: var(--navy); color: var(--white);
  font-family: 'DM Sans', sans-serif;
  font-size: 12px; font-weight: 500;
  white-space: nowrap;
  transition: background .15s;
}
.jbv2-job-row:hover .jbv2-jbtn { background: var(--teal); color: var(--ink); }
.jbv2-jbtn svg { width: 11px; height: 11px; }

.jbv2-expand-row { padding: 8px 10px 8px 45px; }
.jbv2-expand-btn {
  font-size: 12px; font-weight: 500;
  color: var(--teal-dark);
  background: none; border: none; cursor: pointer;
  font-family: 'DM Sans', sans-serif; padding: 0;
  transition: color .12s;
}
.jbv2-expand-btn:hover { color: var(--navy); }

.jbv2-empty {
  padding: 80px 24px; text-align: center;
  color: var(--muted); font-size: 14px;
}

.jbv2-footer {
  background: var(--navy-dark);
  padding: 36px 40px; text-align: center;
}
.jbv2-footer-brand {
  font-family: 'Caveat', cursive; font-size: 20px; font-weight: 700;
  color: var(--white); margin-bottom: 8px;
}
.jbv2-footer-brand span { color: var(--teal); }
.jbv2-footer-links { font-size: 12.5px; color: rgba(255,255,255,0.35); }
.jbv2-footer-links a {
  color: rgba(255,255,255,0.50); text-decoration: none;
  margin: 0 10px; transition: color .15s;
}
.jbv2-footer-links a:hover { color: var(--teal); }
`
