// GET /api/session  → { authenticated: bool }  (usado pelo gate do cliente)
import { getSession } from './_lib/auth.js'

export default function handler(req, res) {
  const session = getSession(req)
  res.status(200).json({ authenticated: !!session })
}
