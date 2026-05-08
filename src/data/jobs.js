import jobsPayload from './jobs.generated.json'

const SOURCE_LABELS = {
  linkedin: 'LinkedIn',
}

const LEVEL_RULES = [
  [/lead|head|principal|staff|coordenador|manager|gerente/i, 'Lead'],
  [/senior|sênior|sr\.?|especialista/i, 'Senior'],
  [/junior|júnior|jr\.?|estagi/i, 'Junior'],
]

function inferLevel(title) {
  const match = LEVEL_RULES.find(([pattern]) => pattern.test(title))
  return match ? match[1] : 'Mid'
}

function normalizeMode(job) {
  if (job.remote) return 'Remoto'
  if (/hibrid|hybrid|híbrido/i.test(job.location)) return 'Híbrido'
  return 'Presencial'
}

function postedLabel(job) {
  const generatedAt = new Date(jobsPayload.generated_at)
  const createdAt = new Date(job.created_at)
  const days = Math.max(1, Math.round((generatedAt - createdAt) / 86400000))
  return days === 1 ? '1d' : `${days}d`
}

export const RAW_JOBS_PAYLOAD = jobsPayload

export const COMPANIES = jobsPayload.companies.map(company => ({
  ...company,
  id: company.slug,
  stage: 'Portfolio',
  source: SOURCE_LABELS.linkedin,
}))

export const COMPANY = Object.fromEntries(COMPANIES.map(company => [company.id, company]))

export const JOBS = jobsPayload.jobs
  .filter(job => job.is_active)
  .map(job => ({
    id: job.id,
    externalId: job.external_id,
    source: SOURCE_LABELS[job.source] || job.source,
    company: job.company_slug,
    title: { pt: job.title, en: job.title },
    area: job.department,
    level: inferLevel(job.title),
    loc: job.location,
    mode: normalizeMode(job),
    remote: job.remote,
    posted: postedLabel(job),
    url: job.url,
    createdAt: job.created_at,
    lastSeenAt: job.last_seen_at,
  }))

export const AREAS = [...new Set(JOBS.map(job => job.area))].sort()
export const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'].filter(level => JOBS.some(job => job.level === level))
export const LOCS = [...new Set(JOBS.map(job => job.loc))].sort()
export const MODES = ['Remoto', 'Híbrido', 'Presencial'].filter(mode => JOBS.some(job => job.mode === mode))
