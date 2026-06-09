// Rate limiting de janela fixa apoiado no Upstash Redis (mesmo store dos clicks).
// Fail-open: qualquer erro de Redis libera a requisição — preferimos não travar
// o admin nem quebrar a navegação do usuário a depender do Redis estar de pé.
import { redis } from './redis.js'

// IP do cliente. Prioriza x-real-ip (setado pela borda da Vercel, não forjável
// pelo cliente). x-forwarded-for é controlável pelo cliente no primeiro hop —
// se cair nele, usa o ÚLTIMO hop (anexado pelo proxy confiável), não o primeiro.
export function getClientIp(req) {
  const realIp = req.headers?.['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  const xff = req.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    const hops = xff.split(',').map(s => s.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }
  return req.socket?.remoteAddress || 'unknown'
}

// INCR + EXPIRE atômico via Lua: o TTL é aplicado na mesma operação do incr, e
// reaplicado se a chave estiver sem TTL (TTL < 0) — impede que um crash entre
// dois comandos deixe a chave sem expiração e trave o IP para sempre.
const INCR_WITH_TTL = `
local n = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n`

// Devolve true se a requisição ainda está dentro do limite da janela.
export async function rateLimitOk(key, limit, windowSeconds) {
  try {
    const n = await redis.eval(INCR_WITH_TTL, [key], [windowSeconds])
    return Number(n) <= limit
  } catch {
    return true
  }
}
