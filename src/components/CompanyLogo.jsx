import { COMPANY } from '../data/jobs.js'

export default function CompanyLogo({ id, size = 'md' }) {
  const c = COMPANY[id]
  if (!c) return null
  const initials = c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const cls = size === 'lg' ? 'wf-logo wf-logo-lg' : size === 'sm' ? 'wf-logo wf-logo-sm' : 'wf-logo'
  return <span className={cls}>{initials}</span>
}
