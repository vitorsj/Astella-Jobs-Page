// POST /api/logout  → limpa o cookie de sessão.
import { clearSessionCookie } from './_lib/auth.js'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.status(200).json({ ok: true })
}
