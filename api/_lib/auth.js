// Sessão de admin via cookie HttpOnly assinado com HMAC-SHA256.
// Zero dependências — usa o módulo crypto nativo do Node (runtime Vercel).
import crypto from 'node:crypto'

export const COOKIE_NAME = 'astella_admin'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 dias

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

// token = base64url(payload).base64url(hmac(payload))
export function signSession(secret, payload) {
  const body = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(secret, token) {
  if (!secret || !token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function parseCookies(req) {
  const header = req.headers?.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const key = part.slice(0, i).trim()
    if (key) out[key] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

// Retorna o payload da sessão se válida, senão null.
export function getSession(req) {
  const secret = process.env.SESSION_SECRET
  const token = parseCookies(req)[COOKIE_NAME]
  return verifySession(secret, token)
}

export function sessionCookie(token, maxAge = MAX_AGE_SECONDS) {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${maxAge}`,
  ].join('; ')
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`
}

// Compara duas strings em tempo constante (evita timing attack na senha).
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

// Guard reutilizável: garante sessão válida. Retorna a sessão ou responde 401.
export function requireSession(req, res) {
  const session = getSession(req)
  if (!session) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  return session
}

export function newSessionToken() {
  const secret = process.env.SESSION_SECRET
  const now = Math.floor(Date.now() / 1000)
  return signSession(secret, { sub: 'admin', iat: now, exp: now + MAX_AGE_SECONDS })
}
