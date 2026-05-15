import { useState } from 'react'
import { COMPANY } from '../data/jobs.js'

const LOGO_FILES = {
  'gabriel': '/logos/gabriel.jpeg',
  'purple-metrics': '/logos/purple-metrics.jpeg',
  'cayena': '/logos/cayena.png',
  'kompa': '/logos/kompa.jpeg',
  'sallve': '/logos/sallve.jpeg',
  'estoca': '/logos/estoca.jpeg',
  'lastlink': '/logos/lastlink.jpeg',
}

const COLOR_BY_SLUG = {
  'gabriel': '#225379',
  'purple-metrics': '#5c3d8a',
  'cienty': '#1a6b5c',
  'cayena': '#2a5e40',
  'bem-te-vi': '#a04828',
  'kompa': '#1b5076',
  'estoca': '#2d3f58',
  'sallve': '#7c3060',
  'taon': '#5a3a1a',
  'lastlink': '#1e5e40',
}

export default function CompanyLogo({ id, size = 'md' }) {
  const c = COMPANY[id]
  const [errored, setErrored] = useState(false)
  if (!c) return null
  const initials = c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const url = LOGO_FILES[id]
  const color = COLOR_BY_SLUG[id] || '#225379'
  const cls = `jlogo jlogo-${size}`

  if (!url || errored) {
    return (
      <span className={`${cls} jlogo-fallback`} style={{ background: color }}>
        {initials}
      </span>
    )
  }
  return (
    <span className={cls}>
      <img src={url} alt={c.name} onError={() => setErrored(true)} />
    </span>
  )
}
