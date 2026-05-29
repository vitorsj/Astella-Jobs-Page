// GET  /api/companies  → lista companies.json (fonte que o sync lê)
// POST /api/companies   { name, slug?, logo_url?, linkedin_url?, linkedin_search_url? }
//   → adiciona empresa em companies.json (commit). O próximo sync passa a buscá-la.
import { requireSession } from './_lib/auth.js'
import { readJson, writeJson } from './_lib/github.js'

const PATH = 'companies.json'

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default async function handler(req, res) {
  if (!requireSession(req, res)) return

  if (req.method === 'GET') {
    try {
      const { data } = await readJson(PATH)
      res.status(200).json(Array.isArray(data) ? data : [])
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message, detail: e.detail })
    }
    return
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    const name = (body?.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'missing_name' })
      return
    }
    const slug = (body?.slug || slugify(name)).trim()
    if (!slug) {
      res.status(400).json({ error: 'invalid_slug' })
      return
    }
    try {
      const { data, sha } = await readJson(PATH)
      const list = Array.isArray(data) ? data : []
      if (list.some(c => c.slug === slug)) {
        res.status(409).json({ error: 'company_exists' })
        return
      }
      const company = {
        id: `${slug}-001`,
        name,
        slug,
        logo_url: body.logo_url || '',
        linkedin_url: body.linkedin_url || '',
        linkedin_search_url: body.linkedin_search_url || '',
      }
      list.push(company)
      await writeJson(PATH, list, sha, `admin: nova empresa ${slug}`)
      res.status(200).json({ ok: true, company })
    } catch (e) {
      const status = e.status === 409 || e.status === 422 ? 409 : (e.status || 500)
      res.status(status).json({ error: e.message, detail: e.detail })
    }
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'method_not_allowed' })
}
