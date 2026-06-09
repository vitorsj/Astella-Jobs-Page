import jobsPayload from './jobs.generated.json'
import overrides from './overrides.json'

// ─────────────────────────────────────────────────────────────────────────────
// CAMADA DE DADOS — merge de jobs.generated.json (sync automático) + overrides.json
// (edições do admin). O sync semanal sobrescreve jobs.generated.json; as edições
// vivem separadas em overrides.json e são aplicadas aqui por `id`, sobrevivendo
// ao sync. Ver astella-jobs-PLAN.md / docs do admin.
//
// Schema de overrides.json:
//   {
//     "version": 1,
//     "jobs": {
//       "<job_id>": {           // job_id = id estável da vaga (sha256 do sync)
//         "title_pt", "title_en", "description", "area", "level", "loc", "mode",
//         "status": "publicada" | "rascunho" | "arquivada",
//         "featured": bool, "hidden": bool, "confidential": bool, "bilingual": bool,
//         "updated_at": ISO, "updated_by": string
//       }
//     },
//     "companies": { "<slug>": { ...campos a sobrescrever, ou empresa nova } },
//     "manual_jobs": [ { "id", "company", "title_pt", "title_en", ... } ]
//   }
// ─────────────────────────────────────────────────────────────────────────────

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

function normalizeMode(remote, location) {
  if (remote) return 'Remoto'
  if (/hibrid|hybrid|híbrido/i.test(location || '')) return 'Híbrido'
  return 'Presencial'
}

// Só aceita http(s). Bloqueia javascript:/data: vindos do sync ou de edições
// manuais antes de virarem href (evita XSS via clique). null/vazio → '#'.
function safeUrl(url) {
  if (typeof url !== 'string') return '#'
  try {
    const u = new URL(url, 'https://astella.com.br')
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : '#'
  } catch {
    return '#'
  }
}

function postedLabel(createdAt) {
  const generatedAt = new Date(jobsPayload.generated_at)
  const created = new Date(createdAt)
  const days = Math.max(1, Math.round((generatedAt - created) / 86400000))
  return days === 1 ? '1d' : `${days}d`
}

// Remove chaves null/undefined de um patch antes de aplicar (null = "não mexe").
function stripEmpty(patch) {
  const out = {}
  for (const [k, v] of Object.entries(patch || {})) {
    if (v !== null && v !== undefined) out[k] = v
  }
  return out
}

const jobOverrides = overrides.jobs || {}
const companyOverrides = overrides.companies || {}
const manualJobs = overrides.manual_jobs || []

// ── Empresas: base do sync + overrides + empresas adicionadas à mão ───────────

const baseCompanies = jobsPayload.companies.map(company => ({
  ...company,
  id: company.slug,
  stage: 'Portfolio',
  source: SOURCE_LABELS.linkedin,
}))

const baseCompanySlugs = new Set(baseCompanies.map(c => c.slug))

const mergedCompanies = baseCompanies.map(company => ({
  ...company,
  ...stripEmpty(companyOverrides[company.slug]),
}))

// Empresas presentes só no override (criadas pelo admin) entram como novas.
for (const [slug, patch] of Object.entries(companyOverrides)) {
  if (!baseCompanySlugs.has(slug)) {
    mergedCompanies.push({
      id: slug,
      slug,
      stage: 'Portfolio',
      source: SOURCE_LABELS.linkedin,
      ...stripEmpty(patch),
    })
  }
}

export const COMPANIES = mergedCompanies
export const COMPANY = Object.fromEntries(COMPANIES.map(company => [company.id, company]))

// ── Vagas: converte vaga do sync → shape de view, e aplica override ───────────

function toViewJob(job) {
  return {
    id: job.id,
    externalId: job.external_id,
    source: SOURCE_LABELS[job.source] || job.source,
    company: job.company_slug,
    title: { pt: job.title, en: job.title },
    rawTitle: job.title,
    description: job.description || '',
    area: job.department,
    rawArea: job.raw_department || job.department,
    level: inferLevel(job.title),
    loc: job.location,
    mode: normalizeMode(job.remote, job.location),
    remote: job.remote,
    posted: postedLabel(job.posted_at || job.created_at),
    url: safeUrl(job.url),
    createdAt: job.created_at,
    postedAt: job.posted_at,
    lastSeenAt: job.last_seen_at,
    // campos administrados (defaults — vaga sincronizada nasce publicada)
    status: 'publicada',
    featured: false,
    hidden: false,
    confidential: false,
    bilingual: false,
    edited: false,
    manual: false,
  }
}

function applyJobOverride(viewJob, ov) {
  if (!ov) return viewJob
  const j = { ...viewJob, title: { ...viewJob.title } }
  if (ov.title_pt != null) j.title.pt = ov.title_pt
  if (ov.title_en != null) j.title.en = ov.title_en
  if (ov.description != null) j.description = ov.description
  if (ov.area != null) j.area = ov.area
  if (ov.level != null) j.level = ov.level
  if (ov.loc != null) j.loc = ov.loc
  if (ov.mode != null) j.mode = ov.mode
  if (ov.status != null) j.status = ov.status
  if (typeof ov.featured === 'boolean') j.featured = ov.featured
  if (typeof ov.hidden === 'boolean') j.hidden = ov.hidden
  if (typeof ov.confidential === 'boolean') j.confidential = ov.confidential
  if (typeof ov.bilingual === 'boolean') j.bilingual = ov.bilingual
  j.edited = true
  j.updatedAt = ov.updated_at || null
  j.updatedBy = ov.updated_by || null
  return j
}

function manualToViewJob(m) {
  return {
    id: m.id,
    externalId: null,
    source: m.source || 'Manual',
    company: m.company,
    title: { pt: m.title_pt || '', en: m.title_en || m.title_pt || '' },
    rawTitle: m.title_pt || '',
    description: m.description || '',
    area: m.area || 'Outros',
    rawArea: m.area || 'Outros',
    level: m.level || 'Mid',
    loc: m.loc || '',
    mode: m.mode || 'Presencial',
    remote: m.mode === 'Remoto',
    posted: m.posted || 'novo',
    url: safeUrl(m.url),
    createdAt: m.created_at || null,
    postedAt: m.created_at || null,
    lastSeenAt: m.created_at || null,
    status: m.status || 'rascunho',
    featured: !!m.featured,
    hidden: !!m.hidden,
    confidential: !!m.confidential,
    bilingual: !!m.bilingual,
    edited: true,
    manual: true,
    updatedAt: m.updated_at || null,
    updatedBy: m.updated_by || null,
  }
}

const mergedJobs = [
  ...jobsPayload.jobs
    .filter(job => job.is_active)
    .map(toViewJob)
    .map(job => applyJobOverride(job, jobOverrides[job.id])),
  ...manualJobs.map(manualToViewJob),
]

// Visível no board público: publicada e não oculta.
function isVisible(job) {
  return !job.hidden && job.status === 'publicada'
}

export const RAW_JOBS_PAYLOAD = jobsPayload

// Tudo (admin enxerga vagas ocultas/rascunho/arquivadas para poder gerenciá-las).
export const ALL_JOBS = mergedJobs

// Board público respeita status e ocultação.
export const JOBS = mergedJobs.filter(isVisible)

export const AREAS = [...new Set(JOBS.map(job => job.area))].sort()
export const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'].filter(level => JOBS.some(job => job.level === level))
export const LOCS = [...new Set(JOBS.map(job => job.loc))].sort()
export const MODES = ['Remoto', 'Híbrido', 'Presencial'].filter(mode => JOBS.some(job => job.mode === mode))
