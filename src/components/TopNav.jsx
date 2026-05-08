import { NavLink } from 'react-router-dom'
import { useLang } from '../context/LangContext.jsx'

export default function TopNav() {
  const { lang, setLang, t } = useLang()

  return (
    <div className="wf-topnav">
      <div className="brand">
        <span className="wf-spiral" />
        <span>ASTELLA</span>
        <span className="mute" style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 400, marginLeft: 4 }}>
          / careers
        </span>
      </div>

      <nav>
        {[
          { to: '/',          label: t.nav.jobs,      end: false },
          { to: '/companies', label: t.nav.companies, end: true },
          { to: '/about',     label: t.nav.about,     end: true },
          { to: '/contact',   label: t.nav.contact,   end: true },
        ].map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive
                ? 'text-ink'
                : 'mute hover:text-ink transition-colors'
            }
            style={({ isActive }) =>
              isActive
                ? { borderBottom: '1.5px solid var(--c-teal)', paddingBottom: 2 }
                : {}
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
        className="wf-chip"
        style={{ cursor: 'pointer' }}
      >
        <span style={{ color: lang === 'pt' ? 'var(--c-ink)' : 'var(--c-mute)' }}>PT</span>
        <span className="mute" style={{ fontSize: 10 }}>/</span>
        <span style={{ color: lang === 'en' ? 'var(--c-ink)' : 'var(--c-mute)' }}>EN</span>
      </button>
    </div>
  )
}
