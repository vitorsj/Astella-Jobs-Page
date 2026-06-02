// POST /api/clicks  → incrementa a contagem de clicks de uma vaga (público, sem auth)
//   body: { jobId }
// GET  /api/clicks  → { clicks: { jobId: count } } (somente admin, requer sessão)
import { requireSession } from './_lib/auth.js'
import { redis, CLICKS_KEY } from './_lib/redis.js'

// Aceita ids sha-based do sync (ex.: "li:ab12...") e ids de vagas manuais.
const JOB_ID_RE = /^[A-Za-z0-9:_-]{1,80}$/

export default async function handler(req, res) {
  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    const jobId = body?.jobId
    if (typeof jobId !== 'string' || !JOB_ID_RE.test(jobId)) {
      res.status(400).json({ error: 'invalid_job_id' })
      return
    }
    try {
      await redis.hincrby(CLICKS_KEY, jobId, 1)
    } catch {
      // Tracking nunca pode quebrar a navegação do usuário: engole o erro.
    }
    res.status(204).end()
    return
  }

  if (req.method === 'GET') {
    if (!requireSession(req, res)) return
    try {
      const raw = (await redis.hgetall(CLICKS_KEY)) || {}
      const clicks = {}
      for (const [id, n] of Object.entries(raw)) clicks[id] = Number(n) || 0
      res.status(200).json({ clicks })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message })
    }
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'method_not_allowed' })
}
