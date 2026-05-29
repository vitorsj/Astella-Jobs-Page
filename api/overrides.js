// GET  /api/overrides  → overrides.json atual (estado vivo, mais novo que o build)
// PUT  /api/overrides  → aplica uma operação e commita (1 commit por save)
//
// Body do PUT (uma operação por chamada):
//   { kind: 'job',                id, patch }    edita/sobrescreve uma vaga do sync
//   { kind: 'reset_job',          id }           remove o override (volta ao sync)
//   { kind: 'company',            slug, patch }  edita/cria empresa
//   { kind: 'manual_job',         job }          cria/edita vaga manual (job.id obrigatório)
//   { kind: 'delete_manual_job',  id }           remove vaga manual
import { requireSession } from './_lib/auth.js'
import { readOverrides, writeOverrides } from './_lib/github.js'

export default async function handler(req, res) {
  if (!requireSession(req, res)) return

  if (req.method === 'GET') {
    try {
      const { data } = await readOverrides()
      res.status(200).json(data)
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message, detail: e.detail })
    }
    return
  }

  if (req.method === 'PUT') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    try {
      const overrides = await applyWithRetry(body || {})
      res.status(200).json({ ok: true, overrides })
    } catch (e) {
      const status = e.status === 422 || e.status === 409 ? 409 : (e.status || 500)
      res.status(status).json({ error: e.message, detail: e.detail })
    }
    return
  }

  res.setHeader('Allow', 'GET, PUT')
  res.status(405).json({ error: 'method_not_allowed' })
}

// Concorrência otimista: relê o sha e tenta de novo se outro commit colidiu.
async function applyWithRetry(op, attempt = 0) {
  const { data, sha } = await readOverrides()
  const { next, message } = applyOp(data, op)
  try {
    await writeOverrides(next, sha, message)
    return next
  } catch (e) {
    if ((e.status === 409 || e.status === 422) && attempt < 2) {
      return applyWithRetry(op, attempt + 1)
    }
    throw e
  }
}

function cleanPatch(patch) {
  const out = {}
  for (const [k, v] of Object.entries(patch || {})) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function applyOp(data, op) {
  const stamp = { updated_at: new Date().toISOString(), updated_by: 'admin' }
  switch (op.kind) {
    case 'job': {
      if (!op.id) throw badRequest('missing_id')
      data.jobs[op.id] = { ...(data.jobs[op.id] || {}), ...cleanPatch(op.patch), ...stamp }
      return { next: data, message: `admin: editar vaga ${op.id}` }
    }
    case 'reset_job': {
      if (!op.id) throw badRequest('missing_id')
      delete data.jobs[op.id]
      return { next: data, message: `admin: resetar vaga ${op.id}` }
    }
    case 'company': {
      if (!op.slug) throw badRequest('missing_slug')
      data.companies[op.slug] = { ...(data.companies[op.slug] || {}), ...cleanPatch(op.patch), ...stamp }
      return { next: data, message: `admin: empresa ${op.slug}` }
    }
    case 'manual_job': {
      const job = op.job || {}
      if (!job.id) throw badRequest('missing_id')
      const i = data.manual_jobs.findIndex(j => j.id === job.id)
      const merged = { ...(i >= 0 ? data.manual_jobs[i] : {}), ...cleanPatch(job), ...stamp }
      if (i >= 0) data.manual_jobs[i] = merged
      else data.manual_jobs.push(merged)
      return { next: data, message: `admin: vaga manual ${job.id}` }
    }
    case 'delete_manual_job': {
      if (!op.id) throw badRequest('missing_id')
      data.manual_jobs = data.manual_jobs.filter(j => j.id !== op.id)
      return { next: data, message: `admin: remover vaga manual ${op.id}` }
    }
    default:
      throw badRequest('unknown_kind')
  }
}

function badRequest(msg) {
  const err = new Error(msg)
  err.status = 400
  return err
}
