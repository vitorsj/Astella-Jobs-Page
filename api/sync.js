// POST /api/sync  → dispara o workflow sync.yml (GitHub Actions). Requer sessão.
import { requireSession } from './_lib/auth.js'
import { dispatchWorkflow } from './_lib/github.js'

export default async function handler(req, res) {
  if (!requireSession(req, res)) return
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  try {
    await dispatchWorkflow('sync.yml')
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, detail: e.detail })
  }
}
