// Rate limiting de janela fixa apoiado no Upstash Redis (mesmo store dos clicks).
// Fail-open: qualquer erro de Redis libera a requisição — preferimos não travar
// o admin nem quebrar a navegação do usuário a depender do Redis estar de pé.
import { redis } from './redis.js'

// Primeiro IP de x-forwarded-for (cadeia de proxies da Vercel), com fallbacks.
export function getClientIp(req) {
  const xff = req.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

// Incrementa o contador da janela e devolve true se ainda está dentro do limite.
// Seta TTL só na primeira requisição da janela (quando o contador vira 1).
export async function rateLimitOk(key, limit, windowSeconds) {
  try {
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, windowSeconds)
    return n <= limit
  } catch {
    return true
  }
}
