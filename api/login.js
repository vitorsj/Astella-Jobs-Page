// POST /api/login  { password }  → seta cookie de sessão se a senha bater.
import { safeEqual, sessionCookie, newSessionToken } from './_lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const expected = process.env.ADMIN_PASSWORD
  const secret = process.env.SESSION_SECRET
  if (!expected || !secret) {
    res.status(500).json({ error: 'auth_not_configured' })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const password = body?.password ?? ''

  if (!safeEqual(password, expected)) {
    res.status(401).json({ error: 'invalid_password' })
    return
  }

  res.setHeader('Set-Cookie', sessionCookie(newSessionToken()))
  res.status(200).json({ ok: true })
}
